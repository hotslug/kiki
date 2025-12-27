import { BranchStatus } from './branchStatus';

export type HealthLevel = 'healthy' | 'attention' | 'critical';

export interface BranchHealth {
	level: HealthLevel;
	score: number; // 0-100, higher is healthier
	icon: string; // VSCode codicon name
	iconColor: string; // ThemeColor name
	issues: string[]; // List of problems
	details: string; // Tooltip text
}

/**
 * Calculate health score for a branch based on multiple factors
 *
 * Score breakdown (100 points total):
 * - 40 points: Drift/sync status (not behind develop)
 * - 25 points: Recency (has recent commits)
 * - 20 points: PR state (has open PR or merged)
 * - 15 points: No conflicts expected
 *
 * Health levels:
 * - Healthy (80-100): "pass" icon, green
 * - Attention (50-79): "warning" icon, yellow
 * - Critical (0-49): "error" icon, red
 */
export function calculateBranchHealth(branch: BranchStatus): BranchHealth {
	let score = 0;
	const issues: string[] = [];

	// Factor 1: Drift/Sync Status (40 points)
	const behindDevelop = branch.behindDevelop ?? branch.behind ?? 0;
	const aheadDevelop = branch.aheadDevelop ?? branch.ahead ?? 0;

	if (behindDevelop === 0) {
		score += 40; // Up to date
	} else if (behindDevelop <= 5) {
		score += 30; // Slightly behind
		issues.push(`${behindDevelop} commit${behindDevelop !== 1 ? 's' : ''} behind develop`);
	} else if (behindDevelop <= 20) {
		score += 15; // Moderately behind
		issues.push(`${behindDevelop} commits behind develop`);
	} else {
		score += 0; // Significantly behind
		issues.push(`${behindDevelop} commits behind develop (stale)`);
	}

	// Factor 2: Recency - Estimate based on drift (25 points)
	// If branch is merged, give full points
	if (branch.mergedIntoDevelop || branch.mergedIntoMain) {
		score += 25; // Merged branches are "complete"
	} else if (aheadDevelop === 0 && behindDevelop === 0) {
		score += 25; // Perfectly synced
	} else if (aheadDevelop > 0) {
		// Has commits - assume active
		if (aheadDevelop >= 1 && aheadDevelop <= 10) {
			score += 25; // Active development
		} else if (aheadDevelop > 10) {
			score += 20; // Lots of commits, might be stale
			if (behindDevelop > 10) {
				issues.push('Large divergence from develop');
			}
		}
	} else {
		// No commits ahead, only behind - likely inactive
		if (behindDevelop > 20) {
			score += 5; // Very stale
			issues.push('No recent activity');
		} else {
			score += 15; // Somewhat stale
		}
	}

	// Factor 3: PR State (20 points)
	if (branch.pr) {
		if (branch.pr.state === 'open') {
			score += 20; // Active PR
		} else if (branch.pr.state === 'merged') {
			score += 15; // PR merged (branch ready to delete)
		} else if (branch.pr.state === 'closed') {
			score += 5; // PR closed but not merged
			issues.push('PR closed without merge');
		}
	} else {
		// No PR
		if (branch.mergedIntoDevelop || branch.mergedIntoMain) {
			score += 15; // Merged without PR (direct push)
		} else if (aheadDevelop > 0) {
			score += 10; // Has commits but no PR yet
			if (aheadDevelop >= 5) {
				issues.push('No PR created yet');
			}
		} else {
			score += 10; // No work yet
		}
	}

	// Factor 4: Conflicts/Needs Rebase (15 points)
	if (branch.needsRebase) {
		score += 0; // Needs rebase (diverged)
		issues.push('Needs rebase (diverged)');
	} else if (behindDevelop > 0) {
		score += 5; // Behind but can fast-forward
	} else {
		score += 15; // No rebase needed
	}

	// Special cases: Boost score for main branches and merged branches
	const isMainBranch = ['main', 'master', 'develop', 'development'].includes(branch.name);
	if (isMainBranch) {
		score = 100; // Main branches are always healthy
		issues.length = 0; // Clear issues
	}

	// Merged branches: Adjust score
	if (branch.mergedIntoDevelop || branch.mergedIntoMain) {
		if (!branch.isActive) {
			// Merged and not active = ready to delete (not critical, but attention needed for cleanup)
			score = Math.min(score, 70); // Cap at "attention" level
			issues.push('Ready to delete (merged)');
		}
	}

	// Determine health level
	let level: HealthLevel;
	let icon: string;
	let iconColor: string;

	if (score >= 80) {
		level = 'healthy';
		icon = 'pass';
		iconColor = 'testing.iconPassed';
	} else if (score >= 50) {
		level = 'attention';
		icon = 'warning';
		iconColor = 'list.warningForeground';
	} else {
		level = 'critical';
		icon = 'error';
		iconColor = 'list.errorForeground';
	}

	// Build details tooltip
	const details = buildHealthTooltip(branch, score, level, issues);

	return {
		level,
		score,
		icon,
		iconColor,
		issues,
		details
	};
}

