import { Bitbucket } from 'bitbucket';
import * as vscode from 'vscode';
import { execGit } from '../git/execGit';

export interface PullRequestInfo {
	number: number;
	title: string;
	state: 'open' | 'closed' | 'merged';
	url: string;
}

export class BitBucketService {
	private bitbucket: InstanceType<typeof Bitbucket> | undefined;
	private workspace: string | undefined;
	private repoSlug: string | undefined;

	constructor() {
		this.initialize();
	}

	private initialize(): void {
		const config = vscode.workspace.getConfiguration('kiki.bitbucket');
		const username = config.get<string>('username', '');
		const appPassword = config.get<string>('appPassword', '');
		const enabled = config.get<boolean>('enabled', false);

		if (!enabled || !username || !appPassword) {
			this.bitbucket = undefined;
			return;
		}

		this.bitbucket = new Bitbucket({
			auth: {
				username: username,
				password: appPassword
			}
		});
		this.parseRemoteUrl();
	}

	private parseRemoteUrl(): void {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) return;

			const remoteUrl = execGit('config --get remote.origin.url', workspaceFolder.uri.fsPath).trim();

			// Parse BitBucket URL (git@bitbucket.org:workspace/repo.git or https://bitbucket.org/workspace/repo.git)
			const match = remoteUrl.match(/bitbucket\.org[:/]([^/]+)\/(.+?)(\.git)?$/);
			if (match) {
				this.workspace = match[1];
				this.repoSlug = match[2];
			}
		} catch (error) {
			console.warn('Kiki: Failed to parse BitBucket remote URL:', error);
		}
	}

	async getPRForBranch(branchName: string): Promise<PullRequestInfo | null> {
		if (!this.bitbucket || !this.workspace || !this.repoSlug) {
			return null;
		}

		try {
			// Try to fetch open PRs first
			let response = await this.bitbucket.pullrequests.list({
				workspace: this.workspace,
				repo_slug: this.repoSlug
			});

			let prs = response.data.values || [];
			let pr = prs.find((p: any) => p.source?.branch?.name === branchName);

			// If not found in open PRs, try merged
			if (!pr) {
				response = await this.bitbucket.pullrequests.list({
					workspace: this.workspace,
					repo_slug: this.repoSlug,
					state: 'MERGED'
				});
				prs = response.data.values || [];
				pr = prs.find((p: any) => p.source?.branch?.name === branchName);
			}

			// If not found in merged, try declined
			if (!pr) {
				response = await this.bitbucket.pullrequests.list({
					workspace: this.workspace,
					repo_slug: this.repoSlug,
					state: 'DECLINED'
				});
				prs = response.data.values || [];
				pr = prs.find((p: any) => p.source?.branch?.name === branchName);
			}

			if (!pr) return null;

			const state = pr.state === 'MERGED' ? 'merged' : (pr.state === 'DECLINED' ? 'closed' : 'open');
			const number = pr.id || 0;
			const title = String(pr.title || '');
			const url = pr.links?.html?.href || '';

			return {
				number: number,
				title: title,
				state: state,
				url: url
			};
		} catch (error) {
			console.error('Kiki: BitBucket API error:', error);
			return null;
		}
	}

	reload(): void {
		this.initialize();
	}
}
