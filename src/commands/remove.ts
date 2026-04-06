import { Command } from 'commander';
import * as p from '@clack/prompts';
import chalk from 'chalk';
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
  gitCommitsAheadOf,
  getGitRoot,
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
        const gitRoot = await getGitRoot();
        const porcelain = await gitWorktreeList();
        const worktrees = parseWorktreeList(porcelain);
        const nonMain = worktrees.filter((wt) => !wt.isMain && wt.branch !== null);

        type CheckResult =
          | { kind: 'safe'; wt: WorktreeInfo }
          | { kind: 'blocked'; wt: WorktreeInfo; reasons: string[]; commits: string[] };

        // Check each candidate: classify as safe or blocked (dirty / branch not on remote)
        const results = await Promise.all(
          nonMain.map(async (wt): Promise<CheckResult> => {
            const statusOutput = await gitStatusPorcelain(wt.path);
            const isDirty = statusOutput.trim().length > 0;
            const onRemote = await gitBranchExistsOnRemote(wt.branch!);
            const commits = !onRemote ? await gitCommitsAheadOf(wt.branch!, 'main') : [];
            // Empty local branch (not on remote, no commits, clean) → safe
            if (!onRemote && commits.length === 0 && !isDirty) {
              return { kind: 'safe' as const, wt };
            }
            const reasons: string[] = [];
            if (isDirty) reasons.push('uncommitted changes');
            if (!onRemote) reasons.push('branch not pushed to remote');
            return reasons.length === 0
              ? { kind: 'safe' as const, wt }
              : { kind: 'blocked' as const, wt, reasons, commits };
          })
        );

        const safeWorktrees: WorktreeInfo[] = [];
        const blockedWorktrees: Array<{ wt: WorktreeInfo; reasons: string[]; commits: string[] }> = [];
        for (const result of results) {
          if (result.kind === 'safe') {
            safeWorktrees.push(result.wt);
          } else {
            blockedWorktrees.push({ wt: result.wt, reasons: result.reasons, commits: result.commits });
          }
        }

        if (blockedWorktrees.length > 0) {
          console.log('Cannot remove:');
          for (const { wt, reasons, commits } of blockedWorktrees) {
            const wtName = path.basename(wt.path);
            console.log(`  ${chalk.yellow(wtName)}  ${chalk.dim('— ' + reasons.join(', '))}`);
            for (const commit of commits) {
              console.log(`      ${chalk.dim(commit)}`);
            }
          }
          console.log('');
        }

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
          await gitWorktreeRemove(pickedWorktree.path, false, gitRoot);
          if (pickedWorktree.branch) {
            try {
              await gitDeleteBranch(pickedWorktree.branch, true, gitRoot);
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
          await gitWorktreePrune(gitRoot);
          spinner.stop(`Worktree '${path.basename(pickedWorktree.path)}' removed.`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          spinner.stop(`Failed: ${msg}`);
          process.exit(1);
        }
        return;
      }

      const gitRoot = await getGitRoot();
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
        await gitWorktreeRemove(target.path, opts.force ?? false, gitRoot);
        if (target.branch) {
          try {
            await gitDeleteBranch(target.branch, opts.force ?? false, gitRoot);
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
        await gitWorktreePrune(gitRoot);
        spinner.stop(`Worktree '${name}' removed.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        spinner.stop(`Failed: ${msg}`);
        process.exit(1);
      }
    });
}
