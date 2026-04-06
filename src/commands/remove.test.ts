import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock git library
const mockGitWorktreeList = vi.fn();
const mockParseWorktreeList = vi.fn();
const mockGitStatusPorcelain = vi.fn();
const mockGitWorktreeRemove = vi.fn();
const mockGitDeleteBranch = vi.fn();
const mockGitWorktreePrune = vi.fn();
const mockGitBranchExistsOnRemote = vi.fn();
const mockGitBranchMergedInto = vi.fn();

vi.mock('../lib/git.js', () => ({
  gitWorktreeList: (...args: unknown[]) => mockGitWorktreeList(...args),
  parseWorktreeList: (...args: unknown[]) => mockParseWorktreeList(...args),
  gitStatusPorcelain: (...args: unknown[]) => mockGitStatusPorcelain(...args),
  gitWorktreeRemove: (...args: unknown[]) => mockGitWorktreeRemove(...args),
  gitDeleteBranch: (...args: unknown[]) => mockGitDeleteBranch(...args),
  gitWorktreePrune: (...args: unknown[]) => mockGitWorktreePrune(...args),
  gitBranchExistsOnRemote: (...args: unknown[]) => mockGitBranchExistsOnRemote(...args),
  gitBranchMergedInto: (...args: unknown[]) => mockGitBranchMergedInto(...args),
}));

// Mock @clack/prompts
const mockCancel = vi.fn();
const mockNote = vi.fn();
const mockSpinnerStart = vi.fn();
const mockSpinnerStop = vi.fn();
const mockConfirm = vi.fn();
const mockIsCancel = vi.fn();
const mockSelect = vi.fn();
const mockOutro = vi.fn();

vi.mock('@clack/prompts', () => ({
  cancel: (...args: unknown[]) => mockCancel(...args),
  note: (...args: unknown[]) => mockNote(...args),
  spinner: vi.fn(() => ({ start: mockSpinnerStart, stop: mockSpinnerStop })),
  confirm: (...args: unknown[]) => mockConfirm(...args),
  isCancel: (...args: unknown[]) => mockIsCancel(...args),
  select: (...args: unknown[]) => mockSelect(...args),
  outro: (...args: unknown[]) => mockOutro(...args),
}));

