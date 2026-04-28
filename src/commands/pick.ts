import { Command } from 'commander';
import * as p from '@clack/prompts';
import path from 'node:path';
import { fetchAssignedIssues, searchIssues } from '../lib/jira.js';
import { getGitRoot, gitWorktreeAdd, gitWorktreeList, parseWorktreeList } from '../lib/git.js';
import { toSlug } from '../lib/slug.js';
import { colorStatus, extractTicketKey } from './list.js';
import { maybeCreateSymlinks } from '../lib/worktree-hooks.js';
import { promptBranchType } from '../lib/branch-type.js';
import { maybeAdoptRemoteBranch } from '../lib/branch-remote.js';

function matchesFilter(
  issue: { key: string; summary: string },
  filter: string,
): boolean {
  const needle = filter.toLowerCase();
  return (
    issue.key.toLowerCase().includes(needle) ||
    issue.summary.toLowerCase().includes(needle)
  );
}

export function registerPickCommand(program: Command): void {
  program
    .command('pick [filter]')
    .description('Interactively pick a JIRA ticket and create a worktree. Without filter: only your assigned open tickets. With [filter]: searches across all visible JIRA tickets (any assignee, any status) by case-insensitive substring on key or summary.')
    .action(async (filter?: string) => {
      const hasFilter = filter !== undefined && filter.length > 0;

      // Step 1: Load tickets with spinner — assigned-to-me when no filter, full search when filter is present
      const spinner = p.spinner();
      spinner.start(hasFilter ? `Searching tickets matching "${filter}"...` : 'Loading assigned tickets...');

      let issues: Array<{ key: string; summary: string; statusName: string }>;
      try {
        issues = hasFilter
          ? await searchIssues(filter!, 50)
          : await fetchAssignedIssues(50, false);
        spinner.stop(`Found ${issues.length} ticket(s)`);
        if (issues.length === 50) {
          process.stderr.write('Showing first 50 tickets (most recently updated)\n');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        spinner.stop('Failed to load tickets');
        p.cancel(message);
        process.exit(1);
        return;
      }

      // Step 2a: When a filter is supplied, JIRA's `text ~` already narrowed the result set
      // server-side, but it can't substring-match issue keys (e.g. "123" inside "PROJ-123").
      // Run a final client-side substring filter on key + summary to cover that gap.
      const filtered = hasFilter
        ? issues.filter((i) => matchesFilter(i, filter!))
        : issues;

      // Step 2b: Handle empty state — message branches on whether a filter was supplied
      if (filtered.length === 0) {
        if (hasFilter) {
          p.outro(`No tickets matching "${filter}".`);
        } else {
          p.outro('No assigned open tickets found.');
        }
        return;
      }

      // Detect tickets that already have a worktree
      const porcelain = await gitWorktreeList();
      const worktrees = parseWorktreeList(porcelain);
      const existingTicketKeys = new Set(
        worktrees
          .map((wt) => extractTicketKey(wt.branch))
          .filter((k): k is string => k !== null),
      );

      // Step 3: Present ticket selection (per D-01)
      const selected = await p.select({
        message: 'Select a ticket to work on',
        options: filtered.map((issue) => {
          const hasWorktree = existingTicketKeys.has(issue.key);
          return {
            value: issue,
            label: `${issue.key.padEnd(12)} ${issue.summary}`,
            hint: hasWorktree ? 'worktree exists' : colorStatus(issue.statusName),
            disabled: hasWorktree,
          };
        }),
        maxItems: 10,
      });

      if (p.isCancel(selected)) {
        p.cancel('Cancelled.');
        process.exit(0);
        return;
      }

      // Step 4: Prompt for branch type (per D-02)
      const type = await promptBranchType();

      // Step 5: Create worktree using selected issue data (no second fetchIssue call — per D-04)
      try {
        const gitRoot = await getGitRoot();
        const summarySlug = toSlug(selected.summary);
        // Empty slug fallback: use ticket key alone when summary contains only special chars
        const ticketSlug = summarySlug ? `${selected.key}-${summarySlug}` : selected.key;
        const worktreePath = path.resolve(gitRoot, '..', ticketSlug);
        const branch = type ? `${type}/${ticketSlug}` : ticketSlug;

        // Ask before any spinner starts — p.confirm corrupts active spinner output.
        const { adopt } = await maybeAdoptRemoteBranch(branch);
        const spinner2 = p.spinner();
        spinner2.start(`Creating worktree ${ticketSlug}...`);
        const { existed } = await gitWorktreeAdd(worktreePath, branch, { fromRemote: adopt });
        spinner2.stop(`Worktree created at ${worktreePath}`);
        if (existed) process.stderr.write(`Using existing branch: ${branch}\n`);
        await maybeCreateSymlinks(gitRoot, worktreePath);
        p.outro(`Branch: ${branch}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        p.cancel(message);
        process.exit(1);
      }
    });
}
