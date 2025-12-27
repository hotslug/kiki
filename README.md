<img src="media/logo.png" alt="Kiki logo" />

# Kiki – Git Branch Companion for VS Code

Kiki gives you a branch-centric view of your repo with dual-base awareness (develop and main), merge-state insights, and quick actions to keep branches clean.

## Quick Start

1. `npm install`
2. `npm run watch` (or `npm run compile` once)
3. Press `F5` to launch the Extension Host with Kiki
4. Open a Git repo; Kiki appears in the activity bar

## Key Features

### Status Bar Drift Alert
Always-visible branch status in the VSCode status bar (bottom-left):
- **Live drift indicators**: Shows current branch with develop drift at a glance
- **Smart icons**: Warning when behind, checkmark when synced, arrow when ahead
- **Click for actions**: Quick access to merge/rebase options
- **Detailed tooltip**: Full develop/main status, PR info on hover

Display examples:
```
$(pass) feature/current ✓           ← Up to date
$(arrow-up) feature/new ↓0 ↑5       ← 5 commits ahead
$(sync) feature/work ↓3 ↑2          ← Behind, needs sync
$(warning) feature/old ↓12 ↑1       ← Behind 10+, needs rebase
```

Click the status bar item for quick actions:
- Merge origin/develop into current branch
- Rebase current branch onto develop
- Refresh Kiki view

### Branch Health Score
Color-coded icons show branch status at a glance:
- **Green checkmark** (80-100) - Healthy: up-to-date and ready
- **Yellow warning** (50-79) - Needs attention: rebase or create PR
- **Red error** (0-49) - Critical: stale or has significant issues

**Scoring factors:**
- Drift/sync status (40 pts) - How far behind develop
- Activity/recency (25 pts) - Has recent commits or is stale
- PR state (20 pts) - Has PR, PR status
- Rebase status (15 pts) - Needs rebase or can fast-forward

Branches automatically sort by health (critical first). Click to expand any branch and see:
```
⚠️ feature/api-refactor
├── ⚠️ Health: Needs Attention (68/100)
├── ℹ️ 12 commits behind develop
├── ℹ️ No PR created yet
├── ℹ️ Develop: ↑3 ↓12
└── ⚠️ Rebase onto develop/base (click to rebase)
```

### Smart Rebase Conflict Preview
Before executing a rebase, see exactly what to expect:
- **Clean rebase**: "0 conflicts expected" → proceed with confidence
- **Conflicts detected**: Shows file list + conflict count
- **Force push warning**: Alerts when rebase will require force push

Uses `git merge-tree` to simulate the rebase without modifying your working tree.

### Batch Delete Merged Branches
One-click cleanup of merged branches:
1. Click "Delete Merged Branches" button in view title
2. Preview shows what will be deleted (with merge dates)
3. Automatic protection for main/develop and active branches
4. Clear results in output channel

## Tree View Overview

```
KIKI
├── [+ Create Branch]  [🗑️ Delete Merged]  [↻ Refresh]
│
├── Main Branches (2)
│   ├── ✅ develop                     ✓
│   └── ✅ main                        ✓
│
├── Feature Branches (8)
│   ├── ❌ feature/old-api             ↑2 ↓45 [CLOSED]    ← Critical
│   ├── ⚠️ feature/needs-rebase        ↑8 ↓15             ← Attention
│   ├── ⚠️ feature/merged-login        ✓ [MERGED]         ← Ready to delete
│   └── ✅ feature/current-work        ↑5 [PR #890]       ← Healthy
│
└── Merged Branches (collapsed) (12)
```

## Workflow Examples

### Daily Branch Hygiene (2-5 minutes)
1. Open Kiki view
2. Look for red icons → Address critical branches
3. Check yellow icons → Schedule rebase/PR work
4. Green icons → All good, continue work

### Before Creating PR
1. Check branch health score
2. If yellow/red → click to see issues
3. Rebase if behind develop (with conflict preview)
4. Create PR when healthy (green)

### Weekly Cleanup
1. Click "Delete Merged Branches"
2. Review preview
3. Delete all in one click
4. Check remaining yellow branches

## All Commands

- `kiki.refresh` – Refresh view
- `kiki.checkoutBranch` – Switch to branch
- `kiki.pullBranch` – Pull latest
- `kiki.pushBranch` – Push commits
- `kiki.rebaseBranch` – Rebase with conflict preview
- `kiki.mergeDevelop` – Merge origin/develop into branch
- `kiki.deleteBranch` – Delete single branch (protected)
- `kiki.deleteMergedBranches` – Batch delete merged branches
- `kiki.createBranch` – Create new branch with prefix selection
- `kiki.copyBranchName` – Copy branch name to clipboard
- `kiki.openPR` – Open PR/MR in browser
- `kiki.statusBarActions` – Quick actions menu from status bar

