import { execGit } from './execGit';

function resolveSymbolicBase(repoPath: string): string | null {
	try {
		const output = execGit('symbolic-ref refs/remotes/origin/HEAD', repoPath);
		const stripped = output.replace(/^refs\/remotes\//, '');
		if (stripped.startsWith('origin/')) {
			return stripped;
		}
		return null;
	} catch {
		return null;
	}
}

function verifyRemoteBranch(repoPath: string, ref: string): boolean {
	try {
		execGit(`rev-parse --verify ${ref}`, repoPath);
		return true;
	} catch {
		return false;
	}
}

export function getBaseBranch(repoPath: string): string {
	const symbolic = resolveSymbolicBase(repoPath);
	if (symbolic) {
		return symbolic;
	}

	// Try remote branches first
	const remoteCandidates = ['origin/main', 'origin/develop', 'origin/master'];
	for (const candidate of remoteCandidates) {
		if (verifyRemoteBranch(repoPath, candidate)) {
			return candidate;
		}
	}

	// Fall back to local branches if no remote
	const localCandidates = ['main', 'develop', 'master'];
	for (const candidate of localCandidates) {
		if (verifyRemoteBranch(repoPath, candidate)) {
			return candidate;
		}
	}

	// Last resort: just use 'main' even if it doesn't exist
	// (better than crashing)
	console.warn('Kiki: No base branch found, defaulting to "main"');
	return 'main';
}
