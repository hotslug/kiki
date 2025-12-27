import { execGit } from './execGit';

export function checkoutBranch(repoPath: string, branchName: string): void {
	execGit(`checkout ${branchName}`, repoPath);
}

export function deleteBranch(repoPath: string, branchName: string, force: boolean = false): void {
	const flag = force ? '-D' : '-d';
	execGit(`branch ${flag} ${branchName}`, repoPath);
}

export function rebaseBranch(repoPath: string, branchName: string, baseBranch: string): void {
	// Checkout target branch first
	execGit(`checkout ${branchName}`, repoPath);
	// Rebase onto base
	execGit(`rebase ${baseBranch}`, repoPath);
}

export function pushBranch(repoPath: string, branchName: string, setUpstream: boolean = false): void {
	const upstreamFlag = setUpstream ? '--set-upstream origin' : '';
	execGit(`push ${upstreamFlag} ${branchName}`, repoPath);
}

export function pullBranch(repoPath: string, branchName: string): void {
	execGit(`checkout ${branchName}`, repoPath);
	execGit(`pull`, repoPath);
}

export function createBranch(repoPath: string, newBranchName: string, baseBranch: string): void {
	// Create and checkout new branch from base
	execGit(`checkout -b ${newBranchName} ${baseBranch}`, repoPath);
}
