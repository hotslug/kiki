# Batch Delete Merged Branches

## Overview

The **Batch Delete Merged Branches** feature provides a safe, one-click way to clean up branches that have been merged into `develop` or `main`. This helps keep your branch list tidy and reduces repository clutter.

## Key Benefits

1. **Time-saving** - Delete multiple merged branches in one operation instead of one-by-one
2. **Safety-first** - Preview before deletion with automatic protection checks
3. **Smart filtering** - Automatically skips protected and active branches
4. **Clear feedback** - See exactly what will be deleted and why branches are skipped

## How It Works

### Accessing the Feature

Click the **"Delete Merged Branches"** button (🗑️ clear-all icon) in the Kiki view title bar, next to the "Create Branch" and "Refresh" buttons.

### Workflow

1. **Click button** → Kiki analyzes all branches
2. **Preview dialog appears** showing:
   - Number of branches that will be deleted
   - List of branches (with merge status and date)
   - Count of skipped branches (protected/active)
3. **User decides**:
   - "Delete All" → Proceeds with deletion
   - "Cancel" → Abort operation
4. **Results shown**:
   - Success: "✅ Deleted X branches"
   - Partial: "✅ Deleted X, ❌ Failed Y"
   - Failure: "❌ Failed to delete X branches"

### Example Scenarios

#### Scenario 1: Clean Deletion
```
Delete 5 merged branches?

  • feature/add-login (merged into develop) [2 weeks ago]
  • bugfix/fix-typo (merged into main) [1 week ago]
  • feature/new-api (merged into develop and main) [3 days ago]
  • hotfix/security-patch (merged into main) [yesterday]
  • feature/refactor (merged into develop) [1 month ago]

[Delete All] [Cancel]
```

Result:
```
✅ Deleted 5 branches
```

#### Scenario 2: Some Branches Skipped
```
Delete 3 merged branches?

  • feature/old-feature (merged into develop) [2 months ago]
  • bugfix/minor-fix (merged into main) [1 week ago]
  • feature/completed (merged into develop) [3 days ago]

(Skipping 2 branches: 1 active, 1 protected)

[Delete All] [Cancel]
```

Result:
```
✅ Deleted 3 branches

Note: Skipped 2 branches:
  - develop (protected)
  - feature/current (active - currently checked out)
```

#### Scenario 3: No Branches to Delete
```
No merged branches to delete. Found 2 merged branch(es) but all are active or protected.
```

This happens when:
- All merged branches are protected (`main`, `master`, `develop`, `development`)
- The only merged branch is the one currently checked out

#### Scenario 4: Some Deletions Failed
```
✅ Deleted 3 branches
❌ Failed to delete 1 branch:
  • feature/locked: error: The branch 'feature/locked' is not fully merged.
```

This can happen if:
- Git's `-d` flag prevents deletion (use `-D` manually if needed)
- Branch is locked or has other constraints

## Technical Details

### What Gets Deleted

A branch is **deletable** if **ALL** of these conditions are true:

1. ✅ **Merged** - Branch is merged into `origin/develop` OR `origin/main`
2. ✅ **Not Active** - Branch is not currently checked out
3. ✅ **Not Protected** - Branch name is not in the protected list

### Protected Branches

These branches are **NEVER** deleted, even if merged:
- `main`
- `master`
- `develop`
- `development`

### Merge Detection

Uses Git's `merge-base --is-ancestor` to determine if a branch is fully merged:

```bash
git merge-base --is-ancestor <branch> origin/develop
git merge-base --is-ancestor <branch> origin/main
```

If either returns success (exit code 0), the branch is considered merged.

### Deletion Method

Uses Git's safe `-d` flag by default:

```bash
git branch -d <branch-name>
```

This prevents accidental deletion of unmerged work. If git refuses to delete with `-d`, you'll see an error and can manually force delete with:

```bash
git branch -D <branch-name>
```

## Implementation Details

### Core Functions

#### `previewDeleteMergedBranches(branches)`

**Input:** Array of `BranchStatus` objects
**Returns:** `BatchDeletePreview` object

```typescript
interface BatchDeletePreview {
	deletable: MergedBranchCandidate[];      // Safe to delete
	protected: MergedBranchCandidate[];      // Protected branch names
	active: MergedBranchCandidate[];         // Currently checked out
	totalMergedBranches: number;             // Total count
}
```

**Process:**
1. Filter branches that are merged into develop or main
2. Check each branch against protection rules
3. Check if branch is currently active
4. Categorize into deletable, protected, or active

#### `batchDeleteBranches(repoPath, branchNames, force)`

**Input:**
- `repoPath`: Repository path
- `branchNames`: Array of branch names to delete
- `force`: Use `-D` instead of `-d` (default: false)

**Returns:**
```typescript
{
	succeeded: string[];                     // Successfully deleted
	failed: Array<{                          // Failed deletions
		name: string;
		error: string;
	}>;
}
```

**Process:**
1. Loop through each branch name
2. Execute `git branch -d <name>`
3. Track successes and failures
4. Return results for user feedback

#### `formatMergedBranch(candidate)`

**Input:** `MergedBranchCandidate` object
**Returns:** Formatted string for display

**Format:**
```
<branch-name> (merged into develop|main|develop and main) [<time-ago>]
```

