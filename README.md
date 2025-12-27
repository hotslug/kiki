<img src="media/logo.png" alt="Kiki logo" />

# Kiki – Git Branch Companion for VS Code

Kiki gives you a branch-centric view of your repo with dual-base awareness (develop and main), merge-state insights, and quick actions to keep branches clean.

## Key Features
- Grouped tree view (Main, Feature, Bug Fixes, Other, Merged) under the Kiki activity bar container.
- Per-branch deltas vs both `origin/develop` and `origin/main` (divergence, behind/ahead, needs rebase).
- Merge-state detection with inclusion timestamps; merged branches are tucked into a collapsed group.
- **Smart Rebase Conflict Preview** – See potential conflicts before rebasing, with force-push warnings.
- **Batch Delete Merged Branches** – One-click cleanup of merged branches with safety checks and preview.
- Inline actions: checkout, pull, push, rebase, merge `origin/develop` into a branch, delete, create, copy name, open PR (when available).
- PR/MR awareness for GitHub/GitLab/BitBucket (optional tokens).
- Detail rows with meaningful icons and a one-click "Rebase" when diverged.

## Setup & Run
1) `npm install`
2) `npm run watch` (or `npm run compile` once)
3) Press `F5` to launch the Extension Host with Kiki.
4) Open a Git repo; Kiki appears in the activity bar as its own container. The view activates on demand (`onView:kikiView` if configured).

## Using the View
- Branch items show develop/main drift; expand a branch to see base/develop/main deltas, merge status/dates, rebase prompt, and PR info.
- Right-click a branch for actions (checkout, pull/push, rebase, merge develop, delete, copy name, open PR).
- Merged branches are auto-collapsed in "Merged Branches" to reduce noise.

### Smart Rebase Conflict Preview
Before executing a rebase, Kiki shows you:
- ✅ **Clean rebase** – "0 conflicts expected" (safe to proceed)
- ⚠️ **Conflicts detected** – List of files that will conflict
- 🔄 **Force push warning** – Alert when rebase will require force pushing

This helps you make informed decisions and avoid surprise conflicts. See [docs/smart-rebase-conflict-preview.md](docs/smart-rebase-conflict-preview.md) for details.

### Batch Delete Merged Branches
One-click cleanup of branches that have been merged into develop or main:
- 🗑️ **Click button** in view title bar
- 📋 **Preview** shows exactly what will be deleted (with merge dates)
- 🛡️ **Automatic protection** for main/develop and active branches
- ✅ **Clear results** showing successes and any failures

See [docs/batch-delete-merged-branches.md](docs/batch-delete-merged-branches.md) for details.

## Commands (palette/context)
- `kiki.refresh` – refresh view
- `kiki.checkoutBranch`
- `kiki.pullBranch`, `kiki.pushBranch`
- `kiki.rebaseBranch` – **now with smart conflict preview before execution**
- `kiki.mergeDevelop` (merge `origin/develop` into the branch)
- `kiki.deleteBranch` (warns on protected names)
- `kiki.deleteMergedBranches` – **batch delete all merged branches with preview**
- `kiki.createBranch`
- `kiki.copyBranchName`
- `kiki.openPR` (when PR data exists)

## Configuration (optional)
- `kiki.autoRefresh` (default true), `kiki.refreshInterval` (minutes)
- `kiki.github.enabled`, `kiki.github.token`
- `kiki.gitlab.enabled`, `kiki.gitlab.token`, `kiki.gitlab.url`
- `kiki.bitbucket.enabled`, `kiki.bitbucket.username`, `kiki.bitbucket.appPassword`

## Notes & Limitations
- Assumes remote is `origin`; base detection prefers `origin/HEAD`, then main/develop/master.
- Git operations run on the extension host; slow fetch/merge/rebase can block briefly.
- `mergeDevelop` and `rebaseBranch` execute Git commands; ensure you’re comfortable with these before running on important branches.
