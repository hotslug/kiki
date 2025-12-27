import * as vscode from 'vscode';

import { KikiProvider } from './tree/KikiProvider';
import { BranchItem } from './tree/BranchItem';
import { checkoutBranch, deleteBranch, rebaseBranch, pushBranch, pullBranch, createBranch } from './git/commands';
import { detectRepoRoot } from './git/detectRepo';
import { getBaseBranch } from './git/baseBranch';
import { execGit } from './git/execGit';

// Helper function to normalize branch names
function normalizeBranchName(name: string): string {
	return name
		.trim()
		// Replace spaces with dashes
		.replace(/\s+/g, '-')
		// Replace multiple consecutive dashes with single dash
		.replace(/-+/g, '-')
		// Remove leading/trailing dashes
		.replace(/^-+|-+$/g, '');
}

export function activate(context: vscode.ExtensionContext) {
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

	// Kiki: Git branch status tree view
	const kikiProvider = new KikiProvider(context.extensionUri);
	vscode.window.registerTreeDataProvider('kikiView', kikiProvider);
	vscode.commands.registerCommand('kiki.refresh', () => kikiProvider.refresh());

	// Register provider for disposal to clean up watchers
	context.subscriptions.push(kikiProvider);

	// Kiki: Branch commands
	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.checkoutBranch', async (item: BranchItem) => {
			const repoPath = detectRepoRoot(vscode.workspace.workspaceFolders![0].uri.fsPath);
			if (!repoPath) return;

			try {
				checkoutBranch(repoPath, item.status.name);
				vscode.window.showInformationMessage(`Checked out branch: ${item.status.name}`);
				kikiProvider.refresh();
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to checkout: ${error.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.deleteBranch', async (item: BranchItem) => {
			const branchName = item.status.name;
			const protectedBranches = ['main', 'master', 'develop', 'development'];
			const isProtected = protectedBranches.includes(branchName);

			let confirm: string | undefined;

			if (isProtected) {
				// Extra warning for protected branches
				confirm = await vscode.window.showWarningMessage(
					`⚠️ WARNING: You are about to delete "${branchName}"!\n\nThis is a protected branch and deleting it could affect your entire team.\n\nAre you absolutely sure?`,
					{ modal: true },
					'Yes, Delete Anyway'
				);

				if (confirm !== 'Yes, Delete Anyway') return;
			} else {
				// Normal confirmation for regular branches
				confirm = await vscode.window.showWarningMessage(
					`Delete branch "${branchName}"?`,
					{ modal: true },
					'Delete'
				);

				if (confirm !== 'Delete') return;
			}

			const repoPath = detectRepoRoot(vscode.workspace.workspaceFolders![0].uri.fsPath);
			if (!repoPath) return;

			try {
				deleteBranch(repoPath, branchName);
				vscode.window.showInformationMessage(`Deleted branch: ${branchName}`);
				kikiProvider.refresh();
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to delete: ${error.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.rebaseBranch', async (item: BranchItem) => {
			const repoPath = detectRepoRoot(vscode.workspace.workspaceFolders![0].uri.fsPath);
			if (!repoPath) return;

			try {
				const baseBranch = getBaseBranch(repoPath);
				const branchName = item.status.name;

				// Preview potential conflicts before rebasing
				const { previewRebaseConflicts, wouldRequireForcePush } = await import('./git/conflictPreview');
				const preview = previewRebaseConflicts(repoPath, branchName, baseBranch);
				const needsForcePush = wouldRequireForcePush(repoPath, branchName);

				// Build confirmation message
				let message = `Rebase ${branchName} onto ${baseBranch}?\n\n${preview.summary}`;

				if (preview.hasConflicts && preview.conflictedFiles.length > 0) {
					message += '\n\nConflicted files:';
					const fileList = preview.conflictedFiles.slice(0, 5).map(f => `  • ${f}`).join('\n');
					message += '\n' + fileList;
					if (preview.conflictedFiles.length > 5) {
						message += `\n  ... and ${preview.conflictedFiles.length - 5} more`;
					}
				}

				if (needsForcePush) {
					message += '\n\n⚠️ This will require a force push to update the remote branch.';
				}

				// Show confirmation dialog with preview
				const confirmOption = preview.hasConflicts ? 'Rebase anyway' : 'Rebase';
				const confirm = await vscode.window.showWarningMessage(
					message,
					{ modal: true },
					confirmOption,
					'Cancel'
				);

				if (confirm !== confirmOption) {
					return;
				}

				// Proceed with rebase
				await vscode.window.withProgress(
					{ location: vscode.ProgressLocation.Notification, title: `Rebasing ${branchName}...` },
					async () => {
						rebaseBranch(repoPath, branchName, baseBranch);
					}
				);

				let successMessage = `Rebased ${branchName} onto ${baseBranch}`;
				if (needsForcePush) {
					successMessage += ' (force push required)';
				}

				vscode.window.showInformationMessage(successMessage);
				kikiProvider.refresh();
			} catch (error: any) {
				vscode.window.showErrorMessage(`Rebase failed: ${error.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.pushBranch', async (item: BranchItem) => {
			const repoPath = detectRepoRoot(vscode.workspace.workspaceFolders![0].uri.fsPath);
			if (!repoPath) return;

			try {
				const setUpstream = item.status.behind === 0 && item.status.ahead > 0;
				pushBranch(repoPath, item.status.name, setUpstream);
				vscode.window.showInformationMessage(`Pushed branch: ${item.status.name}`);
				kikiProvider.refresh();
			} catch (error: any) {
				vscode.window.showErrorMessage(`Push failed: ${error.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.pullBranch', async (item: BranchItem) => {
			const repoPath = detectRepoRoot(vscode.workspace.workspaceFolders![0].uri.fsPath);
			if (!repoPath) return;

			try {
				pullBranch(repoPath, item.status.name);
				vscode.window.showInformationMessage(`Pulled branch: ${item.status.name}`);
				kikiProvider.refresh();
			} catch (error: any) {
				vscode.window.showErrorMessage(`Pull failed: ${error.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.deleteMergedBranch', async (item: BranchItem) => {
			const protectedBranches = ['main', 'master', 'develop', 'development'];
			const branchName = item.status.name;
			const isProtected = protectedBranches.includes(branchName);

			if (isProtected) {
				vscode.window.showWarningMessage(`Kiki: Protected branch "${branchName}" will not be deleted.`);
				return;
			}

			const mergedInfo = [
				item.status.mergedIntoDevelop ? 'merged into develop' : null,
				item.status.mergedIntoMain ? 'merged into main' : null
			].filter(Boolean).join(' and ');

			const confirm = await vscode.window.showWarningMessage(
				`Delete branch "${branchName}"? ${mergedInfo ? `(${mergedInfo})` : ''}`,
				{ modal: true },
				'Delete'
			);
			if (confirm !== 'Delete') return;

			const repoPath = detectRepoRoot(vscode.workspace.workspaceFolders![0].uri.fsPath);
			if (!repoPath) return;

			try {
				deleteBranch(repoPath, branchName, false);
				vscode.window.showInformationMessage(`Deleted merged branch: ${branchName}`);
				kikiProvider.refresh();
			} catch (error: any) {
				vscode.window.showErrorMessage(`Delete failed: ${error.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.mergeDevelop', async (item: BranchItem) => {
			if (!item) {
				vscode.window.showWarningMessage('Kiki: No branch selected.');
				return;
			}

			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('Kiki: No workspace folder found.');
				return;
			}

			const repoPath = detectRepoRoot(workspaceFolder.uri.fsPath);
			if (!repoPath) {
				vscode.window.showErrorMessage('Kiki: Not a Git repository.');
				return;
			}

			const branchName = item.status.name;

			try {
				execGit('fetch --quiet', repoPath);
			} catch (err: any) {
				vscode.window.showWarningMessage(`Kiki: Fetch failed (continuing): ${err?.message || err}`);
			}

			try {
				execGit('rev-parse --verify origin/develop', repoPath);
			} catch (err: any) {
				vscode.window.showErrorMessage('Kiki: Remote branch origin/develop not found.');
				return;
			}

			let currentBranch = '';
			try {
				currentBranch = execGit('branch --show-current', repoPath).trim();
			} catch {
				currentBranch = '';
			}

			if (currentBranch !== branchName) {
				const choice = await vscode.window.showWarningMessage(
					`Checkout ${branchName} to merge origin/develop into it?`,
					{ modal: true },
					'Checkout and merge'
				);
				if (choice !== 'Checkout and merge') {
					return;
				}

				try {
					execGit(`checkout ${branchName}`, repoPath);
				} catch (err: any) {
					vscode.window.showErrorMessage(`Kiki: Failed to checkout ${branchName}: ${err?.message || err}`);
					return;
				}
			}

			try {
				execGit('merge origin/develop', repoPath);
				vscode.window.showInformationMessage(`Kiki: Merged origin/develop into ${branchName}.`);
				kikiProvider.refresh();
			} catch (err: any) {
				vscode.window.showErrorMessage(`Kiki: Merge failed: ${err?.message || err}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.createBranch', async (item?: BranchItem) => {
			const repoPath = detectRepoRoot(vscode.workspace.workspaceFolders![0].uri.fsPath);
			if (!repoPath) return;

			// If called from title bar, use current branch as base
			const baseBranch = item?.status.name || 'HEAD';
			const baseBranchDisplay = item?.status.name || 'current branch';

			// Step 1: Select branch type
			const branchType = await vscode.window.showQuickPick(
				[
					{ label: 'feature/', description: 'New feature or enhancement' },
					{ label: 'bugfix/', description: 'Bug fix' },
					{ label: 'hotfix/', description: 'Urgent production fix' },
					{ label: 'release/', description: 'Release branch' },
					{ label: 'experiment/', description: 'Experimental changes' },
					{ label: 'refactor/', description: 'Code refactoring' },
					{ label: '(no prefix)', description: 'Create branch without type prefix', prefix: '' },
					{ label: '(custom prefix)', description: 'Enter your own custom prefix', customPrefix: true },
					{ label: '(custom)', description: 'Enter complete branch name yourself', custom: true }
				],
				{
					placeHolder: 'Select branch type',
					title: `Create new branch from ${baseBranchDisplay}`
				}
			);

			if (!branchType) return;

			let fullBranchName: string;

			// Handle custom branch name
			if ((branchType as any).custom) {
				const customBranchName = await vscode.window.showInputBox({
					prompt: `Enter complete branch name (spaces will be converted to dashes)`,
					placeHolder: 'my-custom-branch or feature/my-branch',
					validateInput: (value) => {
						if (!value || value.trim().length === 0) {
							return 'Branch name cannot be empty';
						}
						// Check for invalid characters (allow letters, numbers, spaces, dots, underscores, slashes, dashes)
						if (!/^[a-zA-Z0-9\s._\/-]+$/.test(value)) {
							return 'Branch name contains invalid characters (only letters, numbers, spaces, ., _, /, - allowed)';
						}
						return null;
					}
				});

				if (!customBranchName) return;

				// Handle prefix separately (preserve slashes in paths like feature/my-branch)
				const parts = customBranchName.trim().split('/');
				const normalizedParts = parts.map(part => normalizeBranchName(part));
				fullBranchName = normalizedParts.join('/');

				// Show what was normalized if it changed
				if (fullBranchName !== customBranchName.trim()) {
					const proceed = await vscode.window.showInformationMessage(
						`Branch name normalized to: ${fullBranchName}`,
						'Continue',
						'Cancel'
					);
					if (proceed !== 'Continue') return;
				}
			} else if ((branchType as any).customPrefix) {
				// Handle custom prefix
				const customPrefix = await vscode.window.showInputBox({
					prompt: `Enter your custom prefix (spaces will be converted to dashes)`,
					placeHolder: 'myprefix',
					validateInput: (value) => {
						if (!value || value.trim().length === 0) {
							return 'Prefix cannot be empty';
						}
						// Check for invalid characters (allow / for nested prefixes)
						if (!/^[a-zA-Z0-9\s._\/-]+$/.test(value)) {
							return 'Prefix contains invalid characters (only letters, numbers, spaces, ., _, /, - allowed)';
						}
						return null;
					}
				});

				if (!customPrefix) return;

				// Normalize prefix parts
				const prefixParts = customPrefix.trim().replace(/\/+$/, '').split('/');
				const normalizedPrefixParts = prefixParts.map(part => normalizeBranchName(part));
				const normalizedPrefix = normalizedPrefixParts.join('/') + '/';

				// Now get the branch name
				const branchName = await vscode.window.showInputBox({
					prompt: `Enter branch name (will be: ${normalizedPrefix}your-branch-name)`,
					placeHolder: 'my-branch-name',
					validateInput: (value) => {
						if (!value || value.trim().length === 0) {
							return 'Branch name cannot be empty';
						}
						// Check for invalid characters
						if (!/^[a-zA-Z0-9\s._\/-]+$/.test(value)) {
							return 'Branch name contains invalid characters (only letters, numbers, spaces, ., _, /, - allowed)';
						}
						return null;
					}
				});

				if (!branchName) return;

				// Normalize branch name
				const normalizedBranchName = normalizeBranchName(branchName);
				fullBranchName = `${normalizedPrefix}${normalizedBranchName}`;

				// Show what was normalized if prefix or branch name changed
				const originalFull = `${customPrefix.trim()}/${branchName.trim()}`;
				if (fullBranchName !== originalFull) {
					const proceed = await vscode.window.showInformationMessage(
						`Branch name normalized to: ${fullBranchName}`,
						'Continue',
						'Cancel'
					);
					if (proceed !== 'Continue') return;
				}
			} else {
				// Determine the actual prefix to use
				const prefix = branchType.label === '(no prefix)'
					? (branchType as any).prefix
					: branchType.label;

				// Step 2: Enter branch name
				const branchName = await vscode.window.showInputBox({
					prompt: `Enter branch name (will be: ${prefix}your-branch-name)`,
					placeHolder: 'my-branch-name',
					validateInput: (value) => {
						if (!value || value.trim().length === 0) {
							return 'Branch name cannot be empty';
						}
						// Check for invalid characters
						if (!/^[a-zA-Z0-9\s._\/-]+$/.test(value)) {
							return 'Branch name contains invalid characters (only letters, numbers, spaces, ., _, /, - allowed)';
						}
						return null;
					}
				});

				if (!branchName) return;

				// Normalize the branch name
				const normalizedBranchName = normalizeBranchName(branchName);
				fullBranchName = `${prefix}${normalizedBranchName}`;

				// Show what was normalized if it changed
				if (normalizedBranchName !== branchName.trim()) {
					const proceed = await vscode.window.showInformationMessage(
						`Branch name normalized to: ${fullBranchName}`,
						'Continue',
						'Cancel'
					);
					if (proceed !== 'Continue') return;
				}
			}

			try {
				createBranch(repoPath, fullBranchName, baseBranch);
				vscode.window.showInformationMessage(`Created and checked out branch: ${fullBranchName}`);
				kikiProvider.refresh();
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to create branch: ${error.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.copyBranchName', async (item: BranchItem) => {
			await vscode.env.clipboard.writeText(item.status.name);
			vscode.window.showInformationMessage(`Copied: ${item.status.name}`);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.openPR', async (item: BranchItem) => {
			if (item.status.pr?.url) {
				vscode.env.openExternal(vscode.Uri.parse(item.status.pr.url));
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('kiki.deleteMergedBranches', async () => {
			const repoPath = detectRepoRoot(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '');
			if (!repoPath) {
				vscode.window.showErrorMessage('Kiki: No Git repository found.');
				return;
			}

			try {
				// Get branch statuses
				const { getBranchStatuses } = await import('./git/branchStatus');
				const { previewDeleteMergedBranches, batchDeleteBranches, formatMergedBranch } = await import('./git/batchOperations');

				const branches = getBranchStatuses(repoPath);
				const preview = previewDeleteMergedBranches(branches);

				// If no merged branches to delete
				if (preview.deletable.length === 0) {
					const reasons: string[] = [];
					if (preview.active.length > 0) {
						reasons.push(`${preview.active.length} active`);
					}
					if (preview.protected.length > 0) {
						reasons.push(`${preview.protected.length} protected`);
					}

					let message = 'No merged branches to delete.';
					if (reasons.length > 0) {
						message += ` Found ${preview.totalMergedBranches} merged branch(es) but all are ${reasons.join(' or ')}.`;
					}

					vscode.window.showInformationMessage(message);
					return;
				}

				// Build preview message
				let previewMessage = `Delete ${preview.deletable.length} merged branch${preview.deletable.length !== 1 ? 'es' : ''}?\n\n`;

				// Show up to 10 branches in the preview
				const previewList = preview.deletable.slice(0, 10).map(b => {
					return `  • ${formatMergedBranch(b)}`;
				}).join('\n');

				previewMessage += previewList;

				if (preview.deletable.length > 10) {
					previewMessage += `\n  ... and ${preview.deletable.length - 10} more`;
				}

				// Add info about skipped branches
				const skipped = preview.protected.length + preview.active.length;
				if (skipped > 0) {
					previewMessage += `\n\n(Skipping ${skipped} branch${skipped !== 1 ? 'es' : ''}: `;
					const parts: string[] = [];
					if (preview.active.length > 0) {
						parts.push(`${preview.active.length} active`);
					}
					if (preview.protected.length > 0) {
						parts.push(`${preview.protected.length} protected`);
					}
					previewMessage += parts.join(', ') + ')';
				}

				// Show confirmation dialog
				const deleteOption = 'Delete All';
				const confirm = await vscode.window.showWarningMessage(
					previewMessage,
					{ modal: true },
					deleteOption,
					'Cancel'
				);

				if (confirm !== deleteOption) {
					return;
				}

				// Perform batch delete
				const branchNames = preview.deletable.map(b => b.name);
				const results = batchDeleteBranches(repoPath, branchNames, false);

				// Show results using output channel for detailed error info
				if (results.succeeded.length > 0 && results.failed.length === 0) {
					// Clean success - simple message
					vscode.window.showInformationMessage(
						`Kiki: Deleted ${results.succeeded.length} merged branch${results.succeeded.length !== 1 ? 'es' : ''}`
					);
				} else if (results.failed.length > 0) {
					// Some or all failed - use output channel for detailed info
					const outputChannel = vscode.window.createOutputChannel('Kiki');
					outputChannel.clear();
					outputChannel.appendLine('Delete Merged Branches Results');
					outputChannel.appendLine('='.repeat(50));
					outputChannel.appendLine('');

					if (results.succeeded.length > 0) {
						outputChannel.appendLine(`Deleted ${results.succeeded.length} branch${results.succeeded.length !== 1 ? 'es' : ''}:`);
						results.succeeded.forEach(name => {
							outputChannel.appendLine(`  - ${name}`);
						});
						outputChannel.appendLine('');
					}

					if (results.failed.length > 0) {
						outputChannel.appendLine(`Could not delete ${results.failed.length} branch${results.failed.length !== 1 ? 'es' : ''}:`);
						outputChannel.appendLine('');

						results.failed.forEach(f => {
							// Parse the error to extract the useful part
							let reason = f.error;

							// Extract the main error message from git output
							if (reason.includes('is not fully merged')) {
								const branchMatch = reason.match(/not yet merged to '([^']+)'/);
								const upstream = branchMatch ? branchMatch[1].replace('refs/remotes/', '') : 'its upstream';
								reason = `Not fully merged to ${upstream}`;
							} else if (reason.includes('Git command failed:')) {
								// Extract just the git error, not the command
								const lines = reason.split('\n');
								const errorLine = lines.find(l => l.includes('error:')) || lines.find(l => l.includes('warning:'));
								if (errorLine) {
									reason = errorLine.replace(/^(error|warning):\s*/i, '').trim();
								}
							}

							outputChannel.appendLine(`  Branch: ${f.name}`);
							outputChannel.appendLine(`  Reason: ${reason}`);
							outputChannel.appendLine(`  Fix:    git branch -D ${f.name}`);
							outputChannel.appendLine('');
						});
					}

					outputChannel.show(true);

					// Show concise notification with action to view details
					const message = results.succeeded.length > 0
						? `Kiki: Deleted ${results.succeeded.length}, failed ${results.failed.length} - see output for details`
						: `Kiki: Failed to delete ${results.failed.length} branch${results.failed.length !== 1 ? 'es' : ''} - see output for details`;

					if (results.succeeded.length > 0) {
						vscode.window.showWarningMessage(message);
					} else {
						vscode.window.showErrorMessage(message);
					}
				}

				// Refresh the tree view
				kikiProvider.refresh();
			} catch (error: any) {
				vscode.window.showErrorMessage(`Kiki: Failed to delete merged branches: ${error.message}`);
			}
		})
	);
}
