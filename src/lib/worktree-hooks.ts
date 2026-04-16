import { stat, symlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as p from '@clack/prompts';
import { loadRepoConfig } from './repo-config.js';

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function maybeCreateSymlinks(gitRoot: string, worktreePath: string): Promise<void> {
  const config = await loadRepoConfig(gitRoot);
  const entries = config.symlinks;
  if (!entries || entries.length === 0) return;

  // Filter to valid entries: source exists in main repo, target does not exist in worktree
  const valid: string[] = [];
  for (const entry of entries) {
    const source = path.join(gitRoot, entry);
    const target = path.join(worktreePath, entry);
    if (!(await exists(source))) continue;
    if (await exists(target)) continue;
    valid.push(entry);
  }

  if (valid.length === 0) return;

  const selected = await p.multiselect({
    message: 'Symlink from main repo? (shares settings across worktrees)',
    options: valid.map((entry) => ({ value: entry, label: entry })),
    initialValues: valid,
  });

  if (p.isCancel(selected) || selected.length === 0) return;

  for (const entry of selected) {
    const source = path.join(gitRoot, entry);
    const target = path.join(worktreePath, entry);
    const parentDir = path.dirname(target);
    await mkdir(parentDir, { recursive: true });
    const info = await stat(source);
    await symlink(source, target, info.isDirectory() ? 'dir' : 'file');
  }

  p.log.success(`Linked: ${selected.join(', ')}`);
}
