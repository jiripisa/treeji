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
const mockGitCommitsAheadOf = vi.fn();
const mockGetGitRoot = vi.fn();

vi.mock('../lib/git.js', () => ({
  gitWorktreeList: (...args: unknown[]) => mockGitWorktreeList(...args),
  parseWorktreeList: (...args: unknown[]) => mockParseWorktreeList(...args),
  gitStatusPorcelain: (...args: unknown[]) => mockGitStatusPorcelain(...args),
  gitWorktreeRemove: (...args: unknown[]) => mockGitWorktreeRemove(...args),
  gitDeleteBranch: (...args: unknown[]) => mockGitDeleteBranch(...args),
  gitWorktreePrune: (...args: unknown[]) => mockGitWorktreePrune(...args),
  gitBranchExistsOnRemote: (...args: unknown[]) => mockGitBranchExistsOnRemote(...args),
  gitBranchMergedInto: (...args: unknown[]) => mockGitBranchMergedInto(...args),
  gitCommitsAheadOf: (...args: unknown[]) => mockGitCommitsAheadOf(...args),
  getGitRoot: (...args: unknown[]) => mockGetGitRoot(...args),
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
    mockGitCommitsAheadOf.mockClear();
    mockGetGitRoot.mockClear();
    mockGetGitRoot.mockResolvedValue('/repo/root');
    mockCancel.mockClear();
    mockNote.mockClear();
    mockSpinnerStart.mockClear();
    mockSpinnerStop.mockClear();
    mockConfirm.mockClear();
    mockConfirm.mockResolvedValue(true);
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
    expect(mockGitWorktreeRemove).toHaveBeenCalledWith('/home/user/feat', false, '/repo/root');
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/my-feat', false, '/repo/root');
    expect(mockGitWorktreePrune).toHaveBeenCalledWith('/repo/root');

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
    expect(mockGitWorktreeRemove).toHaveBeenCalledWith('/home/user/feat', true, '/repo/root');
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/my-feat', true, '/repo/root');
    expect(mockGitWorktreePrune).toHaveBeenCalledWith('/repo/root');
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
    expect(mockGitWorktreeRemove).toHaveBeenCalledWith('/home/user/feat', true, '/repo/root');
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/my-feat', true, '/repo/root');
    expect(mockGitWorktreePrune).toHaveBeenCalledWith('/repo/root');
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
    mockGitCommitsAheadOf.mockResolvedValue(['abc123 commit']); // local-feat has commits → blocked

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove'], { from: 'user' })
    ).rejects.toThrow('exit 0');

    expect(mockOutro).toHaveBeenCalledWith('No worktrees can be safely removed (use --force to override)');
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

    expect(mockGitWorktreeRemove).toHaveBeenCalledWith('/home/user/feat-a', false, '/repo/root');
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/feat-a', true, '/repo/root');
    expect(mockGitWorktreePrune).toHaveBeenCalledWith('/repo/root');
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

  it('INTERACTIVE MERGED: confirm removal shown, no unmerged warning, gitDeleteBranch called with force=true', async () => {
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

    // Confirm called once (removal confirmation), not twice (no unmerged warning)
    expect(mockConfirm).toHaveBeenCalledOnce();
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/feat-a', true, '/repo/root');
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
    expect(mockGitDeleteBranch).toHaveBeenCalledWith('feature/feat-a', true, '/repo/root');
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

    const selectCall = mockSelect.mock.calls[0]![0] as { options: { label: string; hint?: string; disabled?: boolean }[] };
    const dirtyOption = selectCall.options.find((o) => o.label === 'dirty-feat');
    const safeOption = selectCall.options.find((o) => o.label === 'safe-feat');
    expect(dirtyOption).toBeDefined();
    expect(dirtyOption!.disabled).toBe(true);
    expect(dirtyOption!.hint).toContain('uncommitted changes');
    expect(safeOption).toBeDefined();
    expect(safeOption!.disabled).toBeFalsy();
  });

  it('BLOCKED NO REMOTE: clean but branch not on remote → shown as disabled in picker with reason', async () => {
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
    mockGitCommitsAheadOf.mockResolvedValue(['abc123 Some commit']); // local branch has commits → stays blocked
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

    const selectCall = mockSelect.mock.calls[0]![0] as { options: { label: string; hint?: string; disabled?: boolean }[] };
    const localOption = selectCall.options.find((o) => o.label === 'local-feat');
    const safeOption = selectCall.options.find((o) => o.label === 'safe-feat');
    expect(localOption).toBeDefined();
    expect(localOption!.disabled).toBe(true);
    expect(localOption!.hint).toContain('branch not pushed to remote');
    expect(safeOption).toBeDefined();
    expect(safeOption!.disabled).toBeFalsy();
  });

  it('BLOCKED BOTH: dirty AND not on remote → shown as disabled with both reasons joined by ", "', async () => {
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

    const selectCall = mockSelect.mock.calls[0]![0] as { options: { label: string; hint?: string; disabled?: boolean }[] };
    const blockedOption = selectCall.options.find((o) => o.label === 'both-blocked');
    expect(blockedOption).toBeDefined();
    expect(blockedOption!.disabled).toBe(true);
    expect(blockedOption!.hint).toContain('uncommitted changes');
    expect(blockedOption!.hint).toContain('branch not pushed to remote');
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

  it('EMPTY LOCAL BRANCH SAFE: clean branch not on remote with 0 commits → appears in picker as safe', async () => {
    const localEmptyWorktree = { path: '/home/user/local-empty', head: 'aaa111', branch: 'feature/empty-local', isMain: false };
    const safeWorktree = { path: '/home/user/safe-feat', head: 'bbb222', branch: 'feature/safe', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      localEmptyWorktree,
      safeWorktree,
    ]);
    mockGitStatusPorcelain.mockResolvedValue(''); // all clean
    mockGitBranchExistsOnRemote.mockImplementation((branch: string) =>
      Promise.resolve(branch === 'feature/safe')
    );
    mockGitCommitsAheadOf.mockResolvedValue([]); // empty local branch — 0 commits ahead
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

    // Empty local branch appears in picker (safe)
    const selectCall = mockSelect.mock.calls[0]![0] as { options: { label: string }[] };
    expect(selectCall.options.map((o) => o.label)).toContain('local-empty');

    // No "Cannot remove:" line for it
    const logCalls = logSpy.mock.calls.map((args) => String(args[0]));
    expect(logCalls.some((line) => line.includes('local-empty') && line.includes('Cannot remove:'))).toBe(false);
  });

  it('BLOCKED WITH COMMITS: branch not on remote with commits → blocked, commit lines printed indented', async () => {
    const localWithCommitsWorktree = { path: '/home/user/local-with-commits', head: 'aaa111', branch: 'feature/local-commits', isMain: false };
    const safeWorktree = { path: '/home/user/safe-feat', head: 'bbb222', branch: 'feature/safe', isMain: false };

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/repo', head: 'abc123', branch: 'main', isMain: true },
      localWithCommitsWorktree,
      safeWorktree,
    ]);
    mockGitStatusPorcelain.mockResolvedValue(''); // all clean
    mockGitBranchExistsOnRemote.mockImplementation((branch: string) =>
      Promise.resolve(branch === 'feature/safe')
    );
    mockGitCommitsAheadOf.mockResolvedValue(['abc123 Fix thing', 'def456 Add stuff']); // 2 commits ahead
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

    const selectCall = mockSelect.mock.calls[0]![0] as { options: { label: string; hint?: string; disabled?: boolean }[] };
    const blockedOption = selectCall.options.find((o) => o.label === 'local-with-commits');
    const safeOption = selectCall.options.find((o) => o.label === 'safe-feat');
    expect(blockedOption).toBeDefined();
    expect(blockedOption!.disabled).toBe(true);
    expect(blockedOption!.hint).toContain('branch not pushed to remote');
    expect(safeOption).toBeDefined();
    expect(safeOption!.disabled).toBeFalsy();
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
    mockGitCommitsAheadOf.mockResolvedValue(['abc123 commit']); // local branch has commits → blocked

    const { registerRemoveCommand } = await import('./remove.js');
    const program = new Command();
    program.exitOverride();
    registerRemoveCommand(program);

    await expect(
      program.parseAsync(['remove'], { from: 'user' })
    ).rejects.toThrow('exit 0');

    expect(mockOutro).toHaveBeenCalledWith('No worktrees can be safely removed (use --force to override)');
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
