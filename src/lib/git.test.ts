import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseWorktreeList, gitAheadBehind, gitBranchExistsOnRemote, gitBranchMergedInto, gitCommitsAheadOf, gitWorktreeRemove, gitWorktreePrune, gitDeleteBranch, gitBranchExists, gitWorktreeAdd } from './git.js';

// Mock execa module for gitAheadBehind tests
vi.mock('execa', () => {
  const execa = vi.fn();
  return { execa };
});

import { execa } from 'execa';

const mockExeca = vi.mocked(execa);

describe('parseWorktreeList', () => {
  it('parses a single worktree (main only)', () => {
    const porcelain = 'worktree /path/to/repo\nHEAD abc123def456\nbranch refs/heads/main\n';
    const result = parseWorktreeList(porcelain);
    expect(result).toEqual([
      { path: '/path/to/repo', head: 'abc123def456', branch: 'main', isMain: true },
    ]);
  });

  it('parses two worktrees (main + linked)', () => {
    const porcelain = [
      'worktree /path/to/repo',
      'HEAD abc123def456',
      'branch refs/heads/main',
      '',
      'worktree /path/to/feature-worktree',
      'HEAD 789abcdef012',
      'branch refs/heads/feature/PROJ-123',
    ].join('\n');
    const result = parseWorktreeList(porcelain);
    expect(result).toHaveLength(2);
    expect(result[0].isMain).toBe(true);
    expect(result[1].isMain).toBe(false);
    expect(result[1].branch).toBe('feature/PROJ-123');
  });

  it('handles detached HEAD (no branch line)', () => {
    const porcelain = 'worktree /path/to/detached\nHEAD deadbeef1234\ndetached\n';
    const result = parseWorktreeList(porcelain);
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBeNull();
  });

  it('handles trailing newlines and multiple blank lines between blocks', () => {
    const porcelain = [
      'worktree /path/to/repo',
      'HEAD abc123',
      'branch refs/heads/main',
      '',
      '',
      'worktree /path/to/worktree2',
      'HEAD def456',
      'branch refs/heads/feature/test',
      '',
      '',
    ].join('\n');
    const result = parseWorktreeList(porcelain);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('/path/to/repo');
    expect(result[1].path).toBe('/path/to/worktree2');
  });

  it('returns empty array for empty porcelain input', () => {
    expect(parseWorktreeList('')).toEqual([]);
    expect(parseWorktreeList('   \n  \n  ')).toEqual([]);
  });
});

describe('gitAheadBehind', () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it('returns {ahead:0, behind:0} when execa throws (no upstream)', async () => {
    mockExeca.mockRejectedValue(
      Object.assign(new Error('fatal: no upstream configured'), { exitCode: 128 })
    );
    const result = await gitAheadBehind('/some/path');
    expect(result).toEqual({ ahead: 0, behind: 0 });
  });

  it('returns {ahead:3, behind:1} when stdout is "3\\t1\\n"', async () => {
    mockExeca.mockResolvedValue({ stdout: '3\t1\n' } as never);
    const result = await gitAheadBehind('/some/path');
    expect(result).toEqual({ ahead: 3, behind: 1 });
  });
});

describe('gitBranchExistsOnRemote', () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it('returns true when stdout is non-empty (branch exists on remote)', async () => {
    mockExeca.mockResolvedValue({ stdout: '  origin/feature/PROJ-123  \n' } as never);
    const result = await gitBranchExistsOnRemote('feature/PROJ-123');
    expect(result).toBe(true);
  });

  it('returns false when stdout is empty (branch not on remote)', async () => {
    mockExeca.mockResolvedValue({ stdout: '' } as never);
    const result = await gitBranchExistsOnRemote('feature/local-only');
    expect(result).toBe(false);
  });

  it('returns false when stdout is whitespace-only', async () => {
    mockExeca.mockResolvedValue({ stdout: '   ' } as never);
    const result = await gitBranchExistsOnRemote('feature/local-only');
    expect(result).toBe(false);
  });

  it('returns false when execa throws', async () => {
    mockExeca.mockRejectedValue(new Error('git command failed'));
    const result = await gitBranchExistsOnRemote('feature/some-branch');
    expect(result).toBe(false);
  });
});

describe('gitBranchMergedInto', () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it('returns true when execa resolves with exitCode 0 (merged)', async () => {
    mockExeca.mockResolvedValue({ exitCode: 0 } as never);
    const result = await gitBranchMergedInto('feature/my-feat', 'main');
    expect(result).toBe(true);
  });

  it('returns false when execa rejects with exitCode 1 (not merged)', async () => {
    mockExeca.mockRejectedValue(Object.assign(new Error('not ancestor'), { exitCode: 1 }));
    const result = await gitBranchMergedInto('feature/my-feat', 'main');
    expect(result).toBe(false);
  });

  it('returns false when execa rejects with any other error (safe default)', async () => {
    mockExeca.mockRejectedValue(new Error('some git error'));
    const result = await gitBranchMergedInto('feature/my-feat', 'main');
    expect(result).toBe(false);
  });
});

