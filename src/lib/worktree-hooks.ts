import { stat, symlink } from 'node:fs/promises';
import path from 'node:path';
import * as p from '@clack/prompts';

export async function maybeSymlinkIdea(gitRoot: string, worktreePath: string): Promise<void> {
  const ideaSource = path.join(gitRoot, '.idea');
  const ideaTarget = path.join(worktreePath, '.idea');

  // 1. Check if .idea exists in main repo
  try {
    await stat(ideaSource);
  } catch {
    // .idea does not exist in main repo — nothing to do
    return;
  }

  // 2. Check if .idea already exists in the worktree — skip silently if so
  try {
    await stat(ideaTarget);
    // Already exists — skip without prompt
    return;
  } catch {
    // Does not exist — continue to prompt
  }

  // 3. Ask user if they want to symlink
  const answer = await p.confirm({
    message: 'Symlink .idea from main repo? (shares IDE settings)',
  });

  if (p.isCancel(answer) || !answer) {
    return;
  }

  // 4. Create symlink
  await symlink(ideaSource, ideaTarget, 'dir');
  p.log.success('Linked .idea directory');
}
