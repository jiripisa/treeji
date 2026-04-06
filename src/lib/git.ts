import { execa } from 'execa';
import type { WorktreeInfo } from '../types/worktree.js';

export async function getGitRoot(): Promise<string> {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel']);
    return stdout.trim();
  } catch {
    throw new Error('Not a git repository. Run treeji from inside a git project.');
  }
}

export async function gitWorktreeList(): Promise<string> {
  try {
    const { stdout } = await execa('git', ['worktree', 'list', '--porcelain']);
    return stdout;
  } catch {
    throw new Error('Not a git repository. Run treeji from inside a git project.');
  }
}

export async function gitWorktreeAdd(worktreePath: string, branch: string): Promise<void> {
  await execa('git', ['worktree', 'add', '-b', branch, worktreePath]);
}

export async function gitWorktreeRemove(worktreePath: string, force = false): Promise<void> {
  const args = ['worktree', 'remove', worktreePath];
  if (force) args.push('--force');
  await execa('git', args);
}

export async function gitWorktreePrune(): Promise<void> {
  await execa('git', ['worktree', 'prune']);
}

export async function gitDeleteBranch(branch: string, force = false): Promise<void> {
  // -d refuses deletion if unmerged; -D forces it (for --force flag flows)
  await execa('git', ['branch', force ? '-D' : '-d', branch]);
}

export async function gitStatusPorcelain(worktreePath: string): Promise<string> {
  const { stdout } = await execa('git', ['-C', worktreePath, 'status', '--porcelain=v1']);
  return stdout;
}

export async function gitAheadBehind(worktreePath: string): Promise<{ ahead: number; behind: number }> {
  try {
    const { stdout } = await execa('git', [
      '-C', worktreePath,
      'rev-list', '--count', '--left-right', 'HEAD...@{upstream}',
    ]);
    const [left, right] = stdout.trim().split('\t').map(Number);
    return { ahead: left ?? 0, behind: right ?? 0 };
  } catch {
    // No upstream configured — normal for local-only branches
    return { ahead: 0, behind: 0 };
  }
}

export async function gitLastCommitRelativeDate(worktreePath: string): Promise<string> {
  const { stdout } = await execa('git', ['-C', worktreePath, 'log', '-1', '--format=%ar']);
  return stdout.trim() || 'no commits';
}

export async function gitBranchExistsOnRemote(branch: string): Promise<boolean> {
  try {
    const { stdout } = await execa('git', ['branch', '-r', '--list', `origin/${branch}`]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export function parseWorktreeList(porcelain: string): WorktreeInfo[] {
  if (!porcelain.trim()) return [];
  const blocks = porcelain.trim().split(/\n\n+/);
  return blocks.map((block, index) => {
    const lines = block.split('\n');
    const pathLine = lines.find(l => l.startsWith('worktree '));
    const headLine = lines.find(l => l.startsWith('HEAD '));
    const branchLine = lines.find(l => l.startsWith('branch '));
    return {
      path: pathLine?.slice('worktree '.length) ?? '',
      head: headLine?.slice('HEAD '.length) ?? '',
      branch: branchLine ? branchLine.slice('branch refs/heads/'.length) : null,
      isMain: index === 0,
    };
  });
}
