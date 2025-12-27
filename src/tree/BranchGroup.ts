import * as vscode from 'vscode';
import { BranchItem } from './BranchItem';

export class BranchGroup extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly branches: BranchItem[],
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Expanded
	) {
		super(label, collapsibleState);

		// Enhanced tooltip with branch statistics
		const branchCount = branches.length;
		const activeBranch = branches.find(b => b.status.isActive);
		const aheadCount = branches.filter(b => (b.status.aheadDevelop ?? b.status.ahead) > 0).length;
		const behindCount = branches.filter(b => (b.status.behindDevelop ?? b.status.behind) > 0).length;
		const prCount = branches.filter(b => b.status.pr).length;

		const tooltipParts: string[] = [];
		tooltipParts.push(`${label.toUpperCase()}`);
		tooltipParts.push(`Total: ${branchCount} branch${branchCount === 1 ? '' : 'es'}`);

		if (activeBranch) {
			tooltipParts.push(`● Current: ${activeBranch.status.name}`);
		}

		const stats: string[] = [];
		if (aheadCount > 0) stats.push(`${aheadCount} ahead`);
		if (behindCount > 0) stats.push(`${behindCount} behind`);
		if (prCount > 0) stats.push(`${prCount} with PR/MR`);

		if (stats.length > 0) {
			tooltipParts.push('');
			tooltipParts.push(`Summary: ${stats.join(', ')}`);
		}

		this.tooltip = tooltipParts.join('\n');
		this.contextValue = 'branchGroup';
		
		// Set icon based on group type
		if (label.includes('Feature')) {
			this.iconPath = new vscode.ThemeIcon('folder');
		} else if (label.includes('Bug')) {
			this.iconPath = new vscode.ThemeIcon('folder');
		} else if (label.includes('Main')) {
			this.iconPath = new vscode.ThemeIcon('folder');
		} else {
			this.iconPath = new vscode.ThemeIcon('folder');
		}
	}
}
