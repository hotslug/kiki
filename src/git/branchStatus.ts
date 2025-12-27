import { execGit } from './execGit';
import { getBaseBranch } from './baseBranch';
import { getLocalBranches } from './branches';

export interface BranchStatus {
	name: string;
	ahead: number;
	behind: number;
	needsRebase: boolean;
	isActive: boolean;
	aheadDevelop?: number;
	behindDevelop?: number;
	aheadMain?: number;
	behindMain?: number;
	mergedIntoDevelop?: boolean;
	mergedIntoMain?: boolean;
	mergedAtDevelop?: string;
	mergedAtMain?: string;
	pr?: {
		number: number;
		title: string;
		state: 'open' | 'closed' | 'merged';
		url: string;
		platform: 'github' | 'gitlab' | 'bitbucket';
	};
}

function parseCounts(output: string): { ahead: number; behind: number } {
	const [behindStr, aheadStr] = output.split('\t');
	const behind = Number((behindStr ?? '').trim()) || 0;
	const ahead = Number((aheadStr ?? '').trim()) || 0;

	return { ahead, behind };
}

function refExists(repoPath: string, ref: string): boolean {
	try {
		execGit(`rev-parse --verify ${ref}`, repoPath);
		return true;
	} catch {
		return false;
	}
}

function isMergedInto(repoPath: string, branch: string, target: string): boolean {
	try {
		execGit(`merge-base --is-ancestor ${branch} ${target}`, repoPath);
		return true;
	} catch {
		return false;
	}
}

function mergedAt(repoPath: string, branch: string, target: string): string | undefined {
	try {
		const output = execGit(`log --format=%cI --reverse --ancestry-path ${branch}..${target}`, repoPath);
		if (!output) return undefined;
		const firstLine = output.split('\n')[0]?.trim();
		return firstLine || undefined;
	} catch {
		return undefined;
	}
}

export function getBranchStatuses(repoPath: string): BranchStatus[] {
	try {
		execGit('fetch --quiet', repoPath);
	} catch (err: any) {
		console.warn(`Kiki: Failed to fetch from remote (continuing anyway): ${err?.message || err}`);
	}

	const base = getBaseBranch(repoPath);
	const branches = getLocalBranches(repoPath);
	const statuses: BranchStatus[] = [];

	const developRef = refExists(repoPath, 'origin/develop') ? 'origin/develop' : undefined;
	const mainRef = refExists(repoPath, 'origin/main') ? 'origin/main' : undefined;

	// Get current branch
	let currentBranch = '';
	try {
		currentBranch = execGit('branch --show-current', repoPath).trim();
	} catch (err: any) {
		console.warn(`Kiki: Failed to get current branch: ${err?.message || err}`);
	}

	for (const branch of branches) {
		try {
			const output = execGit(`rev-list --left-right --count ${base}...${branch}`, repoPath);
			const { ahead, behind } = parseCounts(output);

			const developCounts = developRef
				? parseCounts(execGit(`rev-list --left-right --count ${developRef}...${branch}`, repoPath))
				: undefined;
			const mainCounts = mainRef
				? parseCounts(execGit(`rev-list --left-right --count ${mainRef}...${branch}`, repoPath))
				: undefined;

			const mergedDevelop = developRef ? isMergedInto(repoPath, branch, developRef) : undefined;
			const mergedMain = mainRef ? isMergedInto(repoPath, branch, mainRef) : undefined;

			statuses.push({
				name: branch,
				ahead,
				behind,
				needsRebase: ahead > 0 && behind > 0,
				isActive: branch === currentBranch,
				aheadDevelop: developCounts?.ahead,
				behindDevelop: developCounts?.behind,
				aheadMain: mainCounts?.ahead,
				behindMain: mainCounts?.behind,
				mergedIntoDevelop: mergedDevelop,
				mergedIntoMain: mergedMain,
				mergedAtDevelop: mergedDevelop && developRef ? mergedAt(repoPath, branch, developRef) : undefined,
				mergedAtMain: mergedMain && mainRef ? mergedAt(repoPath, branch, mainRef) : undefined
			});
		} catch (err: any) {
			console.warn(`Skipping branch ${branch}: ${err?.message || err}`);
		}
	}

	return statuses;
}
