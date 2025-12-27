/**
 * Simple test script for conflict preview functionality
 * Run with: node test-conflict-preview.js
 */

const { execSync } = require('child_process');
const path = require('path');

// Import the compiled JS version
const { previewRebaseConflicts, wouldRequireForcePush } = require('./out/git/conflictPreview');

function testConflictPreview() {
	console.log('🧪 Testing Smart Rebase Conflict Preview\n');

	// Get current repo path
	const repoPath = process.cwd();
	console.log(`Repository: ${repoPath}\n`);

	// Get current branch
	let currentBranch;
	try {
		currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
	} catch (err) {
		console.error('❌ Not in a git repository');
		process.exit(1);
	}

	console.log(`Current branch: ${currentBranch}`);

	// Get base branch (simulate getBaseBranch logic)
	let baseBranch;
	try {
		// Try origin/develop
		execSync('git rev-parse --verify origin/develop', { encoding: 'utf8', stdio: 'pipe' });
		baseBranch = 'origin/develop';
	} catch {
		try {
			// Try origin/main
			execSync('git rev-parse --verify origin/main', { encoding: 'utf8', stdio: 'pipe' });
			baseBranch = 'origin/main';
		} catch {
			console.error('❌ No base branch found (origin/develop or origin/main)');
			process.exit(1);
		}
	}

	console.log(`Base branch: ${baseBranch}\n`);

	// Test 1: Preview conflicts for current branch
	console.log('--- Test 1: Preview rebase conflicts ---');
	try {
		const preview = previewRebaseConflicts(repoPath, currentBranch, baseBranch);
		console.log(`Summary: ${preview.summary}`);
		console.log(`Has conflicts: ${preview.hasConflicts}`);
		console.log(`Conflict count: ${preview.conflictCount}`);
		if (preview.conflictedFiles.length > 0) {
			console.log(`Conflicted files:`);
			preview.conflictedFiles.forEach(file => console.log(`  - ${file}`));
		}
	} catch (err) {
		console.error(`❌ Error: ${err.message}`);
	}

	console.log('\n--- Test 2: Check if force push would be needed ---');
	try {
		const needsForcePush = wouldRequireForcePush(repoPath, currentBranch);
		console.log(`Would require force push: ${needsForcePush}`);
	} catch (err) {
		console.error(`❌ Error: ${err.message}`);
	}

	console.log('\n✅ Tests completed');
}

testConflictPreview();
