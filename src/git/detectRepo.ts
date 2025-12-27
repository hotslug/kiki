import * as path from 'path';
import { execGit } from './execGit';

export function detectRepoRoot(cwd: string): string | null {
	try {
		const output = execGit('rev-parse --show-toplevel', cwd);
		if (!output.trim()) {
			return null;
		}
		return path.resolve(output.trim());
	} catch {
		return null;
	}
}
