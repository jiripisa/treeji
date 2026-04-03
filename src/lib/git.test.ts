import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseWorktreeList, gitAheadBehind } from './git.js';

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