## Configuration

```json
{
  "kiki.autoRefresh": true,
  "kiki.refreshInterval": 5,
  "kiki.github.enabled": false,
  "kiki.github.token": "",
  "kiki.gitlab.enabled": false,
  "kiki.gitlab.token": "",
  "kiki.gitlab.url": "https://gitlab.com",
  "kiki.bitbucket.enabled": false,
  "kiki.bitbucket.username": "",
  "kiki.bitbucket.appPassword": ""
}
```

## Feature Details

### Status Bar Drift Alert

**How it works:**
- Automatically updates whenever branches change (checkout, rebase, merge, etc.)
- Positioned in bottom-left status bar with high priority (always visible)
- Shows most critical info: current branch + develop drift
- Click to open quick actions menu

**Display format:**
```
[icon] [branch-name] [drift-indicator]
```

**Icons used:**
| Icon | Meaning | Trigger |
|------|---------|---------|
| `$(pass)` | Up to date | 0 ahead, 0 behind develop |
| `$(arrow-up)` | Ahead only | commits ahead, 0 behind |
| `$(sync)` | Behind 1-10 | needs sync, not critical |
| `$(warning)` | Critical | behind 10+ or needs rebase |

**Drift indicators:**
- `✓` - perfectly synced with develop
- `↓3 ↑2` - 3 behind, 2 ahead
- `↓0 ↑5` - 5 ahead, ready to push

**Tooltip (hover):**
Shows full details:
```
Branch: feature/new-api

Develop: ↑5 ↓0
Main: ↑7 ↓2

GitHub PR #123: OPEN

→ Click for quick actions
```

**Quick actions (click):**
When you click the status bar item, you get a menu with:
1. **Merge origin/develop into current branch** - brings develop into your branch
2. **Rebase current branch onto develop** - rebases with conflict preview
3. **Refresh Kiki** - updates all views

Actions are context-aware: merge/rebase only show when behind develop.

**Benefits:**
- **Always visible** - no need to open Kiki tree view
- **At-a-glance status** - see drift immediately
- **One-click actions** - merge/rebase from anywhere
- **Works everywhere** - visible in all editors, no matter what file is open

### Branch Health Score

**How it works:**
- Calculates 0-100 score based on 4 factors
- Shows health as first item when branch is expanded
- Lists specific issues (e.g., "12 commits behind develop")
- Automatically sorts branches by health within each group

**Health levels:**
| Score | Icon | Color | Meaning |
|-------|------|-------|---------|
| 80-100 | `pass` | Green | Healthy - ready to work |
| 50-79 | `warning` | Yellow | Needs attention - rebase or PR |
| 0-49 | `error` | Red | Critical - stale or issues |

**Special cases:**
- Main branches (main, master, develop) always get 100 points
- Merged branches capped at 70 points with "Ready to delete" issue
- Active branch always appears first regardless of score

**Expand any branch to see:**
```
├── ⚠️ Health: Needs Attention (68/100)
├── ℹ️ 12 commits behind develop
├── ℹ️ No PR created yet
├── ℹ️ Base: ↑3 ↓12
├── ℹ️ Develop: ↑3 ↓12
├── ℹ️ Main: ↑3 ↓15
├── ⚠️ Needs rebase: yes
└── ⚠️ Rebase onto develop/base
```

### Smart Rebase Conflict Preview

**How it works:**
1. Uses `git merge-tree` to simulate three-way merge
2. Parses output for conflict markers
3. Extracts conflicted file paths
4. Shows preview dialog before actual rebase

**Preview scenarios:**

**Clean rebase:**
```
Rebase feature/new-api onto origin/develop?

Clean rebase (0 conflicts expected)

[Rebase] [Cancel]
```

**Conflicts detected:**
```
Rebase feature/old-api onto origin/develop?

3 files will have conflicts

Conflicted files:
  • src/api/endpoints.ts
  • src/config/settings.ts
  • README.md

⚠ This will require a force push to update the remote branch.

[Rebase anyway] [Cancel]
```

**Benefits:**
- Avoid surprise conflicts mid-rebase
- Plan conflict resolution time
- Know force push requirements upfront
- Make informed decisions about when to rebase

### Batch Delete Merged Branches

