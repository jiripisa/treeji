import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock git library
const mockGitBranchExists = vi.fn();
const mockGitRemoteBranchExists = vi.fn();

vi.mock('./git.js', () => ({
  gitBranchExists: (...args: unknown[]) => mockGitBranchExists(...args),
  gitRemoteBranchExists: (...args: unknown[]) => mockGitRemoteBranchExists(...args),
}));

// Mock @clack/prompts
const mockConfirm = vi.fn();
const mockCancel = vi.fn();

vi.mock('@clack/prompts', () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
  isCancel: vi.fn(() => false),
  cancel: (...args: unknown[]) => mockCancel(...args),
}));

const clackMock = await import('@clack/prompts');

describe('maybeAdoptRemoteBranch', () => {
  beforeEach(() => {
    mockGitBranchExists.mockReset();
    mockGitRemoteBranchExists.mockReset();
    mockConfirm.mockReset();
    mockCancel.mockReset();
    vi.mocked(clackMock.isCancel).mockReset();
    vi.mocked(clackMock.isCancel).mockImplementation(() => false);
  });

  it('local branch already exists → returns { adopt: false }, prompt NOT shown', async () => {
    mockGitBranchExists.mockResolvedValue(true);

    const { maybeAdoptRemoteBranch } = await import('./branch-remote.js');
    const result = await maybeAdoptRemoteBranch('feature/PROJ-123');

    expect(result).toEqual({ adopt: false });
    expect(mockGitRemoteBranchExists).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('remote branch missing → returns { adopt: false }, prompt NOT shown', async () => {
    mockGitBranchExists.mockResolvedValue(false);
    mockGitRemoteBranchExists.mockResolvedValue(false);

    const { maybeAdoptRemoteBranch } = await import('./branch-remote.js');
    const result = await maybeAdoptRemoteBranch('feature/PROJ-123');

    expect(result).toEqual({ adopt: false });
    expect(mockGitRemoteBranchExists).toHaveBeenCalledWith('feature/PROJ-123');
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('user confirms → returns { adopt: true }', async () => {
    mockGitBranchExists.mockResolvedValue(false);
    mockGitRemoteBranchExists.mockResolvedValue(true);
    mockConfirm.mockResolvedValue(true);

    const { maybeAdoptRemoteBranch } = await import('./branch-remote.js');
    const result = await maybeAdoptRemoteBranch('feature/PROJ-123');

    expect(result).toEqual({ adopt: true });
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    // Prompt copy sanity check — both branch and origin/<branch> appear
    const callArg = mockConfirm.mock.calls[0][0] as { message: string };
    expect(callArg.message).toContain("'feature/PROJ-123'");
    expect(callArg.message).toContain('origin/feature/PROJ-123');
  });

  it('user declines → returns { adopt: false }', async () => {
    mockGitBranchExists.mockResolvedValue(false);
    mockGitRemoteBranchExists.mockResolvedValue(true);
    mockConfirm.mockResolvedValue(false);

    const { maybeAdoptRemoteBranch } = await import('./branch-remote.js');
    const result = await maybeAdoptRemoteBranch('feature/PROJ-123');

    expect(result).toEqual({ adopt: false });
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it('user cancels prompt → calls p.cancel("Cancelled.") and process.exit(0)', async () => {
    const cancelSymbol = Symbol('cancel');
    mockGitBranchExists.mockResolvedValue(false);
    mockGitRemoteBranchExists.mockResolvedValue(true);
    mockConfirm.mockResolvedValue(cancelSymbol);
    vi.mocked(clackMock.isCancel).mockImplementation((v) => v === cancelSymbol);

    class ExitError extends Error {
      code: number;
      constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
      }
    }
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new ExitError(Number(code ?? 0));
    });

    const { maybeAdoptRemoteBranch } = await import('./branch-remote.js');
    await expect(maybeAdoptRemoteBranch('feature/PROJ-123')).rejects.toThrow('exit 0');

    expect(mockCancel).toHaveBeenCalledWith('Cancelled.');
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });
});
