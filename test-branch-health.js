/**
 * Test script for branch health scoring
 * Run with: node test-branch-health.js
 */

const { getBranchStatuses } = require('./out/git/branchStatus');
const { calculateBranchHealth } = require('./out/git/branchHealth');

function testBranchHealth() {
	console.log('🏥 Testing Branch Health Scoring\n');

	// Get current repo path
	const repoPath = process.cwd();
	console.log(`Repository: ${repoPath}\n`);

	// Get branch statuses
	console.log('Analyzing branches...\n');
	const branches = getBranchStatuses(repoPath);

	// Calculate health for each branch
	const branchesWithHealth = branches.map(branch => ({
		...branch,
		health: calculateBranchHealth(branch)
	}));

	// Sort by health (critical first)
	const healthOrder = { 'critical': 0, 'attention': 1, 'healthy': 2 };
	branchesWithHealth.sort((a, b) => {
		const levelDiff = healthOrder[a.health.level] - healthOrder[b.health.level];
		if (levelDiff !== 0) return levelDiff;
		return a.health.score - b.health.score;
	});

	// Display results
	console.log('Branch Health Report');
	console.log('='.repeat(80));
	console.log('');

	const grouped = {
		critical: branchesWithHealth.filter(b => b.health.level === 'critical'),
		attention: branchesWithHealth.filter(b => b.health.level === 'attention'),
		healthy: branchesWithHealth.filter(b => b.health.level === 'healthy')
	};

	if (grouped.critical.length > 0) {
		console.log('CRITICAL (Needs Immediate Attention):');
		console.log('-'.repeat(80));
		grouped.critical.forEach(b => {
			console.log(`  ${b.name} (Score: ${b.health.score}/100)`);
			if (b.health.issues.length > 0) {
				b.health.issues.forEach(issue => {
					console.log(`    - ${issue}`);
				});
			}
			console.log('');
		});
	}

	if (grouped.attention.length > 0) {
		console.log('NEEDS ATTENTION:');
		console.log('-'.repeat(80));
		grouped.attention.forEach(b => {
			console.log(`  ${b.name} (Score: ${b.health.score}/100)`);
			if (b.health.issues.length > 0) {
				b.health.issues.forEach(issue => {
					console.log(`    - ${issue}`);
				});
			}
			console.log('');
		});
	}

	if (grouped.healthy.length > 0) {
		console.log('HEALTHY:');
		console.log('-'.repeat(80));
		grouped.healthy.forEach(b => {
			console.log(`  ${b.name} (Score: ${b.health.score}/100)`);
			console.log('');
		});
	}

	// Summary
	console.log('='.repeat(80));
	console.log('Summary:');
	console.log(`  Total branches: ${branches.length}`);
	console.log(`  Critical: ${grouped.critical.length}`);
	console.log(`  Needs Attention: ${grouped.attention.length}`);
	console.log(`  Healthy: ${grouped.healthy.length}`);
	console.log('');

	// Icon mapping
	console.log('VSCode Icon Mapping:');
	console.log('  Healthy (80-100):  "pass" icon (green)');
	console.log('  Attention (50-79): "warning" icon (yellow)');
	console.log('  Critical (0-49):   "error" icon (red)');
	console.log('');

	console.log('✅ Tests completed');
}

testBranchHealth();
