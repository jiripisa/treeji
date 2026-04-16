import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises
const mockStat = vi.fn();
const mockSymlink = vi.fn();
const mockMkdir = vi.fn();

vi.mock('node:fs/promises', () => ({
  stat: (...args: unknown[]) => mockStat(...args),
  symlink: (...args: unknown[]) => mockSymlink(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

// Mock @clack/prompts
const mockMultiselect = vi.fn();
const mockLogSuccess = vi.fn();
const mockIsCancel = vi.fn(() => false);

vi.mock('@clack/prompts', () => ({
  multiselect: (...args: unknown[]) => mockMultiselect(...args),
  log: { success: (...args: unknown[]) => mockLogSuccess(...args) },
  isCancel: (...args: unknown[]) => mockIsCancel(...args),
}));

// Mock repo-config
const mockLoadRepoConfig = vi.fn();

vi.mock('./repo-config.js', () => ({
  loadRepoConfig: (...args: unknown[]) => mockLoadRepoConfig(...args),
}));

// Helper: make stat resolve for a directory
function statDir() {
  return Promise.resolve({ isDirectory: () => true });
}
// Helper: make stat resolve for a file
function statFile() {
  return Promise.resolve({ isDirectory: () => false });
}
// Helper: make stat reject (ENOENT)
function statMissing() {
  return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
}

describe('maybeCreateSymlinks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsCancel.mockReturnValue(false);
    mockSymlink.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  it('no .treeji.json — does nothing, no prompt', async () => {
    mockLoadRepoConfig.mockResolvedValue({});

    const { maybeCreateSymlinks } = await import('./worktree-hooks.js');
    await maybeCreateSymlinks('/repo', '/worktree');

    expect(mockMultiselect).not.toHaveBeenCalled();
    expect(mockSymlink).not.toHaveBeenCalled();
  });

  it('empty symlinks array — does nothing', async () => {
    mockLoadRepoConfig.mockResolvedValue({ symlinks: [] });

    const { maybeCreateSymlinks } = await import('./worktree-hooks.js');
    await maybeCreateSymlinks('/repo', '/worktree');

    expect(mockMultiselect).not.toHaveBeenCalled();
  });

  it('all sources exist, user selects all — symlinks created with correct types', async () => {
    mockLoadRepoConfig.mockResolvedValue({ symlinks: ['.idea', 'config.json'] });
    // stat calls: source .idea (exists, dir), target .idea (missing), source config.json (exists, file), target config.json (missing), then type checks
    mockStat
      .mockImplementationOnce(statDir)    // source .idea exists
      .mockImplementationOnce(statMissing) // target .idea missing
      .mockImplementationOnce(statFile)    // source config.json exists
      .mockImplementationOnce(statMissing) // target config.json missing
      .mockImplementationOnce(statDir)     // type check .idea → dir
      .mockImplementationOnce(statFile);   // type check config.json → file

    mockMultiselect.mockResolvedValue(['.idea', 'config.json']);

    const { maybeCreateSymlinks } = await import('./worktree-hooks.js');
    await maybeCreateSymlinks('/repo', '/worktree');

    expect(mockSymlink).toHaveBeenCalledTimes(2);
    expect(mockSymlink).toHaveBeenCalledWith('/repo/.idea', '/worktree/.idea', 'dir');
    expect(mockSymlink).toHaveBeenCalledWith('/repo/config.json', '/worktree/config.json', 'file');
    expect(mockLogSuccess).toHaveBeenCalled();
  });

  it('source missing for one entry — only valid entry shown in prompt', async () => {
    mockLoadRepoConfig.mockResolvedValue({ symlinks: ['.idea', 'missing-dir'] });
    mockStat
      .mockImplementationOnce(statDir)     // source .idea exists
      .mockImplementationOnce(statMissing) // target .idea missing
      .mockImplementationOnce(statMissing); // source missing-dir does not exist

    mockMultiselect.mockResolvedValue(['.idea']);
    // type check for .idea
    mockStat.mockImplementationOnce(statDir);

    const { maybeCreateSymlinks } = await import('./worktree-hooks.js');
    await maybeCreateSymlinks('/repo', '/worktree');

    // multiselect should only show .idea
    const options = mockMultiselect.mock.calls[0][0].options;
    expect(options).toHaveLength(1);
    expect(options[0].value).toBe('.idea');
  });

  it('target already exists — filtered out silently', async () => {
    mockLoadRepoConfig.mockResolvedValue({ symlinks: ['.idea'] });
    mockStat
      .mockImplementationOnce(statDir) // source .idea exists
      .mockImplementationOnce(statDir); // target .idea already exists

    const { maybeCreateSymlinks } = await import('./worktree-hooks.js');
    await maybeCreateSymlinks('/repo', '/worktree');

    expect(mockMultiselect).not.toHaveBeenCalled();
    expect(mockSymlink).not.toHaveBeenCalled();
  });

  it('user cancels prompt — no symlinks created', async () => {
    mockLoadRepoConfig.mockResolvedValue({ symlinks: ['.idea'] });
    mockStat
      .mockImplementationOnce(statDir)     // source exists
      .mockImplementationOnce(statMissing); // target missing

    mockMultiselect.mockResolvedValue(Symbol('cancel'));
    mockIsCancel.mockReturnValue(true);

    const { maybeCreateSymlinks } = await import('./worktree-hooks.js');
    await maybeCreateSymlinks('/repo', '/worktree');

    expect(mockSymlink).not.toHaveBeenCalled();
  });

  it('nested path — parent directory created via mkdir', async () => {
    mockLoadRepoConfig.mockResolvedValue({ symlinks: ['http/http-client.private.env.json'] });
    mockStat
      .mockImplementationOnce(statFile)    // source exists
      .mockImplementationOnce(statMissing) // target missing
      .mockImplementationOnce(statFile);   // type check → file

    mockMultiselect.mockResolvedValue(['http/http-client.private.env.json']);

    const { maybeCreateSymlinks } = await import('./worktree-hooks.js');
    await maybeCreateSymlinks('/repo', '/worktree');

    expect(mockMkdir).toHaveBeenCalledWith('/worktree/http', { recursive: true });
    expect(mockSymlink).toHaveBeenCalledWith(
      '/repo/http/http-client.private.env.json',
      '/worktree/http/http-client.private.env.json',
      'file',
    );
  });
});
