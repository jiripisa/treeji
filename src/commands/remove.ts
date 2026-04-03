import { Command } from 'commander';
import * as p from '@clack/prompts';
import path from 'node:path';
import {
  gitWorktreeList,
  parseWorktreeList,
  gitStatusPorcelain,
  gitWorktreeRemove,
  gitDeleteBranch,
  gitWorktreePrune,
} from '../lib/git.js';

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove <name>')
    .description('Remove a worktree, its directory, and its branch')
    .option('--force', 'Delete even if worktree has uncommitted changes')
    .option('--yes', 'Skip confirmation prompts (for scripts)')
    .action(async (name: string, opts: { force?: boolean; yes?: boolean }) => {
      const porcelain = await gitWorktreeList();
      const worktrees = parseWorktreeList(porcelain);
      const target = worktrees.find(
        (wt) =>
          (wt.branch !== null && wt.branch.endsWith(`/${name}`)) ||
          path.basename(wt.path) === name
      );
      if (!target) {
        p.cancel(`No worktree named '${name}'`);
        process.exit(1);
      }
      const statusOutput = await gitStatusPorcelain(target.path);
      const isDirty = statusOutput.trim().length > 0;
      if (isDirty && !opts.force) {
        p.cancel(`Worktree '${name}' has uncommitted changes. Use --force to delete anyway.`);
        process.exit(1);
      }
      if (isDirty && opts.force && !opts.yes) {
        const confirmed = await p.confirm({
          message: `Remove dirty worktree '${name}'? (y/N)`,
          initialValue: false,
        });
        if (p.isCancel(confirmed) || !confirmed) {
          p.cancel('Aborted.');
          process.exit(1);
        }
      }
      const spinner = p.spinner();
      spinner.start(`Removing worktree ${name}...`);
      try {
        await gitWorktreeRemove(target.path, opts.force ?? false);
        if (target.branch) {
          try {
            await gitDeleteBranch(target.branch, opts.force ?? false);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            spinner.stop(`Worktree removed, but branch delete failed: ${msg}`);
            p.note(
              'Use `git branch -D ' + target.branch + '` to force-delete the branch.',
              'Branch not deleted'
            );
            process.exit(1);
          }
        }
        await gitWorktreePrune();
        spinner.stop(`Worktree '${name}' removed.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        spinner.stop(`Failed: ${msg}`);
        process.exit(1);
      }
    });
}
