import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock git library
const mockGitWorktreeList = vi.fn();
const mockParseWorktreeList = vi.fn();
const mockGitStatusPorcelain = vi.fn();
const mockGitWorktreeRemove = vi.fn();
const mockGitDeleteBranch = vi.fn();
const mockGitWorktreePrune = vi.fn();

vi.mock('../lib/git.js', () => ({
  gitWorktreeList: (...args: unknown[]) => mockGitWorktreeList(...args),
  parseWorktreeList: (...args: unknown[]) => mockParseWorktreeList(...args),
  gitStatusPorcelain: (...args: unknown[]) => mockGitStatusPorcelain(...args),
  gitWorktreeRemove: (...args: unknown[]) => mockGitWorktreeRemove(...args),
  gitDeleteBranch: (...args: unknown[]) => mockGitDeleteBranch(...args),
  gitWorktreePrune: (...args: unknown[]) => mockGitWorktreePrune(...args),
}));

// Mock @clack/prompts
const mockCancel = vi.fn();
const mockNote = vi.fn();
const mockSpinnerStart = vi.fn();
const mockSpinnerStop = vi.fn();
const mockConfirm = vi.fn();
const mockIsCancel = vi.fn();

vi.mock('@clack/prompts', () => ({
  cancel: (...args: unknown[]) => mockCancel(...args),
  note: (...args: unknown[]) => mockNote(...args),
  spinner: vi.fn(() => ({ start: mockSpinnerStart, stop: mockSpinnerStop })),
  confirm: (...args: unknown[]) => mockConfirm(...args),
  isCancel: (...args: unknown[]) => mockIsCancel(...args),
}));

describe('remove command', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  class ExitError extends Error {
    code: number;
    constructor(code: number) {
      super(`exit ${code}`);
      this.code = code;
    }
  }

  beforeEach(() => {
    vi.resetModules();
    mockGitWorktreeList.mockClear();
    mockParseWorktreeList.mockClear();
    mockGitStatusPorcelain.mockClear();
    mockGitWorktreeRemove.mockClear();
    mockGitDeleteBranch.mockClear();
    mockGitWorktreePrune.mockClear();
    mockCancel.mockClear();
    mockNote.mockClear();
    mockSpinnerStart.mockClear();
    mockSpinnerStop.mockClear();
    mockConfirm.mockClear();
    mockIsCancel.mockClear();

    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new ExitError(typeof code === 'number' ? code : 0);
    });
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('CLEAN DELETE: calls gitWorktreeRemove, gitDeleteBranch, gitWorktreePrune in order for clean worktree', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'abc123', branch: 'feature/my-feat', isMain: false },
    ]);
    mockGitStatusPorcelain.mockResolvedValue(''); // clean
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove', 'my-feat'], { from: 'user' });

    // Verify all three git calls were made in order
    expect(mockGitWorktreeRemove).toHaveBeenCalledWith('/home/user/feat', false);
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/my-feat', false);
    expect(mockGitWorktreePrune).toHaveBeenCalled();

    // Verify delete order: worktreeRemove before deleteBranch
    const worktreeRemoveOrder = mockGitWorktreeRemove.mock.invocationCallOrder[0]!;
    const deleteBranchOrder = mockGitDeleteBranch.mock.invocationCallOrder[0]!;
    const pruneOrder = mockGitWorktreePrune.mock.invocationCallOrder[0]!;
    expect(worktreeRemoveOrder).toBeLessThan(deleteBranchOrder);
    expect(deleteBranchOrder).toBeLessThan(pruneOrder);
  });

  it('DIRTY BLOCK: refuses to delete dirty worktree without --force, calls exit(1), does not call gitWorktreeRemove', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'abc123', branch: 'feature/my-feat', isMain: false },
    ]);
    mockGitStatusPorcelain.mockResolvedValue('M file.ts\n'); // dirty

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove', 'my-feat'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    expect(mockGitWorktreeRemove).not.toHaveBeenCalled();
  });

  it('FORCE DIRTY: with --force flag shows confirm prompt; user accepts → deletes dirty worktree', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'abc123', branch: 'feature/my-feat', isMain: false },
    ]);
    mockGitStatusPorcelain.mockResolvedValue('M file.ts\n'); // dirty
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);
    mockConfirm.mockResolvedValue(true);
    mockIsCancel.mockReturnValue(false);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove', 'my-feat', '--force'], { from: 'user' });

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockGitWorktreeRemove).toHaveBeenCalledWith('/home/user/feat', true);
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/my-feat', true);
    expect(mockGitWorktreePrune).toHaveBeenCalled();
  });

  it('FORCE DIRTY CONFIRM ABORT: --force on dirty shows confirm; user says no → exit(1), gitWorktreeRemove NOT called', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'abc123', branch: 'feature/my-feat', isMain: false },
    ]);
    mockGitStatusPorcelain.mockResolvedValue('M file.ts\n'); // dirty
    mockConfirm.mockResolvedValue(false);
    mockIsCancel.mockReturnValue(false);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove', 'my-feat', '--force'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockGitWorktreeRemove).not.toHaveBeenCalled();
  });

  it('FORCE DIRTY YES FLAG: --force --yes on dirty skips confirm and deletes', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'abc123', branch: 'feature/my-feat', isMain: false },
    ]);
    mockGitStatusPorcelain.mockResolvedValue('M file.ts\n'); // dirty
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove', 'my-feat', '--force', '--yes'], { from: 'user' });

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockGitWorktreeRemove).toHaveBeenCalledWith('/home/user/feat', true);
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/my-feat', true);
    expect(mockGitWorktreePrune).toHaveBeenCalled();
  });

  it('NOT FOUND: calls exit(1) and shows error when no matching worktree found', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/main', head: 'abc123', branch: 'main', isMain: true },
    ]);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove', 'nonexistent'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    expect(mockGitWorktreeRemove).not.toHaveBeenCalled();
  });

  it('BRANCH DELETE FAILURE: shows error and exits non-zero when branch delete fails', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'abc123', branch: 'feature/my-feat', isMain: false },
    ]);
    mockGitStatusPorcelain.mockResolvedValue(''); // clean
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockRejectedValue(new Error('branch not fully merged'));
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove', 'my-feat'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    // gitWorktreeRemove was called but gitDeleteBranch failed
    expect(mockGitWorktreeRemove).toHaveBeenCalled();
  });
});
