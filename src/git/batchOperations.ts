import { execGit } from './execGit';
import { BranchStatus } from './branchStatus';

export interface MergedBranchCandidate {
	name: string;
	mergedIntoDevelop: boolean;
	mergedIntoMain: boolean;
	mergedAtDevelop?: string;
	mergedAtMain?: string;
	isActive: boolean;
	isProtected: boolean;
	reason?: string; // Why it can't be deleted
}

export interface BatchDeletePreview {
	deletable: MergedBranchCandidate[];
	protected: MergedBranchCandidate[];
	active: MergedBranchCandidate[];
	totalMergedBranches: number;
}

const PROTECTED_BRANCH_NAMES = ['main', 'master', 'develop', 'development'];

/**
 * Analyze merged branches and determine which can be safely deleted
 *
 * @param branches - All branch statuses from getBranchStatuses
 * @returns Preview of which branches can be deleted
 */
export function previewDeleteMergedBranches(branches: BranchStatus[]): BatchDeletePreview {
	const deletable: MergedBranchCandidate[] = [];
	const protectedBranches: MergedBranchCandidate[] = [];
	const activeBranches: MergedBranchCandidate[] = [];

	for (const branch of branches) {
		// Only consider branches that are merged into develop or main
		const isMerged = branch.mergedIntoDevelop || branch.mergedIntoMain;
		if (!isMerged) {
			continue;
		}

		const isProtected = PROTECTED_BRANCH_NAMES.includes(branch.name);
		const isActive = branch.isActive;

		const candidate: MergedBranchCandidate = {
			name: branch.name,
			mergedIntoDevelop: branch.mergedIntoDevelop || false,
			mergedIntoMain: branch.mergedIntoMain || false,
			mergedAtDevelop: branch.mergedAtDevelop,
			mergedAtMain: branch.mergedAtMain,
			isActive,
			isProtected,
		};

		if (isActive) {
			candidate.reason = 'Currently checked out';
			activeBranches.push(candidate);
		} else if (isProtected) {
			candidate.reason = 'Protected branch';
			protectedBranches.push(candidate);
		} else {
			deletable.push(candidate);
		}
	}

	return {
		deletable,
		protected: protectedBranches,
		active: activeBranches,
		totalMergedBranches: deletable.length + protectedBranches.length + activeBranches.length
	};
}

/**
 * Delete multiple merged branches in batch
 *
 * @param repoPath - Path to the git repository
 * @param branchNames - Array of branch names to delete
 * @param force - Use -D flag instead of -d
 * @returns Results of deletion attempts
 */
export function batchDeleteBranches(
	repoPath: string,
	branchNames: string[],
	force: boolean = false
): { succeeded: string[]; failed: Array<{ name: string; error: string }> } {
	const succeeded: string[] = [];
	const failed: Array<{ name: string; error: string }> = [];

	for (const branchName of branchNames) {
		try {
			const flag = force ? '-D' : '-d';
			execGit(`branch ${flag} ${branchName}`, repoPath);
			succeeded.push(branchName);
		} catch (error: any) {
			failed.push({
				name: branchName,
				error: error.message || String(error)
			});
		}
	}

	return { succeeded, failed };
}

/**
 * Format a merged branch candidate for display
 */
export function formatMergedBranch(candidate: MergedBranchCandidate): string {
	const parts: string[] = [candidate.name];

	const mergedInfo: string[] = [];
	if (candidate.mergedIntoDevelop) {
		mergedInfo.push('develop');
	}
	if (candidate.mergedIntoMain) {
		mergedInfo.push('main');
	}

	if (mergedInfo.length > 0) {
		parts.push(`(merged into ${mergedInfo.join(' and ')})`);
	}

	// Add date if available
	const date = candidate.mergedAtDevelop || candidate.mergedAtMain;
	if (date) {
		const formatted = formatDate(date);
		parts.push(`[${formatted}]`);
	}

	return parts.join(' ');
}

/**
 * Format ISO date to relative time
 */
function formatDate(isoDate: string): string {
	try {
		const date = new Date(isoDate);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return 'today';
		} else if (diffDays === 1) {
			return 'yesterday';
		} else if (diffDays < 7) {
			return `${diffDays} days ago`;
		} else if (diffDays < 30) {
			const weeks = Math.floor(diffDays / 7);
			return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
		} else if (diffDays < 365) {
			const months = Math.floor(diffDays / 30);
			return `${months} month${months > 1 ? 's' : ''} ago`;
		} else {
			const years = Math.floor(diffDays / 365);
			return `${years} year${years > 1 ? 's' : ''} ago`;
		}
	} catch {
		return isoDate;
	}
}
