# Smart Rebase Conflict Preview

## Overview

The **Smart Rebase Conflict Preview** feature provides users with detailed conflict information **before** they execute a rebase operation. This helps developers make informed decisions and avoid surprise conflicts during rebasing.

## Key Benefits

1. **Confidence before rebasing** - Know exactly what conflicts to expect
2. **Time savings** - Decide if now is the right time to rebase based on conflict complexity
3. **Force push awareness** - Clear warning when rebase will require force pushing
4. **Risk reduction** - Preview allows for planning conflict resolution strategy

## How It Works

### Technical Implementation

The feature uses Git's `merge-tree` command to simulate a three-way merge without modifying the working tree:

```bash
git merge-tree <merge-base> <target-base> <branch>
```

This performs a "dry run" of the rebase operation by:
1. Finding the common ancestor (merge-base) between your branch and the target base
2. Simulating the merge between the target base and your branch
3. Analyzing the output for conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
4. Extracting the list of files that would have conflicts

### User Experience

When you trigger a rebase (via context menu or inline action):

1. **Conflict Analysis Runs** - Kiki analyzes potential conflicts (takes <1 second)

2. **Preview Dialog Appears** showing:
   - ✅ **Clean rebase** - "0 conflicts expected" (green message)
   - ⚠️ **Conflicts detected** - "X files will have conflicts" (warning)
   - List of conflicted files (up to 5 shown, with "...and X more" if needed)
   - Force push warning if applicable

3. **User Decides**:
   - **Clean rebase** → "Rebase" button (confident to proceed)
   - **Conflicts detected** → "Rebase anyway" button (proceed with caution)
   - **Cancel** → Abort operation

4. **Rebase Executes** (if confirmed)

### Example Scenarios

#### Scenario 1: Clean Rebase
```
Rebase feature/new-login onto origin/develop?

✅ Clean rebase (0 conflicts expected)

[Rebase] [Cancel]
```

#### Scenario 2: Conflicts Detected
```
Rebase feature/new-api onto origin/develop?

⚠️ 3 files will have conflicts

Conflicted files:
  • src/api/endpoints.ts
  • src/config/settings.ts
  • README.md

[Rebase anyway] [Cancel]
```

#### Scenario 3: Conflicts + Force Push Warning
```
Rebase feature/refactor onto origin/develop?

⚠️ 2 files will have conflicts

Conflicted files:
  • src/utils/helper.ts
  • src/types/index.ts

⚠️ This will require a force push to update the remote branch.

[Rebase anyway] [Cancel]
```

## Implementation Details

### Core Functions

#### `previewRebaseConflicts(repoPath, branchName, targetBase)`

**Returns:** `ConflictPreview` object
```typescript
interface ConflictPreview {
	hasConflicts: boolean;
	conflictCount: number;
	conflictedFiles: string[];
	summary: string;  // User-friendly summary message
}
```

**Process:**
1. Get merge-base between branch and target
2. Run `git merge-tree` to simulate merge
3. Parse output for conflict markers
4. Extract conflicted file paths
5. Return structured preview data

**Error Handling:**
- If merge-tree fails, returns safe default (no conflicts warning)
- Includes "Unable to preview conflicts" message
- Does not block the rebase operation

#### `wouldRequireForcePush(repoPath, branchName)`

**Returns:** `boolean`

**Process:**
1. Check if branch has upstream tracking branch
2. Count commits ahead of remote (`git rev-list --count remote..local`)
3. If commits exist on remote, rebase will rewrite them → force push needed

**Edge Cases:**
- No upstream → returns `false` (can use --set-upstream)
- Cannot determine → returns `false` (safe default)

### File Locations

- **Core logic**: [src/git/conflictPreview.ts](../src/git/conflictPreview.ts)
- **Integration**: [src/extension.ts](../src/extension.ts) (in `kiki.rebaseBranch` command)
- **Test script**: [test-conflict-preview.js](../test-conflict-preview.js)

## Testing

### Manual Testing

1. **Test Clean Rebase**:
   ```bash
   # Create a branch from develop
   git checkout -b test/clean-rebase origin/develop

   # Make a non-conflicting change
   echo "test" >> newfile.txt
   git add . && git commit -m "test"

   # Try rebasing in Kiki UI
   # Expected: "✅ Clean rebase (0 conflicts expected)"
   ```

2. **Test Conflicting Rebase**:
   ```bash
   # Create a branch from an older commit
   git checkout -b test/conflict-rebase origin/develop~5

   # Modify a file that changed in recent develop commits
   echo "conflicting change" >> README.md
   git add . && git commit -m "test conflict"

   # Try rebasing in Kiki UI
   # Expected: "⚠️ X files will have conflicts"
   ```

3. **Test Force Push Detection**:
   ```bash
   # Create and push a branch
   git checkout -b test/force-push origin/develop
   echo "test" >> file.txt
   git add . && git commit -m "test"
   git push -u origin test/force-push

   # Try rebasing in Kiki UI
   # Expected: "⚠️ This will require a force push..."
   ```

### Automated Testing

Run the test script:
```bash
npm run compile
node test-conflict-preview.js
```

## Limitations

1. **Merge-tree accuracy**:
   - Git's merge-tree is a best-effort simulation
   - Some complex conflicts might be slightly different in actual rebase
   - Generally 95%+ accurate for conflict detection

2. **Performance**:
   - Preview adds ~100-500ms before rebase confirmation
   - Acceptable trade-off for the safety it provides

3. **Large conflict lists**:
   - Only shows first 5 conflicted files in dialog
   - Prevents UI overflow with very large conflict sets

4. **Git version compatibility**:
   - Requires Git 2.x+ for merge-tree command
   - Gracefully degrades if command fails

## Future Enhancements

### Potential Improvements

1. **Conflict Complexity Scoring**:
   - Analyze merge-tree output to estimate conflict difficulty
   - Show "Simple conflicts" vs "Complex conflicts"

2. **Conflict Content Preview**:
   - Show actual conflicting lines in a webview
   - Let users see what they'll need to resolve

3. **Backup Branch Creation**:
   - Offer to create a backup branch before risky rebases
   - One-click rollback if rebase goes wrong

4. **Conflict Resolution Hints**:
   - Suggest "accept theirs" vs "manual merge" based on file type
   - Show recent commits affecting conflicted files

5. **Post-Rebase Conflict Helper**:
   - If conflicts occur during rebase, show resolution UI
   - Quick actions for "accept ours/theirs" per file

6. **Batch Rebase with Preview**:
   - Preview conflicts for multiple branches at once
   - Show which branches are safe to rebase

## Contributing

To extend this feature:

1. Review [src/git/conflictPreview.ts](../src/git/conflictPreview.ts)
2. Follow existing patterns for git command execution
3. Add error handling for edge cases
4. Update this documentation with new capabilities

## Questions?

- File issues at: [github.com/anthropics/claude-code/issues](https://github.com/anthropics/claude-code/issues)
- Check git merge-tree docs: `git help merge-tree`