describe('remove command', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

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
    mockGitBranchExistsOnRemote.mockClear();
    mockGitBranchMergedInto.mockClear();
    mockCancel.mockClear();
    mockNote.mockClear();
    mockSpinnerStart.mockClear();
    mockSpinnerStop.mockClear();
    mockConfirm.mockClear();
    mockIsCancel.mockClear();
    mockSelect.mockClear();
    mockOutro.mockClear();

    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new ExitError(typeof code === 'number' ? code : 0);
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
    logSpy.mockRestore();
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

  it('INTERACTIVE NO SAFE: prints outro and exits 0 when all worktrees are main/dirty/no-remote', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      { path: '/home/user/dirty-feat', head: 'def456', branch: 'feature/dirty', isMain: false },
      { path: '/home/user/local-feat', head: 'ghi789', branch: 'feature/local-only', isMain: false },
    ]);
    // dirty-feat is dirty, local-feat is clean but not on remote
    mockGitStatusPorcelain.mockImplementation((p: string) =>
      p.includes('dirty') ? Promise.resolve('M file.ts\n') : Promise.resolve('')
    );
    mockGitBranchExistsOnRemote.mockResolvedValue(false);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove'], { from: 'user' })
    ).rejects.toThrow('exit 0');

    expect(mockOutro).toHaveBeenCalledWith('No worktrees can be safely removed');
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('INTERACTIVE PICKER SHOWN: shows p.select with safe worktrees (clean + on remote)', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      { path: '/home/user/feat-a', head: 'def456', branch: 'feature/feat-a', isMain: false },
      { path: '/home/user/feat-b', head: 'ghi789', branch: 'feature/feat-b', isMain: false },
    ]);
    mockGitStatusPorcelain.mockResolvedValue(''); // all clean
    mockGitBranchExistsOnRemote.mockResolvedValue(true); // both on remote
    // select resolves to the first safe worktree
    const firstWorktree = { path: '/home/user/feat-a', head: 'def456', branch: 'feature/feat-a', isMain: false };
    mockSelect.mockResolvedValue(firstWorktree);
    mockIsCancel.mockReturnValue(false);
    mockGitBranchMergedInto.mockResolvedValue(true);
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove'], { from: 'user' });

    expect(mockSelect).toHaveBeenCalledOnce();
    const selectCall = mockSelect.mock.calls[0]![0] as { options: { label: string }[] };
    expect(selectCall.options).toHaveLength(2);
    expect(selectCall.options.map((o) => o.label)).toContain('feat-a');
    expect(selectCall.options.map((o) => o.label)).toContain('feat-b');
  });

  it('INTERACTIVE SELECT + DELETE: selected worktree gets removed via gitWorktreeRemove/gitDeleteBranch/gitWorktreePrune', async () => {
    const safeWorktree = { path: '/home/user/feat-a', head: 'def456', branch: 'feature/feat-a', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      safeWorktree,
    ]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitBranchExistsOnRemote.mockResolvedValue(true);
    mockSelect.mockResolvedValue(safeWorktree);
    mockIsCancel.mockReturnValue(false);
    mockGitBranchMergedInto.mockResolvedValue(true);
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove'], { from: 'user' });

    expect(mockGitWorktreeRemove).toHaveBeenCalledWith('/home/user/feat-a', false);
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/feat-a', true);
    expect(mockGitWorktreePrune).toHaveBeenCalled();
  });

  it('INTERACTIVE CANCEL: p.isCancel returns true → exit 1, gitWorktreeRemove NOT called', async () => {
    const safeWorktree = { path: '/home/user/feat-a', head: 'def456', branch: 'feature/feat-a', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      safeWorktree,
    ]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitBranchExistsOnRemote.mockResolvedValue(true);
    mockSelect.mockResolvedValue(Symbol('cancel')); // cancellation symbol
    mockIsCancel.mockReturnValue(true);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    expect(mockGitWorktreeRemove).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith('Aborted.');
  });

  it('INTERACTIVE MERGED: no confirm shown, gitDeleteBranch called with force=true', async () => {
    const safeWorktree = { path: '/home/user/feat-a', head: 'def456', branch: 'feature/feat-a', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      safeWorktree,
    ]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitBranchExistsOnRemote.mockResolvedValue(true);
    mockSelect.mockResolvedValue(safeWorktree);
    mockIsCancel.mockReturnValue(false);
    mockGitBranchMergedInto.mockResolvedValue(true);
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove'], { from: 'user' });

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/feat-a', true);
  });

  it('INTERACTIVE UNMERGED ACCEPT: confirm shown, user accepts → deleted with force=true', async () => {
    const safeWorktree = { path: '/home/user/feat-a', head: 'def456', branch: 'feature/feat-a', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      safeWorktree,
    ]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitBranchExistsOnRemote.mockResolvedValue(true);
    mockSelect.mockResolvedValue(safeWorktree);
    mockIsCancel.mockReturnValue(false);
    mockGitBranchMergedInto.mockResolvedValue(false);
    mockConfirm.mockResolvedValue(true);
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove'], { from: 'user' });

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/feat-a', true);
  });

  it('INTERACTIVE UNMERGED REJECT: confirm shown, user rejects → exit 1, gitWorktreeRemove not called', async () => {
    const safeWorktree = { path: '/home/user/feat-a', head: 'def456', branch: 'feature/feat-a', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      safeWorktree,
    ]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitBranchExistsOnRemote.mockResolvedValue(true);
    mockSelect.mockResolvedValue(safeWorktree);
    mockIsCancel.mockReturnValue(false);
    mockGitBranchMergedInto.mockResolvedValue(false);
    mockConfirm.mockResolvedValue(false);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockGitWorktreeRemove).not.toHaveBeenCalled();
  });

  it('BLOCKED DIRTY: dirty worktree is printed in blocked list with "uncommitted changes" and does NOT appear in picker', async () => {
    const dirtyWorktree = { path: '/home/user/dirty-feat', head: 'aaa111', branch: 'feature/dirty', isMain: false };
    const safeWorktree = { path: '/home/user/safe-feat', head: 'bbb222', branch: 'feature/safe', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      dirtyWorktree,
      safeWorktree,
    ]);
    mockGitStatusPorcelain.mockImplementation((p: string) =>
      p.includes('dirty') ? Promise.resolve('M file.ts\n') : Promise.resolve('')
    );
    mockGitBranchExistsOnRemote.mockResolvedValue(true);
    mockSelect.mockResolvedValue(safeWorktree);
    mockIsCancel.mockReturnValue(false);
    mockGitBranchMergedInto.mockResolvedValue(true);
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove'], { from: 'user' });

    const logCalls = logSpy.mock.calls.map((args) => String(args[0]));
    expect(logCalls.some((line) => line.includes('Cannot remove:'))).toBe(true);
    expect(logCalls.some((line) => line.includes('dirty-feat') && line.includes('uncommitted changes'))).toBe(true);

    const selectCall = mockSelect.mock.calls[0]![0] as { options: { label: string }[] };
    expect(selectCall.options.map((o) => o.label)).not.toContain('dirty-feat');
    expect(selectCall.options.map((o) => o.label)).toContain('safe-feat');
  });

  it('BLOCKED NO REMOTE: clean but branch not on remote → printed with "branch not pushed to remote" and not in picker', async () => {
    const localOnlyWorktree = { path: '/home/user/local-feat', head: 'ccc333', branch: 'feature/local', isMain: false };
    const safeWorktree = { path: '/home/user/safe-feat', head: 'ddd444', branch: 'feature/safe', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      localOnlyWorktree,
      safeWorktree,
    ]);
    mockGitStatusPorcelain.mockResolvedValue(''); // all clean
    mockGitBranchExistsOnRemote.mockImplementation((branch: string) =>
      Promise.resolve(branch === 'feature/safe')
    );
    mockSelect.mockResolvedValue(safeWorktree);
    mockIsCancel.mockReturnValue(false);
    mockGitBranchMergedInto.mockResolvedValue(true);
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove'], { from: 'user' });

    const logCalls = logSpy.mock.calls.map((args) => String(args[0]));
    expect(logCalls.some((line) => line.includes('Cannot remove:'))).toBe(true);
    expect(logCalls.some((line) => line.includes('local-feat') && line.includes('branch not pushed to remote'))).toBe(true);

    const selectCall = mockSelect.mock.calls[0]![0] as { options: { label: string }[] };
    expect(selectCall.options.map((o) => o.label)).not.toContain('local-feat');
    expect(selectCall.options.map((o) => o.label)).toContain('safe-feat');
  });

  it('BLOCKED BOTH: dirty AND not on remote → printed with both reasons joined by ", "', async () => {
    const bothBlockedWorktree = { path: '/home/user/both-blocked', head: 'eee555', branch: 'feature/both', isMain: false };
    const safeWorktree = { path: '/home/user/safe-feat', head: 'fff666', branch: 'feature/safe', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      bothBlockedWorktree,
      safeWorktree,
    ]);
    mockGitStatusPorcelain.mockImplementation((p: string) =>
      p.includes('both-blocked') ? Promise.resolve('M file.ts\n') : Promise.resolve('')
    );
    mockGitBranchExistsOnRemote.mockImplementation((branch: string) =>
      Promise.resolve(branch === 'feature/safe')
    );
    mockSelect.mockResolvedValue(safeWorktree);
    mockIsCancel.mockReturnValue(false);
    mockGitBranchMergedInto.mockResolvedValue(true);
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove'], { from: 'user' });

    const logCalls = logSpy.mock.calls.map((args) => String(args[0]));
    expect(logCalls.some((line) =>
      line.includes('both-blocked') &&
      line.includes('uncommitted changes') &&
      line.includes('branch not pushed to remote')
    )).toBe(true);
  });

  it('NO BLOCKED: all safe worktrees → no "Cannot remove:" header printed, picker shown as before', async () => {
    const safeWorktreeA = { path: '/home/user/feat-a', head: 'aaa111', branch: 'feature/feat-a', isMain: false };
    const safeWorktreeB = { path: '/home/user/feat-b', head: 'bbb222', branch: 'feature/feat-b', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      safeWorktreeA,
      safeWorktreeB,
    ]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitBranchExistsOnRemote.mockResolvedValue(true);
    mockSelect.mockResolvedValue(safeWorktreeA);
    mockIsCancel.mockReturnValue(false);
    mockGitBranchMergedInto.mockResolvedValue(true);
    mockGitWorktreeRemove.mockResolvedValue(undefined);
    mockGitDeleteBranch.mockResolvedValue(undefined);
    mockGitWorktreePrune.mockResolvedValue(undefined);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await program.parseAsync(['remove'], { from: 'user' });

    const logCalls = logSpy.mock.calls.map((args) => String(args[0]));
    expect(logCalls.some((line) => line.includes('Cannot remove:'))).toBe(false);
    expect(mockSelect).toHaveBeenCalledOnce();
  });

  it('ALL BLOCKED NO SAFE: only blocked worktrees → blocked list printed, then "No worktrees can be safely removed"', async () => {
    const dirtyWorktree = { path: '/home/user/dirty', head: 'aaa111', branch: 'feature/dirty', isMain: false };
    const localWorktree = { path: '/home/user/local', head: 'bbb222', branch: 'feature/local', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      dirtyWorktree,
      localWorktree,
    ]);
    mockGitStatusPorcelain.mockImplementation((p: string) =>
      p.includes('dirty') ? Promise.resolve('M file.ts\n') : Promise.resolve('')
    );
    mockGitBranchExistsOnRemote.mockResolvedValue(false);

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove'], { from: 'user' })
    ).rejects.toThrow('exit 0');

    const logCalls = logSpy.mock.calls.map((args) => String(args[0]));
    expect(logCalls.some((line) => line.includes('Cannot remove:'))).toBe(true);
    expect(logCalls.some((line) => line.includes('dirty') || line.includes('local'))).toBe(true);
    expect(mockOutro).toHaveBeenCalledWith('No worktrees can be safely removed');
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
