/**
 * Test script for batch delete merged branches
 * Run with: node test-batch-delete.js
 */

const { execSync } = require('child_process');
const { getBranchStatuses } = require('./out/git/branchStatus');
const { previewDeleteMergedBranches, formatMergedBranch } = require('./out/git/batchOperations');

function testBatchDelete() {
	console.log('🧪 Testing Batch Delete Merged Branches\n');

	// Get current repo path
	const repoPath = process.cwd();
	console.log(`Repository: ${repoPath}\n`);

	// Get branch statuses
	console.log('Fetching branch statuses...');
	const branches = getBranchStatuses(repoPath);
	console.log(`Total branches: ${branches.length}\n`);

	// Preview delete
	console.log('--- Preview Delete Merged Branches ---');
	const preview = previewDeleteMergedBranches(branches);

	console.log(`\nTotal merged branches: ${preview.totalMergedBranches}`);
	console.log(`  - Deletable: ${preview.deletable.length}`);
	console.log(`  - Protected: ${preview.protected.length}`);
	console.log(`  - Active: ${preview.active.length}`);

	if (preview.deletable.length > 0) {
		console.log('\n✅ Deletable branches:');
		preview.deletable.forEach(b => {
			console.log(`  • ${formatMergedBranch(b)}`);
		});
	}

	if (preview.protected.length > 0) {
		console.log('\n🛡️ Protected branches (will be skipped):');
		preview.protected.forEach(b => {
			console.log(`  • ${b.name} - ${b.reason}`);
		});
	}

	if (preview.active.length > 0) {
		console.log('\n⚠️ Active branches (will be skipped):');
		preview.active.forEach(b => {
			console.log(`  • ${b.name} - ${b.reason}`);
		});
	}

	if (preview.deletable.length === 0) {
		console.log('\n✨ No merged branches to delete!');
		if (preview.totalMergedBranches > 0) {
			console.log('All merged branches are either protected or active.');
		}
	}

	console.log('\n✅ Tests completed');
	console.log('\nNote: This is a dry run - no branches were actually deleted.');
}

testBatchDelete();
