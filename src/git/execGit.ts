import { execSync } from 'child_process';

function formatGitError(args: string, cwd: string, stderr: string, stdout: string): string {
	const errorMsg = stderr.trim() || stdout.trim() || 'Unknown error';
	return `Git command failed: git ${args}\n  in ${cwd}\n  ${errorMsg}`;
}

export function execGit(args: string, cwd: string): string {
	try {
		const output = execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
		return output.trim();
	} catch (err: any) {
		const stderr = err?.stderr ? err.stderr.toString() : '';
		const stdout = err?.stdout ? err.stdout.toString() : '';
		throw new Error(formatGitError(args, cwd, stderr, stdout));
	}
}
