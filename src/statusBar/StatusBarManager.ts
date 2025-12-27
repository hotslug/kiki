import * as vscode from 'vscode';
import { detectRepoRoot } from '../git/detectRepo';
import { execGit } from '../git/execGit';
import { getBranchStatuses, BranchStatus } from '../git/branchStatus';

export class StatusBarManager {
	private statusBarItem: vscode.StatusBarItem;

	constructor() {
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100
		);
		this.statusBarItem.command = 'kiki.refresh';
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
				const { ahead, behind, needsRebase } = status;

				let icon = '$(git-branch)';
				let suffix = '';

				if (needsRebase) {
					icon = '$(warning)';
					suffix = ` ↑${ahead} ↓${behind}`;
				} else if (ahead > 0) {
					suffix = ` ↑${ahead}`;
				} else if (behind > 0) {
					suffix = ` ↓${behind}`;
				}

				this.statusBarItem.text = `${icon} ${currentBranch}${suffix}`;
				this.statusBarItem.tooltip = `Branch: ${currentBranch}\nAhead: ${ahead}\nBehind: ${behind}\nClick to refresh`;
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
