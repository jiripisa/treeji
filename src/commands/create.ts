import { Command } from 'commander';
import * as p from '@clack/prompts';
import path from 'node:path';
import { getGitRoot, gitWorktreeAdd } from '../lib/git.js';
import { toSlug, validateSlug } from '../lib/slug.js';
import { fetchIssue } from '../lib/jira.js';
import { maybeSymlinkIdea } from '../lib/worktree-hooks.js';

export function registerCreateCommand(program: Command): void {
  program
    .command('create <slug> <type>')
    .description('Create a worktree — JIRA key (PROJ-123) or manual slug, branch {type}/{slug}')
    .action(async (slug: string, type: string) => {
      const JIRA_KEY_RE = /^[A-Z]+-\d+$/;

      if (JIRA_KEY_RE.test(slug)) {
        // JIRA path (per D-01, D-02, D-03)
        try {
          const gitRoot = await getGitRoot();
          const spinner = p.spinner();
          spinner.start(`Fetching JIRA ticket ${slug}...`);
          const issue = await fetchIssue(slug);
          const summarySlug = toSlug(issue.summary);
          // Pitfall 6: fall back to ticket key if summary slugifies to empty
          const ticketSlug = summarySlug ? `${slug}-${summarySlug}` : slug;
          spinner.stop(`Ticket: ${issue.summary}`);

          const worktreePath = path.resolve(gitRoot, '..', ticketSlug);
          const branch = `${type}/${ticketSlug}`;

          process.stderr.write(`Creating: ${branch}  →  ${worktreePath}\n`);
          const spinner2 = p.spinner();
          spinner2.start(`Creating worktree ${ticketSlug}...`);
          const { existed } = await gitWorktreeAdd(worktreePath, branch);
          spinner2.stop(`Worktree created at ${worktreePath}`);
          if (existed) process.stderr.write(`Using existing branch: ${branch}\n`);
          await maybeSymlinkIdea(gitRoot, worktreePath);
          p.outro(`Branch: ${branch}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          p.cancel(message);
          process.exit(1);
        }
        return;
      }

      // Manual slug path (Phase 2 behavior — unchanged)
      // D-07, CLI-05: always sanitize user input through toSlug
      const cleanSlug = toSlug(slug);
      const slugError = validateSlug(cleanSlug);
      if (slugError) {
        p.cancel(`Invalid slug: ${slugError}`);
        process.exit(1);
      }

      try {
        // D-08, Pitfall 3: always resolve worktree path from git root, never from cwd
        const gitRoot = await getGitRoot();
        const worktreePath = path.resolve(gitRoot, '..', cleanSlug);

        // D-07, CLI-03: branch name is {type}/{cleanSlug}
        const branch = `${type}/${cleanSlug}`;

        process.stderr.write(`Creating: ${branch}  →  ${worktreePath}\n`);
        const spinner = p.spinner();
        spinner.start(`Creating worktree ${cleanSlug}...`);
        const { existed: branchExisted } = await gitWorktreeAdd(worktreePath, branch);
        spinner.stop(`Worktree created at ${worktreePath}`);
        if (branchExisted) process.stderr.write(`Using existing branch: ${branch}\n`);
        await maybeSymlinkIdea(gitRoot, worktreePath);
        p.outro(`Branch: ${branch}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        p.cancel(message);
        process.exit(1);
      }
    });
}
