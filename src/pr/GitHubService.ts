import { Octokit } from '@octokit/rest';
import * as vscode from 'vscode';
import { execGit } from '../git/execGit';

export interface PullRequestInfo {
	number: number;
	title: string;
	state: 'open' | 'closed' | 'merged';
	url: string;
}

export class GitHubService {
	private octokit: Octokit | undefined;
	private owner: string | undefined;
	private repo: string | undefined;

	constructor() {
		this.initialize();
	}

	private initialize(): void {
		const config = vscode.workspace.getConfiguration('kiki.github');
		const token = config.get<string>('token', '');
		const enabled = config.get<boolean>('enabled', false);

		if (!enabled || !token) {
			this.octokit = undefined;
			return;
		}

		this.octokit = new Octokit({ auth: token });
		this.parseRemoteUrl();
	}

	private parseRemoteUrl(): void {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) return;

			const remoteUrl = execGit('config --get remote.origin.url', workspaceFolder.uri.fsPath).trim();

			// Parse GitHub URL (git@github.com:owner/repo.git or https://github.com/owner/repo.git)
			const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
			if (match) {
				this.owner = match[1];
				this.repo = match[2];
			}
		} catch (error) {
			console.warn('Kiki: Failed to parse GitHub remote URL:', error);
		}
	}

	async getPRForBranch(branchName: string): Promise<PullRequestInfo | null> {
		if (!this.octokit || !this.owner || !this.repo) {
			return null;
		}

		try {
			const { data: prs } = await this.octokit.pulls.list({
				owner: this.owner,
				repo: this.repo,
				head: `${this.owner}:${branchName}`,
				state: 'all'
			});

			if (prs.length === 0) return null;

			const pr = prs[0];
			return {
				number: pr.number,
				title: pr.title,
				state: pr.merged_at ? 'merged' : pr.state as 'open' | 'closed',
				url: pr.html_url
			};
		} catch (error) {
			console.error('Kiki: GitHub API error:', error);
			return null;
		}
	}

	reload(): void {
		this.initialize();
	}
}
