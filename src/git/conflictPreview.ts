import { execGit } from './execGit';

export interface ConflictPreview {
	hasConflicts: boolean;
	conflictCount: number;
	conflictedFiles: string[];
	summary: string;
}

/**
 * Preview potential conflicts that would occur during a rebase operation
 * Uses git merge-tree to simulate the merge without modifying the working tree
 *
 * @param repoPath - Path to the git repository
 * @param branchName - The branch that would be rebased
 * @param targetBase - The base branch to rebase onto (e.g., origin/develop)
 * @returns ConflictPreview object with conflict information
 */
export function previewRebaseConflicts(
	repoPath: string,
	branchName: string,
	targetBase: string
): ConflictPreview {
	try {
		// Get the merge-base (common ancestor) between the branch and target
		const mergeBase = execGit(
			`merge-base ${branchName} ${targetBase}`,
			repoPath
		).trim();

		// Use merge-tree to simulate the merge
		// merge-tree performs a three-way merge without touching the working tree
		// Syntax: git merge-tree <base-commit> <branch1> <branch2>
		const mergeTreeOutput = execGit(
			`merge-tree ${mergeBase} ${targetBase} ${branchName}`,
			repoPath
		);

		// Parse the merge-tree output to detect conflicts
		// Conflicts are indicated by conflict markers in the output
		const hasConflicts = mergeTreeOutput.includes('<<<<<<<') ||
		                     mergeTreeOutput.includes('=======') ||
		                     mergeTreeOutput.includes('>>>>>>>');

		if (!hasConflicts) {
			return {
				hasConflicts: false,
				conflictCount: 0,
				conflictedFiles: [],
				summary: '✅ Clean rebase (0 conflicts expected)'
			};
		}

		// Extract conflicted files from the merge-tree output
		// The output format includes file paths before the content
		const conflictedFiles = extractConflictedFiles(mergeTreeOutput);
		const conflictCount = conflictedFiles.length;

		return {
			hasConflicts: true,
			conflictCount,
			conflictedFiles,
			summary: `⚠️ ${conflictCount} file${conflictCount !== 1 ? 's' : ''} will have conflicts`
		};
	} catch (error: any) {
		// If merge-base fails, the branches might not have a common ancestor
		// or one of the branches doesn't exist
		console.error('Conflict preview failed:', error);

		// Return a safe default that doesn't block the rebase
		return {
			hasConflicts: false,
			conflictCount: 0,
			conflictedFiles: [],
			summary: '⚠️ Unable to preview conflicts (rebase may still work)'
		};
	}
}

/**
 * Extract file paths that have conflicts from merge-tree output
 */
function extractConflictedFiles(mergeTreeOutput: string): string[] {
	const files = new Set<string>();
	const lines = mergeTreeOutput.split('\n');

	// merge-tree output format includes lines like:
	// "changed in both"
	// "  base   100644 <hash> <filename>"
	// "  our    100644 <hash> <filename>"
	// "  their  100644 <hash> <filename>"
	// "@@ -1,5 +1,5 @@ <filename>"

	// Look for file paths in conflict sections
	let inConflictSection = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Detect conflict markers
		if (line.includes('<<<<<<<')) {
			inConflictSection = true;
			// Try to extract filename from the marker
			// Format: <<<<<<< <branch>:<filename>
			const match = line.match(/<<<<<<< .*?:(.*)/);
			if (match && match[1]) {
				files.add(match[1].trim());
			}
		} else if (line.includes('>>>>>>>')) {
			inConflictSection = false;
		} else if (line.startsWith('@@')) {
			// Unified diff format: @@ -start,count +start,count @@ filename
			const match = line.match(/@@ .* @@ (.*)/);
			if (match && match[1]) {
				files.add(match[1].trim());
			}
		} else if (line.match(/^\s+(base|our|their)\s+\d+\s+[a-f0-9]+\s+(.+)$/)) {
			// Merge tree format for conflicted files
			const match = line.match(/^\s+(?:base|our|their)\s+\d+\s+[a-f0-9]+\s+(.+)$/);
			if (match && match[1]) {
				files.add(match[1].trim());
			}
		}
	}

	// If we couldn't extract files from markers, do a simpler scan
	// Count unique occurrences of conflict markers
	if (files.size === 0) {
		const conflictSections = mergeTreeOutput.split('<<<<<<<').length - 1;
		if (conflictSections > 0) {
			// We know there are conflicts but couldn't extract files
			// Return a generic indicator
			return [`${conflictSections} conflict section${conflictSections !== 1 ? 's' : ''} detected`];
		}
	}

	return Array.from(files);
}

/**
 * Check if a rebase would require a force push
 * This happens when the branch has commits on the remote that would be rewritten
 *
 * @param repoPath - Path to the git repository
 * @param branchName - The branch to check
 * @returns true if force push would be needed after rebase
 */
export function wouldRequireForcePush(
	repoPath: string,
	branchName: string
): boolean {
	try {
		// Check if the branch has a remote tracking branch
		const remoteBranch = execGit(
			`rev-parse --abbrev-ref ${branchName}@{upstream}`,
			repoPath
		).trim();

		if (!remoteBranch) {
			// No upstream, so no force push needed (can use --set-upstream)
			return false;
		}

		// Check if local branch has commits not on remote
		const commitsAhead = execGit(
			`rev-list --count ${remoteBranch}..${branchName}`,
			repoPath
		).trim();

		// If there are commits on the remote, rebasing would rewrite them
		// and require a force push
		return parseInt(commitsAhead, 10) > 0;
	} catch (error) {
		// If we can't determine, assume no force push needed
		return false;
	}
}
