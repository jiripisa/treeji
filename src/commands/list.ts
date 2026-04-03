import { Command } from 'commander';
import chalk from 'chalk';
import {
  gitWorktreeList,
  gitStatusPorcelain,
  gitAheadBehind,
  gitLastCommitRelativeDate,
  parseWorktreeList,
} from '../lib/git.js';
import { fetchIssueStatuses } from '../lib/jira.js';

function extractTicketKey(branch: string | null | undefined): string | null {
  if (!branch) return null;
  const match = branch.match(/([A-Za-z]+-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

export function colorStatus(statusName: string): string {
  const lower = statusName.toLowerCase();
  if (lower === 'in progress' || lower.includes('progress')) return chalk.yellow(statusName);
  if (lower === 'done' || lower === 'closed' || lower === 'resolved') return chalk.green(statusName);
  return chalk.gray(statusName || '');
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all worktrees with git status')
    .action(async () => {
      const porcelain = await gitWorktreeList();
      const worktrees = parseWorktreeList(porcelain);

      if (worktrees.length === 0) {
        console.log('No worktrees found.');
        return;
      }

      // Gather status for each worktree in parallel
      const rows = await Promise.all(
        worktrees.map(async (wt) => {
          const [status, aheadBehind, age] = await Promise.all([
            gitStatusPorcelain(wt.path),
            gitAheadBehind(wt.path),
            gitLastCommitRelativeDate(wt.path),
          ]);
          return { wt, status, aheadBehind, age };
        }),
      );

      // Extract unique ticket keys from all worktrees
      const ticketKeys = [...new Set(
        worktrees
          .map((wt) => extractTicketKey(wt.branch))
          .filter((k): k is string => k !== null),
      )];

      // Fetch JIRA statuses with graceful degradation
      let jiraStatuses = new Map<string, string>();
      let jiraWarning = false;
      if (ticketKeys.length > 0) {
        try {
          jiraStatuses = await fetchIssueStatuses(ticketKeys);
        } catch {
          jiraWarning = true;
        }
      }

      // Compute max widths for alignment
      const branchWidth = Math.max(
        ...rows.map((r) => (r.wt.branch ?? '(detached)').length),
        'branch'.length,
      );
      const pathWidth = Math.max(...rows.map((r) => r.wt.path.length), 'path'.length);
      const ageWidth = Math.max(...rows.map((r) => r.age.length), 'age'.length);
      const ticketWidth = Math.max(
        ...rows.map((r) => {
          const key = extractTicketKey(r.wt.branch);
          const status = key ? (jiraStatuses.get(key) ?? '') : '';
          return status.length;
        }),
        'ticket'.length,
      );

      // Header row
      console.log(
        'branch'.padEnd(branchWidth + 2) +
          'status'.padEnd(8) +
          'remote'.padEnd(10) +
          'age'.padEnd(ageWidth + 2) +
          'ticket'.padEnd(ticketWidth + 2) +
          'path',
      );
      console.log('─'.repeat(branchWidth + 2 + 8 + 10 + ageWidth + 2 + ticketWidth + 2 + pathWidth));

      // Data rows
      for (const { wt, status, aheadBehind, age } of rows) {
        const isDirty = status.trim().length > 0;
        const branch = (wt.branch ?? '(detached)').padEnd(branchWidth + 2);
        const dirtyLabel = isDirty ? chalk.red('✗      ') : chalk.green('✓      ');
        const remote = `↑${aheadBehind.ahead} ↓${aheadBehind.behind}`.padEnd(10);
        const ageCol = age.padEnd(ageWidth + 2);
        const ticketKey = extractTicketKey(wt.branch);
        const ticketStatus = ticketKey ? (jiraStatuses.get(ticketKey) ?? '') : '';
        const ticketCol = colorStatus(ticketStatus).padEnd(ticketWidth + 2);
        console.log(branch + dirtyLabel + remote + ageCol + ticketCol + wt.path);
      }

      // JIRA warning after table
      if (jiraWarning) console.log(chalk.yellow('⚠ JIRA unreachable — ticket status unavailable'));
    });
}