describe('gitWorktreeRemove / gitDeleteBranch / gitWorktreePrune with gitRoot', () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it('gitWorktreeRemove with gitRoot prepends -C flag', async () => {
    mockExeca.mockResolvedValue({} as never);
    await gitWorktreeRemove('/wt', false, '/root');
    expect(mockExeca).toHaveBeenCalledWith('git', ['-C', '/root', 'worktree', 'remove', '/wt']);
  });

  it('gitWorktreeRemove with gitRoot and force appends --force after path', async () => {
    mockExeca.mockResolvedValue({} as never);
    await gitWorktreeRemove('/wt', true, '/root');
    expect(mockExeca).toHaveBeenCalledWith('git', ['-C', '/root', 'worktree', 'remove', '/wt', '--force']);
  });

  it('gitWorktreeRemove without gitRoot omits -C flag (backward compat)', async () => {
    mockExeca.mockResolvedValue({} as never);
    await gitWorktreeRemove('/wt', false);
    expect(mockExeca).toHaveBeenCalledWith('git', ['worktree', 'remove', '/wt']);
  });

  it('gitWorktreePrune with gitRoot prepends -C flag', async () => {
    mockExeca.mockResolvedValue({} as never);
    await gitWorktreePrune('/root');
    expect(mockExeca).toHaveBeenCalledWith('git', ['-C', '/root', 'worktree', 'prune']);
  });

  it('gitWorktreePrune without gitRoot omits -C flag (backward compat)', async () => {
    mockExeca.mockResolvedValue({} as never);
    await gitWorktreePrune();
    expect(mockExeca).toHaveBeenCalledWith('git', ['worktree', 'prune']);
  });

  it('gitDeleteBranch with gitRoot and force=true prepends -C and uses -D', async () => {
    mockExeca.mockResolvedValue({} as never);
    await gitDeleteBranch('feat', true, '/root');
    expect(mockExeca).toHaveBeenCalledWith('git', ['-C', '/root', 'branch', '-D', 'feat']);
  });

  it('gitDeleteBranch with gitRoot and force=false prepends -C and uses -d', async () => {
    mockExeca.mockResolvedValue({} as never);
    await gitDeleteBranch('feat', false, '/root');
    expect(mockExeca).toHaveBeenCalledWith('git', ['-C', '/root', 'branch', '-d', 'feat']);
  });

  it('gitDeleteBranch without gitRoot omits -C flag (backward compat)', async () => {
    mockExeca.mockResolvedValue({} as never);
    await gitDeleteBranch('feat', false);
    expect(mockExeca).toHaveBeenCalledWith('git', ['branch', '-d', 'feat']);
  });
});

describe('gitCommitsAheadOf', () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it('returns array of commit lines when stdout has two lines', async () => {
    mockExeca.mockResolvedValue({ stdout: 'abc123 Fix bug\ndef456 Add thing\n' } as never);
    const result = await gitCommitsAheadOf('feature/my-feat', 'main');
    expect(result).toEqual(['abc123 Fix bug', 'def456 Add thing']);
  });

  it('returns empty array when stdout is empty (no commits ahead)', async () => {
    mockExeca.mockResolvedValue({ stdout: '' } as never);
    const result = await gitCommitsAheadOf('feature/my-feat', 'main');
    expect(result).toEqual([]);
  });

  it('returns empty array when execa throws (safe default)', async () => {
    mockExeca.mockRejectedValue(new Error('git command failed'));
    const result = await gitCommitsAheadOf('feature/my-feat', 'main');
    expect(result).toEqual([]);
  });
});

describe('gitBranchExists', () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it('returns true when execa resolves with exit 0 (branch exists)', async () => {
    mockExeca.mockResolvedValue({} as never);
    const result = await gitBranchExists('feature/PROJ-123');
    expect(result).toBe(true);
    expect(mockExeca).toHaveBeenCalledWith('git', ['rev-parse', '--verify', 'feature/PROJ-123']);
  });

  it('returns false when execa rejects with non-zero exit (branch does not exist)', async () => {
    mockExeca.mockRejectedValue(Object.assign(new Error('fatal: Needed a single revision'), { exitCode: 128 }));
    const result = await gitBranchExists('feature/new-branch');
    expect(result).toBe(false);
  });
});

describe('gitWorktreeAdd', () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it('calls worktree add without -b when branch already exists, returns { existed: true }', async () => {
    // First call: rev-parse --verify resolves (branch exists)
    mockExeca.mockResolvedValueOnce({} as never);
    // Second call: worktree add resolves
    mockExeca.mockResolvedValueOnce({} as never);

    const result = await gitWorktreeAdd('/path/to/worktree', 'feature/PROJ-123');

    expect(result).toEqual({ existed: true });
    expect(mockExeca).toHaveBeenNthCalledWith(1, 'git', ['rev-parse', '--verify', 'feature/PROJ-123']);
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'git', ['worktree', 'add', '/path/to/worktree', 'feature/PROJ-123']);
  });

  it('calls worktree add with -b when branch does not exist, returns { existed: false }', async () => {
    // First call: rev-parse --verify rejects (branch does not exist)
    mockExeca.mockRejectedValueOnce(Object.assign(new Error('fatal: Needed a single revision'), { exitCode: 128 }));
    // Second call: worktree add -b resolves
    mockExeca.mockResolvedValueOnce({} as never);

    const result = await gitWorktreeAdd('/path/to/worktree', 'feature/new-branch');

    expect(result).toEqual({ existed: false });
    expect(mockExeca).toHaveBeenNthCalledWith(1, 'git', ['rev-parse', '--verify', 'feature/new-branch']);
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'git', ['worktree', 'add', '-b', 'feature/new-branch', '/path/to/worktree']);
  });
});
