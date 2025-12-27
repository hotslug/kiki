import { execGit } from './execGit';

export function getLocalBranches(repoPath: string): string[] {
	const output = execGit('for-each-ref --format="%(refname:short)" refs/heads', repoPath).trim();
	if (!output) {
		return [];
	}

	const branches = output.split('\n')
		.map(branch => branch.trim())
		.filter(branch => branch.length > 0);

	return Array.from(new Set(branches));
}
