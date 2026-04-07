import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises
const mockStat = vi.fn();
const mockSymlink = vi.fn();

vi.mock('node:fs/promises', () => ({
  stat: (...args: unknown[]) => mockStat(...args),
  symlink: (...args: unknown[]) => mockSymlink(...args),
}));

// Mock @clack/prompts
const mockConfirm = vi.fn();
const mockLogSuccess = vi.fn();
const mockIsCancel = vi.fn(() => false);

vi.mock('@clack/prompts', () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
  log: { success: (...args: unknown[]) => mockLogSuccess(...args) },
  isCancel: (...args: unknown[]) => mockIsCancel(...args),
}));

describe('maybeSymlinkIdea', () => {
  beforeEach(() => {
    mockStat.mockClear();
    mockSymlink.mockClear();
    mockConfirm.mockClear();
    mockLogSuccess.mockClear();
    mockIsCancel.mockClear();

    // Default: isCancel returns false
    mockIsCancel.mockReturnValue(false);
    // Default: symlink succeeds
    mockSymlink.mockResolvedValue(undefined);
  });

  it('Test 1: when gitRoot/.idea exists and user confirms, creates symlink at worktreePath/.idea pointing to gitRoot/.idea', async () => {
    // stat on gitRoot/.idea succeeds (exists), stat on worktreePath/.idea throws ENOENT
    mockStat
      .mockImplementationOnce(() => Promise.resolve({})) // gitRoot/.idea exists
      .mockImplementationOnce(() => { const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); return Promise.reject(e); }); // worktreePath/.idea does not exist
    mockConfirm.mockResolvedValue(true);

    const { maybeSymlinkIdea } = await import('./worktree-hooks.js');
    await maybeSymlinkIdea('/home/user/myrepo', '/home/user/my-feature');

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('.idea'),
    }));
    expect(mockSymlink).toHaveBeenCalledWith(
      '/home/user/myrepo/.idea',
      '/home/user/my-feature/.idea',
      'dir',
    );
    expect(mockLogSuccess).toHaveBeenCalledWith(expect.stringContaining('.idea'));
  });

  it('Test 2: when gitRoot/.idea does not exist, does nothing (no prompt shown)', async () => {
    // stat on gitRoot/.idea throws ENOENT
    mockStat.mockImplementationOnce(() => {
      const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return Promise.reject(e);
    });

    const { maybeSymlinkIdea } = await import('./worktree-hooks.js');
    await maybeSymlinkIdea('/home/user/myrepo', '/home/user/my-feature');

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockSymlink).not.toHaveBeenCalled();
  });

  it('Test 3: when gitRoot/.idea exists but user declines, no symlink is created', async () => {
    mockStat
      .mockImplementationOnce(() => Promise.resolve({})) // gitRoot/.idea exists
      .mockImplementationOnce(() => { const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); return Promise.reject(e); }); // worktreePath/.idea does not exist
    mockConfirm.mockResolvedValue(false);

    const { maybeSymlinkIdea } = await import('./worktree-hooks.js');
    await maybeSymlinkIdea('/home/user/myrepo', '/home/user/my-feature');

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockSymlink).not.toHaveBeenCalled();
  });

  it('Test 4: when worktreePath/.idea already exists, skips silently — no prompt, no error', async () => {
    mockStat
      .mockImplementationOnce(() => Promise.resolve({})) // gitRoot/.idea exists
      .mockImplementationOnce(() => Promise.resolve({})); // worktreePath/.idea already exists

    const { maybeSymlinkIdea } = await import('./worktree-hooks.js');
    await maybeSymlinkIdea('/home/user/myrepo', '/home/user/my-feature');

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockSymlink).not.toHaveBeenCalled();
  });
});
