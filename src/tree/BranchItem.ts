import * as vscode from 'vscode';
import { BranchStatus } from '../git/branchStatus';
import { BranchHealth, calculateBranchHealth } from '../git/branchHealth';

export class BranchItem extends vscode.TreeItem {
	public readonly health: BranchHealth;

	constructor(
		public readonly status: BranchStatus,
		private readonly extensionUri: vscode.Uri
	) {
		super(status.name, vscode.TreeItemCollapsibleState.Collapsed);

		// Calculate health score
		this.health = calculateBranchHealth(status);

		// Description logic from spec
		this.description = this.formatDescription(status);
		this.tooltip = this.formatTooltip(status);
		this.iconPath = this.getIcon();
		this.contextValue = this.getContextValue(status);

		// Add inline commands for quick actions
		if (!status.isActive) {
			this.command = {
				command: 'kiki.checkoutBranch',
				title: 'Checkout Branch',
				arguments: [this]
			};
		}
	}

	private getIcon(): vscode.ThemeIcon {
		// Use health-based icons for better at-a-glance status
		return new vscode.ThemeIcon(
			this.health.icon,
			new vscode.ThemeColor(this.health.iconColor)
		);
	}

	private getContextValue(status: BranchStatus): string {
		const values = ['branchItem'];

		if (status.isActive) values.push('active');
		if ((status.aheadDevelop ?? status.ahead) > 0) values.push('ahead');
		if ((status.behindDevelop ?? status.behind) > 0) values.push('behind', 'behindDevelop');
		if (status.mergedIntoDevelop || status.mergedIntoMain) values.push('merged');
		if (status.pr) values.push('hasPR');
		if (status.name.startsWith('feature/')) values.push('feature');
		if (status.name.startsWith('bugfix/') || status.name.startsWith('hotfix/')) values.push('bugfix');

		return values.join('_');
	}

	private formatDescription(status: BranchStatus): string {
		const { pr } = status;
		const aheadDevelop = status.aheadDevelop ?? status.ahead;
		const behindDevelop = status.behindDevelop ?? status.behind;
		const aheadMain = status.aheadMain ?? 0;
		const behindMain = status.behindMain ?? 0;
		const parts: string[] = [];

		if (aheadDevelop === 0 && behindDevelop === 0) {
			parts.push('✓');
		} else if (aheadDevelop > 0 && behindDevelop === 0) {
			parts.push(`↑${aheadDevelop}`);
		} else if (aheadDevelop === 0 && behindDevelop > 0) {
			parts.push(`↓${behindDevelop}`);
		} else {
			parts.push(`↑${aheadDevelop} ↓${behindDevelop}`);
		}

		// Add PR info with platform indicator
		if (pr) {
			const prState = pr.state === 'open' ? 'PR' : pr.state === 'merged' ? 'MERGED' : 'CLOSED';
			const platform = pr.platform === 'github' ? 'GH' : pr.platform === 'gitlab' ? 'GL' : 'BB';
			parts.push(`[${platform} ${prState} #${pr.number}]`);
		}

		return parts.join(' ');
	}

	private formatTooltip(status: BranchStatus): vscode.MarkdownString {
		const parts: string[] = [];

		parts.push(this.formatTitle(status));

		parts.push(''); // Empty line for spacing

		parts.push(...this.formatDualBaseStatus(status));

		// PR/MR information with enhanced details
		if (status.pr) {
			parts.push(''); // Empty line for spacing
			const platformName = status.pr.platform === 'github' ? 'GitHub' :
			                     status.pr.platform === 'gitlab' ? 'GitLab' : 'BitBucket';
			const prType = status.pr.platform === 'gitlab' ? 'MR' : 'PR';
			const stateLabel = status.pr.state === 'open' ? 'OPEN' :
			                   status.pr.state === 'merged' ? 'MERGED' : 'CLOSED';

			parts.push(`${platformName} ${prType} #${status.pr.number}: ${stateLabel}`);
			parts.push(`Title: ${status.pr.title}`);
			parts.push('');
			parts.push('→ Right-click and select "Open Pull Request" to view');
		}

		return new vscode.MarkdownString(parts.join('\n'));
	}

	private formatTitle(status: BranchStatus): string {
		if (status.isActive) {
			return `<u>**${`● ${status.name} (CURRENT BRANCH)`.toUpperCase()}**</u>`;
		}
		return `<u>**${status.name.toUpperCase()}**</u>`;
	}

	private formatDualBaseStatus(status: BranchStatus): string[] {
		const lines: string[] = [];
		const aheadDevelop = status.aheadDevelop ?? status.ahead;
		const behindDevelop = status.behindDevelop ?? status.behind;
		const aheadMain = status.aheadMain ?? 0;
		const behindMain = status.behindMain ?? 0;

		// Develop status
		if (aheadDevelop === 0 && behindDevelop === 0) {
			lines.push('Develop: Up to date');
		} else if (aheadDevelop > 0 && behindDevelop === 0) {
			lines.push(`Develop: ↑${aheadDevelop} (ready to push)`);
		} else if (aheadDevelop === 0 && behindDevelop > 0) {
			lines.push(`Develop: ↓${behindDevelop} (rebase/merge develop recommended)`);
		} else {
			lines.push(`Develop: ↑${aheadDevelop} ↓${behindDevelop} (diverged)`);
		}

		// Main status (deploy readiness)
		if (aheadMain === 0 && behindMain === 0) {
			lines.push('Main: Up to date');
		} else if (aheadMain > 0 && behindMain === 0) {
			lines.push(`Main: ↑${aheadMain} (ready to deploy)`);
		} else if (aheadMain === 0 && behindMain > 0) {
			lines.push(`Main: ↓${behindMain} (behind main)`);
		} else {
			lines.push(`Main: ↑${aheadMain} ↓${behindMain} (diverged from main)`);
		}

		return lines;
	}
}

export class BranchDetailItem extends vscode.TreeItem {
	constructor(label: string, icon?: vscode.ThemeIcon, description?: string) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.description = description;
		this.contextValue = 'branchDetail';
		this.iconPath = icon ?? new vscode.ThemeIcon('info');
	}
}