/**
 * Build a detailed tooltip explaining the health score
 */
function buildHealthTooltip(
	branch: BranchStatus,
	score: number,
	level: HealthLevel,
	issues: string[]
): string {
	const lines: string[] = [];

	// Header
	const levelText = level === 'healthy' ? 'Healthy' : level === 'attention' ? 'Needs Attention' : 'Critical';
	lines.push(`Branch Health: ${levelText} (${score}/100)`);

	// Issues
	if (issues.length > 0) {
		lines.push('');
		lines.push('Issues:');
		issues.forEach(issue => {
			lines.push(`  • ${issue}`);
		});
	}

	// Status summary
	lines.push('');
	lines.push('Status:');

	const behindDevelop = branch.behindDevelop ?? branch.behind ?? 0;
	const aheadDevelop = branch.aheadDevelop ?? branch.ahead ?? 0;

	if (behindDevelop > 0) {
		lines.push(`  • ${behindDevelop} commit${behindDevelop !== 1 ? 's' : ''} behind develop`);
	}
	if (aheadDevelop > 0) {
		lines.push(`  • ${aheadDevelop} commit${aheadDevelop !== 1 ? 's' : ''} ahead of develop`);
	}
	if (branch.pr) {
		lines.push(`  • PR: ${branch.pr.state.toUpperCase()} (#${branch.pr.number})`);
	}
	if (branch.mergedIntoDevelop || branch.mergedIntoMain) {
		const targets: string[] = [];
		if (branch.mergedIntoDevelop) targets.push('develop');
		if (branch.mergedIntoMain) targets.push('main');
		lines.push(`  • Merged into ${targets.join(' and ')}`);
	}

	return lines.join('\n');
}

/**
 * Compare two branches by health score for sorting
 * Returns: negative if a is healthier, positive if b is healthier
 *
 * Sort order:
 * 1. Active branch first
 * 2. Main branches (main, develop) next
 * 3. Then by health level (critical → attention → healthy)
 * 4. Within same level, sort by score (lower score first = needs more attention)
 * 5. Tie-breaker: commits behind develop
 */
export function compareByHealth(a: BranchStatus & { health?: BranchHealth }, b: BranchStatus & { health?: BranchHealth }): number {
	// Active branch always first
	if (a.isActive && !b.isActive) return -1;
	if (!a.isActive && b.isActive) return 1;

	// Main branches always near top (after active)
	const aIsMain = ['main', 'master', 'develop', 'development'].includes(a.name);
	const bIsMain = ['main', 'master', 'develop', 'development'].includes(b.name);
	if (aIsMain && !bIsMain) return -1;
	if (!aIsMain && bIsMain) return 1;

	// If no health scores calculated yet, fall back to drift
	if (!a.health || !b.health) {
		const aBehind = a.behindDevelop ?? a.behind ?? 0;
		const bBehind = b.behindDevelop ?? b.behind ?? 0;
		return bBehind - aBehind; // More behind = higher priority
	}

	// Sort by health level (critical first, then attention, then healthy)
	const levelOrder = { 'critical': 0, 'attention': 1, 'healthy': 2 };
	const levelDiff = levelOrder[a.health.level] - levelOrder[b.health.level];
	if (levelDiff !== 0) return levelDiff;

	// Within same level, lower score first (needs more attention)
	const scoreDiff = a.health.score - b.health.score;
	if (scoreDiff !== 0) return scoreDiff;

	// Tie-breaker: commits behind develop
	const aBehind = a.behindDevelop ?? a.behind ?? 0;
	const bBehind = b.behindDevelop ?? b.behind ?? 0;
	return bBehind - aBehind;
}