Examples:
- `feature/login (merged into develop) [2 weeks ago]`
- `bugfix/typo (merged into main) [yesterday]`
- `feature/auth (merged into develop and main) [3 days ago]`

### File Locations

- **Core logic**: [src/git/batchOperations.ts](../src/git/batchOperations.ts)
- **Command handler**: [src/extension.ts](../src/extension.ts) (`kiki.deleteMergedBranches`)
- **UI button**: [package.json](../package.json) (view/title menu)
- **Test script**: [test-batch-delete.js](../test-batch-delete.js)

## Testing

### Manual Testing

1. **Test Clean Deletion**:
   ```bash
   # Create and merge a test branch
   git checkout -b test/merged-branch develop
   echo "test" >> test.txt
   git add . && git commit -m "test"
   git push -u origin test/merged-branch

   # Merge it (via PR or locally)
   git checkout develop
   git merge test/merged-branch
   git push

   # Back to another branch
   git checkout main

   # In Kiki UI, click "Delete Merged Branches"
   # Expected: Shows test/merged-branch as deletable
   ```

2. **Test Protected Branch Skip**:
   ```bash
   # Try when on develop or main
   # Expected: "No merged branches to delete" (protected)
   ```

3. **Test Active Branch Skip**:
   ```bash
   # Checkout a merged branch
   git checkout some-merged-branch

   # Click "Delete Merged Branches"
   # Expected: Shows branch as skipped (active)
   ```

### Automated Testing

Run the test script:
```bash
npm run compile
node test-batch-delete.js
```

Output shows:
- Total merged branches
- How many are deletable vs. protected vs. active
- List of each category

## Safety Features

### Multiple Layers of Protection

1. **Preview Before Delete** - User sees exactly what will be deleted
2. **Modal Confirmation** - Requires explicit "Delete All" click
3. **Protected Branch List** - Hardcoded prevention of critical branch deletion
4. **Active Branch Check** - Cannot delete currently checked-out branch
5. **Git's Safety** - Uses `-d` flag which prevents deletion of unmerged work
6. **Individual Error Handling** - One failed deletion doesn't stop others
7. **Clear Result Reporting** - User knows exactly what succeeded/failed

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| No merged branches | Shows "No merged branches to delete" |
| All merged branches protected | Shows count but can't delete |
| Only active branch is merged | Shows "Skipping 1 branch: active" |
| Git deletion fails | Reports error per branch, continues with others |
| Repository not found | Shows error: "No Git repository found" |
| Fetch fails | Continues with potentially stale merge detection |

## User Experience

### Before This Feature

```
User wants to clean up 10 merged branches:
1. Click branch 1 → Delete → Confirm
2. Click branch 2 → Delete → Confirm
3. Click branch 3 → Delete → Confirm
... (repeat 10 times)

Time: ~2-3 minutes
Clicks: ~30
Risk: Might accidentally delete wrong branch
```

### After This Feature

```
User wants to clean up 10 merged branches:
1. Click "Delete Merged Branches" button
2. Review preview
3. Click "Delete All"

Time: ~10 seconds
Clicks: 2
Risk: Preview shows exact branches, hard to make mistakes
```

**Efficiency Improvement: ~95% time saved**

## Future Enhancements

### Potential Improvements

1. **Selective Deletion**:
   - Show checkboxes in preview
   - Let user uncheck branches to keep
   - "Delete Selected" instead of "Delete All"

2. **Stale Branch Detection**:
   - Highlight branches merged >3 months ago
   - "Delete old merged branches" option
   - Configurable age threshold

3. **Remote Deletion**:
   - Option to delete remote branches too
   - `git push origin --delete <branch>`
   - Separate confirmation for remote deletion

4. **Undo/Restore**:
   - Track deleted branch refs
   - "Undo last batch delete" command
   - Time-limited restoration (e.g., 24 hours)

5. **Grouping in Preview**:
   - Group by merge target (develop vs. main)
   - Group by age (last week, last month, older)
   - Group by prefix (feature/, bugfix/, etc.)

6. **Scheduling**:
   - "Auto-delete merged branches after 30 days"
   - Configurable in settings
   - Notification before auto-deletion

7. **Statistics**:
   - "You have cleaned up 47 branches this month"
   - Track storage saved
   - Show cleanup trends

8. **Dry-Run Export**:
   - Export list of deletable branches to JSON/CSV
   - Review outside IDE
   - Import back for deletion

## Configuration (Future)

Potential settings to add:

```json
{
	"kiki.batchDelete.includeRemote": false,
	"kiki.batchDelete.autoDelete": false,
	"kiki.batchDelete.autoDeleteAge": 30,
	"kiki.batchDelete.additionalProtectedBranches": [],
	"kiki.batchDelete.confirmationRequired": true
}
```

## Contributing

To extend this feature:

1. Review [src/git/batchOperations.ts](../src/git/batchOperations.ts)
2. Add new filtering logic to `previewDeleteMergedBranches`
3. Update preview UI in [src/extension.ts](../src/extension.ts)
4. Add configuration options in [package.json](../package.json)
5. Update this documentation

## Questions?

- File issues at: [github.com/anthropics/claude-code/issues](https://github.com/anthropics/claude-code/issues)
- See also: [smart-rebase-conflict-preview.md](smart-rebase-conflict-preview.md) for related hygiene feature