**How it works:**
1. Analyzes all branches for merge status (using `git merge-base --is-ancestor`)
2. Categorizes as: deletable, protected, or active
3. Shows preview with merge dates
4. Executes safe deletion (`git branch -d`)

**Safety features:**
- Protected branches (main, master, develop, development) never deleted
- Active branch (currently checked out) never deleted
- Preview shows exactly what will be deleted
- Uses `-d` flag (prevents deletion of unmerged work)
- Individual error handling (one failure doesn't stop others)

**Preview dialog:**
```
Delete 5 merged branches?

  • feature/old-login (merged into develop) [2 weeks ago]
  • bugfix/typo (merged into main) [1 week ago]
  • feature/api-v1 (merged into develop and main) [3 days ago]

(Skipping 2 branches: 1 active, 1 protected)

[Delete All] [Cancel]
```

**Results (in output channel):**
```
Delete Merged Branches Results
==================================================

Deleted 7 branches:
  - feature/old-auth
  - bugfix/typo
  - feature/api-v1

Could not delete 1 branch:

  Branch: feature/ability-to-add
  Reason: Not fully merged to origin/feature/ability-to-add
  Fix:    git branch -D feature/ability-to-add
```

## Technical Details

### Architecture
- **TypeScript** with strict typing
- **Git CLI wrapper** via Node.js `execSync`
- **Octokit** for GitHub, **@gitbeaker** for GitLab, **bitbucket** lib for BitBucket
- **VSCode Extension API** for all UI components

### Dual-Base Tracking
- Tracks drift against both `origin/develop` AND `origin/main`
- Merge detection with timestamps for both bases
- Base branch auto-detection: `origin/HEAD` → main → develop → master

### Performance
- Branch health calculation: <1ms per branch
- Conflict preview: ~100-500ms
- Batch operations: ~50-100ms per branch
- All operations use local git (no network calls for calculations)

### Git Commands Used
```bash
# Branch management
git for-each-ref
git branch --show-current
git checkout <branch>
git branch -d <branch>

# Status detection
git rev-list --left-right --count <base>...<branch>
git merge-base --is-ancestor <branch> <target>
git log --format=%cI --reverse --ancestry-path

# Conflict preview
git merge-base <branch> <target>
git merge-tree <base> <target> <branch>
```

## Why Kiki vs. Other Tools

### vs. VSCode Built-in Source Control
- VSCode SCM is **file-centric** (staging, commits, diffs)
- Kiki is **branch-centric** (health, drift, hygiene)
- VSCode has no: health scores, conflict preview, batch operations
- Kiki complements VSCode SCM (use both!)

### vs. GitLens
- GitLens focuses on: blame, history, visual exploration
- Kiki focuses on: branch health, proactive hygiene
- GitLens is reactive, Kiki is proactive
- No overlap - they solve different problems

### vs. Git Graph
- Git Graph: Beautiful commit graph visualization
- Kiki: Practical branch management and cleanup
- Git Graph is for understanding history
- Kiki is for maintaining branch hygiene

### Kiki's Unique Value
- **Only extension** with branch health scoring
- **Only extension** with rebase conflict preview
- **Only extension** with protected batch delete
- **Proactive** not reactive - prevents problems

## Testing

### Manual Testing
```bash
# Test health scoring
node test-branch-health.js

# Test conflict preview
node test-conflict-preview.js

# Test batch delete
node test-batch-delete.js
```

### Running the Extension
1. Press `F5` in VSCode to launch Extension Development Host
2. Open a Git repository
3. Click Kiki icon in activity bar
4. Try the features!

## Troubleshooting

**Branch not showing up?**
- Click refresh button
- Check `.git/HEAD` file exists
- Ensure `git branch` works in terminal

**PR info not showing?**
- Enable in settings: `kiki.github.enabled: true`
- Add personal access token: `kiki.github.token`
- Check token has repo permissions

**Conflict preview not working?**
- Ensure Git version 2.x+
- Check `git merge-tree` command works
- Falls back gracefully if unavailable

**Batch delete failed?**
- Check output channel for details
- Some branches may need `-D` force delete
- Protected branches are never deleted

## Contributing

1. Review [src/git/](src/git/) for core logic
2. Review [src/tree/](src/tree/) for UI components
3. Follow existing patterns
4. Add tests for new features
5. Update this README

## Notes & Limitations

- Assumes remote is `origin`
- Git operations run synchronously (may block briefly)
- Conflict preview is best-effort (~95% accurate)
- No multi-repo support (single repo at a time)
- Requires Git 2.x+ for all features

## License

MIT

## Credits

Built with ❤️ for developers who care about branch hygiene
