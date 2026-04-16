import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { select, isCancel } from '@clack/prompts';
import { gitWorktreeList, parseWorktreeList } from '../lib/git.js';

/** Temp file path for communicating selected worktree to the shell wrapper.
 *  Uses /tmp/ explicitly — must match the path in the shell wrapper (setup.ts). */
function switchFilePath(): string {
  return `/tmp/treeji-switch-${process.ppid}`;
}

export function registerSwitchCommand(program: Command): void {
  program
    .command('switch [name]')
    .description('Switch to a worktree (use via the treeji shell function for cd support)')
    .action(async (name: string | undefined) => {
      // Gate: shell wrapper must be installed for cd to work
      const rcFiles = [
        path.join(os.homedir(), '.zshrc'),
        path.join(os.homedir(), '.bashrc'),
      ];
      const wrapperInstalled = rcFiles.some((rc) => {
        try {
          return fs.readFileSync(rc, 'utf8').includes('treeji()');
        } catch {
          return false;
        }
      });
      if (!wrapperInstalled) {
        process.stderr.write(
          "treeji: shell wrapper not installed — run 'treeji setup-shell' and add the function to ~/.zshrc\n"
        );
        process.exit(1);
      }

      const porcelain = await gitWorktreeList();
      const worktrees = parseWorktreeList(porcelain);

      let targetPath: string;

      if (name !== undefined && name !== '') {
        // Direct lookup by name
        const target = worktrees.find(
          (wt) =>
            (wt.branch !== null && wt.branch.endsWith(`/${name}`)) ||
            path.basename(wt.path) === name
        );
        if (!target) {
          process.stderr.write(`treeji: no worktree named '${name}'\n`);
          process.exit(1);
        }
        targetPath = target.path;
      } else {
        // Interactive picker
        if (worktrees.length === 0) {
          process.stderr.write('treeji: no worktrees found\n');
          process.exit(1);
        }

        const options = worktrees.map((wt) => ({
          value: wt.path,
          label: path.basename(wt.path),
          hint: wt.branch ?? 'detached HEAD',
        }));

        const result = await select({
          message: 'Switch to worktree',
          options,
        });

        if (isCancel(result)) {
          process.stderr.write('treeji: cancelled\n');
          process.exit(1);
        }

        targetPath = result as string;
      }

      // Write target path to temp file for the shell wrapper to read
      fs.writeFileSync(switchFilePath(), targetPath, { mode: 0o600 });
    });
}
