import { Command } from 'commander';
import * as p from '@clack/prompts';
import path from 'node:path';
import type { WorktreeInfo } from '../types/worktree.js';
import {
  gitWorktreeList,
  parseWorktreeList,
  gitStatusPorcelain,
  gitWorktreeRemove,
  gitDeleteBranch,
  gitWorktreePrune,
  gitBranchExistsOnRemote,
  gitBranchMergedInto,
} from '../lib/git.js';

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove [name]')
    .description('Remove a worktree, its directory, and its branch')
    .option('--force', 'Delete even if worktree has uncommitted changes')
    .option('--yes', 'Skip confirmation prompts (for scripts)')
    .action(async (name: string | undefined, opts: { force?: boolean; yes?: boolean }) => {
      if (!name) {
        // Interactive picker mode
        const porcelain = await gitWorktreeList();
        const worktrees = parseWorktreeList(porcelain);
        const nonMain = worktrees.filter((wt) => !wt.isMain && wt.branch !== null);

        // Check each candidate: clean + branch on remote
        const safeWorktrees = (
          await Promise.all(
            nonMain.map(async (wt) => {
              const statusOutput = await gitStatusPorcelain(wt.path);
              const isDirty = statusOutput.trim().length > 0;
              if (isDirty) return null;
              const onRemote = await gitBranchExistsOnRemote(wt.branch!);
              if (!onRemote) return null;
              return wt;
            })
          )
        ).filter((wt): wt is WorktreeInfo => wt !== null);

        if (safeWorktrees.length === 0) {
          p.outro('No worktrees can be safely removed');
          process.exit(0);
        }

        const selected = await p.select({
          message: 'Select worktree to remove',
          options: safeWorktrees.map((wt) => ({
            value: wt,
            label: path.basename(wt.path),
            hint: wt.branch ?? undefined,
          })),
        });

        if (p.isCancel(selected)) {
          p.cancel('Aborted.');
          process.exit(1);
        }

        const pickedWorktree = selected as WorktreeInfo;

        const isMerged = await gitBranchMergedInto(pickedWorktree.branch!, 'main');
        if (!isMerged) {
          const confirmDelete = await p.confirm({
            message: `Branch '${pickedWorktree.branch}' is not merged into main. Delete anyway?`,
            initialValue: false,
          });
          if (p.isCancel(confirmDelete) || !confirmDelete) {
            p.cancel('Aborted.');
            process.exit(1);
          }
        }

        const spinner = p.spinner();
        spinner.start(`Removing worktree ${path.basename(pickedWorktree.path)}...`);
        try {
          await gitWorktreeRemove(pickedWorktree.path, false);
          if (pickedWorktree.branch) {
            try {
              await gitDeleteBranch(pickedWorktree.branch, true);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              spinner.stop(`Worktree removed, but branch delete failed: ${msg}`);
              p.note(
                'Use `git branch -D ' + pickedWorktree.branch + '` to force-delete the branch.',
                'Branch not deleted'
              );
              process.exit(1);
            }
          }
          await gitWorktreePrune();
          spinner.stop(`Worktree '${path.basename(pickedWorktree.path)}' removed.`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          spinner.stop(`Failed: ${msg}`);
          process.exit(1);
        }
        return;
      }

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
