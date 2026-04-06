import { Command } from 'commander';
import * as p from '@clack/prompts';
import path from 'node:path';
import { fetchAssignedIssues } from '../lib/jira.js';
import { getGitRoot, gitWorktreeAdd } from '../lib/git.js';
import { toSlug } from '../lib/slug.js';
import { colorStatus } from './list.js';

export function registerPickCommand(program: Command): void {
  program
    .command('pick')
    .description('Interactively pick an assigned JIRA ticket and create a worktree')
    .action(async () => {
      // Step 1: Load assigned tickets with spinner (per D-03)
      const spinner = p.spinner();
      spinner.start('Loading assigned tickets...');

      let issues: Array<{ key: string; summary: string; statusName: string }>;
      try {
        issues = await fetchAssignedIssues();
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

      // Step 2: Handle empty state (per Pitfall 3 — empty is not an error)
      if (issues.length === 0) {
        p.outro('No assigned open tickets found.');
        return;
      }

      // Step 3: Present ticket selection (per D-01)
      const selected = await p.select({
        message: 'Select a ticket to work on',
        options: issues.map((issue) => ({
          value: issue,
          label: `${issue.key.padEnd(12)} ${issue.summary}`,
          hint: colorStatus(issue.statusName),
        })),
        maxItems: 10,
      });

      if (p.isCancel(selected)) {
        p.cancel('Cancelled.');
        process.exit(0);
        return;
      }

      // Step 4: Prompt for branch type (per D-02)
      const typeResult = await p.text({
        message: 'Branch type',
        placeholder: 'feature',
        validate: (v) => (!v ? 'Branch type cannot be empty' : undefined),
      });

      if (p.isCancel(typeResult)) {
        p.cancel('Cancelled.');
        process.exit(0);
        return;
      }

      const type = typeResult as string;

      // Step 5: Create worktree using selected issue data (no second fetchIssue call — per D-04)
      try {
        const gitRoot = await getGitRoot();
        const summarySlug = toSlug(selected.summary);
        // Empty slug fallback: use ticket key alone when summary contains only special chars
        const ticketSlug = summarySlug ? `${selected.key}-${summarySlug}` : selected.key;
        const worktreePath = path.resolve(gitRoot, '..', ticketSlug);
        const branch = `${type}/${ticketSlug}`;

        const spinner2 = p.spinner();
        spinner2.start(`Creating worktree ${ticketSlug}...`);
        const { existed } = await gitWorktreeAdd(worktreePath, branch);
        spinner2.stop(`Worktree created at ${worktreePath}`);
        if (existed) process.stderr.write(`Using existing branch: ${branch}\n`);
        p.outro(`Branch: ${branch}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        p.cancel(message);
        process.exit(1);
      }
    });
}
