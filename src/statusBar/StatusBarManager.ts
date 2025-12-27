import * as vscode from 'vscode';
import { detectRepoRoot } from '../git/detectRepo';
import { execGit } from '../git/execGit';
import { getBranchStatuses } from '../git/branchStatus';

export class StatusBarManager {
	private statusBarItem: vscode.StatusBarItem;

	constructor() {
		// Position on right side to avoid conflicts with built-in Git extension
		// Priority 100 places it prominently on the right side
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100
		);
		this.statusBarItem.command = 'kiki.statusBarActions';
		this.statusBarItem.name = 'Kiki Branch Status';
		this.update();
	}

	update(): void {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			this.statusBarItem.hide();
			return;
		}

		const repoPath = detectRepoRoot(workspaceFolder.uri.fsPath);
		if (!repoPath) {
			this.statusBarItem.hide();
			return;
		}

		try {
			// Get current branch
			const currentBranch = execGit('branch --show-current', repoPath).trim();

			// Get status for current branch
			const statuses = getBranchStatuses(repoPath);
			const status = statuses.find(s => s.name === currentBranch);

			if (!status) {
				this.statusBarItem.text = `$(git-branch) ${currentBranch}`;
				this.statusBarItem.tooltip = 'Current branch';
			} else {
				const devAhead = status.aheadDevelop ?? status.ahead ?? 0;
				const devBehind = status.behindDevelop ?? status.behind ?? 0;
				const mainAhead = status.aheadMain ?? 0;
				const mainBehind = status.behindMain ?? 0;

				// Choose icon based on branch state
				let icon = '$(git-branch)';
				let backgroundColor: vscode.ThemeColor | undefined;

				if (status.needsRebase || devBehind > 10) {
					icon = '$(warning)';
					// Optional: add warning color for critical states
					// backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
				} else if (devBehind > 0) {
					icon = '$(sync)';
				} else if (devAhead > 0 || mainAhead > 0) {
					icon = '$(arrow-up)';
				} else if (devBehind === 0 && mainBehind === 0 && devAhead === 0) {
					icon = '$(pass)';
				}

				// Build concise display text with Kiki prefix for clarity
				const parts: string[] = ['Kiki:', icon, currentBranch];

				// Show most critical info: develop drift
				if (devBehind > 0 || devAhead > 0) {
					parts.push(`↓${devBehind} ↑${devAhead}`);
				} else {
					parts.push('✓');
				}

				this.statusBarItem.text = parts.join(' ');
				this.statusBarItem.backgroundColor = backgroundColor;

				// Detailed tooltip with all info
				const tooltipParts = [
					`Branch: ${currentBranch}`,
					'',
					`Develop: ${devAhead === 0 && devBehind === 0 ? 'up to date' : `↑${devAhead} ↓${devBehind}`}`,
					`Main: ${mainAhead === 0 && mainBehind === 0 ? 'up to date' : `↑${mainAhead} ↓${mainBehind}`}`
				];

				if (status.needsRebase) {
					tooltipParts.push('', '⚠ Needs rebase (diverged)');
				}

				if (status.pr) {
					const platform = status.pr.platform === 'github' ? 'GitHub' :
					                status.pr.platform === 'gitlab' ? 'GitLab' : 'BitBucket';
					tooltipParts.push('', `${platform} PR #${status.pr.number}: ${status.pr.state.toUpperCase()}`);
				}

				tooltipParts.push('', '→ Click for quick actions');

				this.statusBarItem.tooltip = tooltipParts.join('\n');
			}

			this.statusBarItem.show();
		} catch (error) {
			console.error('Kiki: Failed to update status bar:', error);
			this.statusBarItem.hide();
		}
	}

	dispose(): void {
		this.statusBarItem.dispose();
	}
}
