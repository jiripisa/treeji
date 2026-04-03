import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import {
  gitWorktreeList,
  gitStatusPorcelain,
  gitAheadBehind,
  gitLastCommitRelativeDate,
  parseWorktreeList,
} from '../lib/git.js';
import { fetchIssueStatuses } from '../lib/jira.js';
import { loadConfig } from '../lib/config.js';

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

function jiraCell(key: string | null, statusName: string, host: string | undefined): string {
  if (!key) return '';
  const url = host ? `${host}/browse/${key}` : '';
  const link = `\x1b]8;;${url}\x1b\\${key}\x1b]8;;\x1b\\`;
  if (!statusName) return link;
  return `${link} (${colorStatus(statusName)})`;
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

      // Load config for JIRA host (used in hyperlinks)
      const { host } = loadConfig();

      // Compute max widths for alignment
      // name column: basename of worktree path
      const nameWidth = Math.max(
        ...rows.map((r) => path.basename(r.wt.path).length),
        'name'.length,
      );
      const branchWidth = Math.max(
        ...rows.map((r) => (r.wt.branch ?? '(detached)').length),
        'branch'.length,
      );
      const ageWidth = Math.max(...rows.map((r) => r.age.length), 'age'.length);
      const jiraWidth = Math.max(
        ...rows.map((r) => {
          const key = extractTicketKey(r.wt.branch);
          const status = key ? (jiraStatuses.get(key) ?? '') : '';
          if (!key) return 0;
          return status ? `${key} (${status})`.length : key.length;
        }),
        'jira'.length,
      );
      const statusWidth = Math.max(
        ...rows.map((r) => {
          const isDirty = r.status.trim().length > 0;
          const flag = isDirty ? '✗' : '✓';
          return `${flag} ↑${r.aheadBehind.ahead} ↓${r.aheadBehind.behind}`.length;
        }),
        'status'.length,
      );

      // Header row — order: name | status | branch | age | jira
      console.log(
        'name'.padEnd(nameWidth + 2) +
          'status'.padEnd(statusWidth + 2) +
          'branch'.padEnd(branchWidth + 2) +
          'age'.padEnd(ageWidth + 2) +
          'jira',
      );
      console.log('─'.repeat(nameWidth + 2 + statusWidth + 2 + branchWidth + 2 + ageWidth + 2 + jiraWidth));

      // Data rows
      for (const { wt, status, aheadBehind, age } of rows) {
        const isDirty = status.trim().length > 0;
        const name = path.basename(wt.path).padEnd(nameWidth + 2);
        const flag = isDirty ? chalk.red('✗') : chalk.green('✓');
        const remote = `↑${aheadBehind.ahead} ↓${aheadBehind.behind}`;
        const statusCol = `${flag} ${remote}`.padEnd(statusWidth + 2);
        const branch = (wt.branch ?? '(detached)').padEnd(branchWidth + 2);
        const ageCol = age.padEnd(ageWidth + 2);
        const ticketKey = extractTicketKey(wt.branch);
        const ticketStatus = ticketKey ? (jiraStatuses.get(ticketKey) ?? '') : '';
        const jiraVisible = ticketKey
          ? ((!jiraWarning && ticketStatus) ? `${ticketKey} (${ticketStatus})` : ticketKey)
          : '';
        const jiraColRaw = jiraCell(ticketKey, jiraWarning ? '' : ticketStatus, host);
        const jiraColPadded = jiraColRaw + ' '.repeat(Math.max(0, jiraWidth + 2 - jiraVisible.length));
        console.log(name + statusCol + branch + ageCol + jiraColPadded);
      }

      // JIRA warning after table
      if (jiraWarning) console.log(chalk.yellow('⚠ JIRA unreachable — ticket status unavailable'));
    });
}
