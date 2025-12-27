import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getBranchStatuses } from '../git/branchStatus';
import { detectRepoRoot } from '../git/detectRepo';
import { BranchItem, BranchDetailItem } from './BranchItem';
import { BranchGroup } from './BranchGroup';
import { StatusBarManager } from '../statusBar/StatusBarManager';
import { GitHubService } from '../pr/GitHubService';
import { GitLabService } from '../pr/GitLabService';
import { BitBucketService } from '../pr/BitBucketService';

export class KikiProvider implements vscode.TreeDataProvider<BranchItem | BranchGroup | BranchDetailItem>, vscode.Disposable {
	private _onDidChangeTreeData = new vscode.EventEmitter<BranchItem | BranchGroup | BranchDetailItem | undefined | null | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private fileWatcher: fs.FSWatcher | undefined;
	private periodicRefreshTimer: NodeJS.Timeout | undefined;
	private autoRefreshEnabled: boolean = true;
	private refreshInterval: number = 5; // minutes
	private statusBarManager: StatusBarManager;
	private githubService: GitHubService;
	private gitlabService: GitLabService;
	private bitbucketService: BitBucketService;

	constructor(private readonly extensionUri: vscode.Uri) {
		this.statusBarManager = new StatusBarManager();
		this.githubService = new GitHubService();
		this.gitlabService = new GitLabService();
		this.bitbucketService = new BitBucketService();
		this.loadConfiguration();
		this.startAutoRefresh();

		// Listen for configuration changes
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('kiki')) {
				console.log('Kiki: Configuration changed, reloading...');
				this.loadConfiguration();
				this.restartAutoRefresh();
			}
			if (e.affectsConfiguration('kiki.github')) {
				this.githubService.reload();
				this.refresh();
			}
			if (e.affectsConfiguration('kiki.gitlab')) {
				this.gitlabService.reload();
				this.refresh();
			}
			if (e.affectsConfiguration('kiki.bitbucket')) {
				this.bitbucketService.reload();
				this.refresh();
			}
		});
	}

	private loadConfiguration(): void {
		const config = vscode.workspace.getConfiguration('kiki');
		this.autoRefreshEnabled = config.get('autoRefresh', true);
		this.refreshInterval = config.get('refreshInterval', 5);
	}

	private startAutoRefresh(): void {
		// Watch .git/HEAD for branch switches
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (workspaceFolder) {
			const repoPath = detectRepoRoot(workspaceFolder.uri.fsPath);
			if (repoPath) {
				const gitHeadPath = path.join(repoPath, '.git', 'HEAD');

				try {
					this.fileWatcher = fs.watch(gitHeadPath, (event) => {
						if (this.autoRefreshEnabled) {
							console.log('Kiki: Branch switch detected, refreshing...');
							this.refresh();
						}
					});
				} catch (error) {
					console.warn('Kiki: Could not watch .git/HEAD:', error);
				}
			}
		}

		// Periodic refresh timer
		if (this.autoRefreshEnabled && this.refreshInterval > 0) {
			this.periodicRefreshTimer = setInterval(() => {
				console.log('Kiki: Periodic refresh triggered');
				this.refresh();
			}, this.refreshInterval * 60 * 1000);
		}
	}

	private restartAutoRefresh(): void {
		// Stop existing watchers
		this.dispose();
		// Restart with new config
		this.startAutoRefresh();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
		this.statusBarManager.update();
	}

	dispose(): void {
		if (this.fileWatcher) {
			this.fileWatcher.close();
			this.fileWatcher = undefined;
		}
		if (this.periodicRefreshTimer) {
			clearInterval(this.periodicRefreshTimer);
			this.periodicRefreshTimer = undefined;
		}
		this.statusBarManager.dispose();
	}

	getTreeItem(element: BranchItem | BranchGroup | BranchDetailItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: BranchItem | BranchGroup | BranchDetailItem): vscode.ProviderResult<(BranchItem | BranchGroup | BranchDetailItem)[]> {
		if (!element) {
			// Root level - return groups
			return this.getBranchGroups();
		} else if (element instanceof BranchGroup) {
			// Return branches in this group
			return element.branches;
		} else if (element instanceof BranchItem) {
			return this.getBranchDetails(element);
		}
		return [];
	}

	private async getBranchGroups(): Promise<BranchGroup[]> {
		const branches = await this.getBranchItems();
		
		const mergedBranches = branches.filter(b => (b.status.mergedIntoDevelop || b.status.mergedIntoMain) && !b.status.isActive);
		// Group branches by type
		const mainBranches = branches.filter(b => 
			b.status.name === 'main' || b.status.name === 'master' || 
			b.status.name === 'develop' || b.status.isActive
		);
		const featureBranches = branches.filter(b => b.status.name.startsWith('feature/') && !mergedBranches.includes(b));
		const bugfixBranches = branches.filter(b => 
			(b.status.name.startsWith('bugfix/') || b.status.name.startsWith('hotfix/')) && !mergedBranches.includes(b)
		);
		const otherBranches = branches.filter(b => 
			!mainBranches.includes(b) && !featureBranches.includes(b) && !bugfixBranches.includes(b) && !mergedBranches.includes(b)
		);

		const groups: BranchGroup[] = [];
		
		if (mainBranches.length > 0) {
			groups.push(new BranchGroup('Main Branches', mainBranches));
		}
		if (featureBranches.length > 0) {
			groups.push(new BranchGroup('Feature Branches', featureBranches));
		}
			if (bugfixBranches.length > 0) {
				groups.push(new BranchGroup('Bug Fixes', bugfixBranches));
			}
			if (otherBranches.length > 0) {
				groups.push(new BranchGroup('Other Branches', otherBranches));
			}
			if (mergedBranches.length > 0) {
				groups.push(new BranchGroup('Merged Branches', mergedBranches, vscode.TreeItemCollapsibleState.Collapsed));
			}

		return groups;
	}

	private async getBranchItems(): Promise<BranchItem[]> {
		try {
			// Get workspace folder
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				console.log('Kiki: No workspace folder found');
				return [];
			}

			console.log('Kiki: Workspace folder:', workspaceFolder.uri.fsPath);

			// Detect repo root
			const repoPath = detectRepoRoot(workspaceFolder.uri.fsPath);
			if (!repoPath) {
				console.log('Kiki: Not a git repository');
				return [];
			}

			console.log('Kiki: Repo root:', repoPath);

			// Get branch statuses from Part 1
			const statuses = getBranchStatuses(repoPath);
			console.log('Kiki: Found', statuses.length, 'branches');

			// Enrich with PR data from GitHub, GitLab, and BitBucket
			const enrichedStatuses = await Promise.all(
				statuses.map(async (status) => {
					// Try GitHub first
					let pr = await this.githubService.getPRForBranch(status.name);
					if (pr) {
						status.pr = { ...pr, platform: 'github' };
						return status;
					}

					// Try GitLab
					pr = await this.gitlabService.getMRForBranch(status.name);
					if (pr) {
						status.pr = { ...pr, platform: 'gitlab' };
						return status;
					}

					// Try BitBucket
					pr = await this.bitbucketService.getPRForBranch(status.name);
					if (pr) {
						status.pr = { ...pr, platform: 'bitbucket' };
					}

					return status;
				})
			);

			return enrichedStatuses.map(status => new BranchItem(status, this.extensionUri));

		} catch (error: any) {
			console.error('Kiki: Error getting branch items:', error?.message || error);
			console.error('Kiki: Full error:', error);
			return [];
		}
	}

	private getBranchDetails(item: BranchItem): BranchDetailItem[] {
		const s = item.status;
		const details: BranchDetailItem[] = [];

		const statusIcon = (ahead: number, behind: number): vscode.ThemeIcon => {
			if (ahead === 0 && behind === 0) {
				return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
			}
			if (ahead > 0 && behind === 0) {
				return new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'));
			}
			if (ahead === 0 && behind > 0) {
				return new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('list.warningForeground'));
			}
			return new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
		};

		// Base (whatever the detected base is)
		details.push(new BranchDetailItem(
			`Base: ↑${s.ahead} ↓${s.behind}`,
			statusIcon(s.ahead, s.behind)
		));

		if (s.aheadDevelop !== undefined || s.behindDevelop !== undefined) {
			const a = s.aheadDevelop ?? 0;
			const b = s.behindDevelop ?? 0;
			details.push(new BranchDetailItem(
				`Develop: ↑${a} ↓${b}`,
				statusIcon(a, b)
			));
			if (s.mergedIntoDevelop) {
				details.push(new BranchDetailItem(
					`Merged into develop${s.mergedAtDevelop ? ` on ${s.mergedAtDevelop}` : ''}`,
					new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
				));
			}
		}

		if (s.aheadMain !== undefined || s.behindMain !== undefined) {
			const a = s.aheadMain ?? 0;
			const b = s.behindMain ?? 0;
			details.push(new BranchDetailItem(
				`Main: ↑${a} ↓${b}`,
				statusIcon(a, b)
			));
			if (s.mergedIntoMain) {
				details.push(new BranchDetailItem(
					`Merged into main${s.mergedAtMain ? ` on ${s.mergedAtMain}` : ''}`,
					new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
				));
			}
		}

		details.push(new BranchDetailItem(
			`Needs rebase: ${s.needsRebase ? 'yes' : 'no'}`,
			s.needsRebase
				? new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'))
				: new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
		));

		if (s.needsRebase) {
			const action = new BranchDetailItem(
				'Rebase onto develop/base',
				new vscode.ThemeIcon('git-merge', new vscode.ThemeColor('list.warningForeground'))
			);
			action.command = {
				command: 'kiki.rebaseBranch',
				title: 'Rebase Branch',
				arguments: [item]
			};
			details.push(action);
		}

		if (s.pr) {
			const platformName = s.pr.platform === 'github' ? 'GitHub' :
				s.pr.platform === 'gitlab' ? 'GitLab' : 'BitBucket';
			const prIcon = new vscode.ThemeIcon(
				s.pr.state === 'open' ? 'git-pull-request' :
				s.pr.state === 'merged' ? 'git-merge' : 'circle-slash',
				s.pr.state === 'open'
					? new vscode.ThemeColor('gitDecoration.addedResourceForeground')
					: s.pr.state === 'merged'
						? new vscode.ThemeColor('testing.iconPassed')
						: undefined
			);
			details.push(new BranchDetailItem(
				`${platformName} ${s.pr.platform === 'gitlab' ? 'MR' : 'PR'} #${s.pr.number}: ${s.pr.state.toUpperCase()}`,
				prIcon
			));
			details.push(new BranchDetailItem(
				`Title: ${s.pr.title}`,
				new vscode.ThemeIcon('comment')
			));
		}

		return details;
	}
}
