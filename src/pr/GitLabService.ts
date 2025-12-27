import { Gitlab } from '@gitbeaker/rest';
import * as vscode from 'vscode';
import { execGit } from '../git/execGit';

export interface MergeRequestInfo {
	number: number;
	title: string;
	state: 'open' | 'closed' | 'merged';
	url: string;
}

export class GitLabService {
	private gitlab: InstanceType<typeof Gitlab> | undefined;
	private projectId: string | undefined;

	constructor() {
		this.initialize();
	}

	private initialize(): void {
		const config = vscode.workspace.getConfiguration('kiki.gitlab');
		const token = config.get<string>('token', '');
		const enabled = config.get<boolean>('enabled', false);
		const host = config.get<string>('url', 'https://gitlab.com');

		if (!enabled || !token) {
			this.gitlab = undefined;
			return;
		}

		this.gitlab = new Gitlab({ host, token });
		this.parseRemoteUrl();
	}

	private parseRemoteUrl(): void {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) return;

			const remoteUrl = execGit('config --get remote.origin.url', workspaceFolder.uri.fsPath).trim();

			// Parse GitLab URL (git@gitlab.com:owner/repo.git or https://gitlab.com/owner/repo.git)
			const match = remoteUrl.match(/gitlab\.com[:/](.+?)(\.git)?$/);
			if (match) {
				this.projectId = match[1]; // Full path like "owner/repo"
			}
		} catch (error) {
			console.warn('Kiki: Failed to parse GitLab remote URL:', error);
		}
	}

	async getMRForBranch(branchName: string): Promise<MergeRequestInfo | null> {
		if (!this.gitlab || !this.projectId) {
			return null;
		}

		try {
			const mrs = await this.gitlab.MergeRequests.all({
				projectId: this.projectId,
				sourceBranch: branchName
			});

			if (!Array.isArray(mrs) || mrs.length === 0) return null;

			const mr = mrs[0];
			const iid = typeof mr.iid === 'number' ? mr.iid : parseInt(String(mr.iid), 10);
			const title = String(mr.title || '');
			const webUrl = String(mr.web_url || '');
			const state = mr.state === 'merged' ? 'merged' : (mr.state === 'closed' ? 'closed' : 'open');

			return {
				number: iid,
				title: title,
				state: state,
				url: webUrl
			};
		} catch (error) {
			console.error('Kiki: GitLab API error:', error);
			return null;
		}
	}

	reload(): void {
		this.initialize();
	}
}
