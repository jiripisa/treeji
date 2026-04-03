import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import fs from 'node:fs';

// Save original readFileSync before any mocking
const originalReadFileSync = fs.readFileSync.bind(fs);

// Mock git library
const mockGitWorktreeList = vi.fn();
const mockParseWorktreeList = vi.fn();

vi.mock('../lib/git.js', () => ({
  gitWorktreeList: (...args: unknown[]) => mockGitWorktreeList(...args),
  parseWorktreeList: (...args: unknown[]) => mockParseWorktreeList(...args),
}));

// Mock @clack/prompts
const mockSelect = vi.fn();
const mockIsCancel = vi.fn();

vi.mock('@clack/prompts', () => ({
  select: (...args: unknown[]) => mockSelect(...args),
  isCancel: (...args: unknown[]) => mockIsCancel(...args),
}));

// Mock node:os
vi.mock('node:os', () => ({
  default: { homedir: () => '/home/testuser' },
}));

function switchFilePath(): string {
  return `/tmp/treeji-switch-${process.ppid}`;
}

/** readFileSync mock: wrapper present (.zshrc has treeji()), .bashrc throws ENOENT, others pass through */
function mockReadFileSyncWrapperPresent(
  filePath: fs.PathOrFileDescriptor,
  ...args: unknown[]
): string | Buffer {
  if (typeof filePath === 'string' && filePath.endsWith('.zshrc')) {
    return 'treeji() {\n  echo hi\n}\n';
  }
  if (typeof filePath === 'string' && filePath.endsWith('.bashrc')) {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  }
  return originalReadFileSync(filePath as string, args[0] as BufferEncoding);
}

/** readFileSync mock: no rc files present (all throw ENOENT), others pass through */
function mockReadFileSyncWrapperAbsent(
  filePath: fs.PathOrFileDescriptor,
  ...args: unknown[]
): string | Buffer {
  if (typeof filePath === 'string' && (filePath.endsWith('.zshrc') || filePath.endsWith('.bashrc'))) {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  }
  return originalReadFileSync(filePath as string, args[0] as BufferEncoding);
}

describe('switch command — direct name arg', () => {
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
    mockSelect.mockClear();
    mockIsCancel.mockClear();

    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new ExitError(typeof code === 'number' ? code : 0);
    });

    // Default: wrapper present
    vi.spyOn(fs, 'readFileSync').mockImplementation(mockReadFileSyncWrapperPresent);

    // Clean up temp file before each test
    try { fs.unlinkSync(switchFilePath()); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try { fs.unlinkSync(switchFilePath()); } catch { /* ignore */ }
  });

  it('WRAPPER ABSENT: exits 1 with shell wrapper not installed message, no temp file', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(mockReadFileSyncWrapperAbsent);

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'abc123', branch: 'feature/my-feat', isMain: false },
    ]);

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await expect(
      program.parseAsync(['switch', 'my-feat'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    const stderrCalls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrCalls).toContain('shell wrapper not installed');
    expect(fs.existsSync(switchFilePath())).toBe(false);
  });

  it('MATCH BY BRANCH SUFFIX: writes target path to temp file', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'abc123', branch: 'feature/my-feat', isMain: false },
    ]);

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await program.parseAsync(['switch', 'my-feat'], { from: 'user' });

    const content = originalReadFileSync(switchFilePath(), 'utf8');
    expect(content).toBe('/home/user/feat');
  });

  it('MATCH BY DIRECTORY NAME: writes target path to temp file', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/my-task', head: 'def456', branch: 'chore/my-task', isMain: false },
    ]);

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await program.parseAsync(['switch', 'my-task'], { from: 'user' });

    const content = originalReadFileSync(switchFilePath(), 'utf8');
    expect(content).toBe('/home/user/my-task');
  });

  it('FILE MODE: temp file is written with mode 0o600', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'abc123', branch: 'feature/my-feat', isMain: false },
    ]);

    const writeFileSpy = vi.spyOn(fs, 'writeFileSync');

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await program.parseAsync(['switch', 'my-feat'], { from: 'user' });

    expect(writeFileSpy).toHaveBeenCalledWith(
      expect.any(String),
      '/home/user/feat',
      { mode: 0o600 },
    );
  });

  it('NOT FOUND: writes error to stderr, calls exit(1), no temp file created', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/main', head: 'abc123', branch: 'main', isMain: true },
    ]);

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await expect(
      program.parseAsync(['switch', 'nonexistent'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    expect(stderrSpy).toHaveBeenCalled();
    const stderrArg = stderrSpy.mock.calls[0]?.[0] as string;
    expect(stderrArg).toContain('nonexistent');
    expect(fs.existsSync(switchFilePath())).toBe(false);
  });

  it('NO TTY HINT: no "treeji setup" hint ever written to stderr on success', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'abc123', branch: 'feature/my-feat', isMain: false },
    ]);

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await program.parseAsync(['switch', 'my-feat'], { from: 'user' });

    const stderrCalls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrCalls).not.toContain('Tip:');
    expect(stderrCalls).not.toContain('treeji setup');
  });
});

describe('switch command — interactive mode (no name arg)', () => {
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
    mockSelect.mockClear();
    mockIsCancel.mockClear();

    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new ExitError(typeof code === 'number' ? code : 0);
    });

    // Default: wrapper present
    vi.spyOn(fs, 'readFileSync').mockImplementation(mockReadFileSyncWrapperPresent);

    try { fs.unlinkSync(switchFilePath()); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try { fs.unlinkSync(switchFilePath()); } catch { /* ignore */ }
  });

  it('WRAPPER ABSENT: exits 1 with shell wrapper not installed message, select() not called', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(mockReadFileSyncWrapperAbsent);

    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'def456', branch: 'feature/my-feat', isMain: false },
    ]);

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await expect(
      program.parseAsync(['switch'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    const stderrCalls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrCalls).toContain('shell wrapper not installed');
    expect(mockSelect).not.toHaveBeenCalled();
    expect(fs.existsSync(switchFilePath())).toBe(false);
  });

  it('INTERACTIVE PICK: writes selected path to temp file', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/main', head: 'abc123', branch: 'main', isMain: true },
      { path: '/home/user/feat', head: 'def456', branch: 'feature/my-feat', isMain: false },
    ]);
    mockSelect.mockResolvedValue('/home/user/feat');
    mockIsCancel.mockReturnValue(false);

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await program.parseAsync(['switch'], { from: 'user' });

    const content = originalReadFileSync(switchFilePath(), 'utf8');
    expect(content).toBe('/home/user/feat');
  });

  it('INTERACTIVE PICK: select() renders to stdout (no output:stderr)', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/main', head: 'abc123', branch: 'main', isMain: true },
      { path: '/home/user/feat', head: 'def456', branch: 'feature/my-feat', isMain: false },
    ]);
    mockSelect.mockResolvedValue('/home/user/feat');
    mockIsCancel.mockReturnValue(false);

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await program.parseAsync(['switch'], { from: 'user' });

    expect(mockSelect).toHaveBeenCalledWith(
      expect.not.objectContaining({ output: process.stderr })
    );
  });

  it('INTERACTIVE CANCEL: exits 1, no temp file created', async () => {
    const cancelSymbol = Symbol('cancel');
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      { path: '/home/user/feat', head: 'def456', branch: 'feature/my-feat', isMain: false },
    ]);
    mockSelect.mockResolvedValue(cancelSymbol);
    mockIsCancel.mockReturnValue(true);

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await expect(
      program.parseAsync(['switch'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    expect(fs.existsSync(switchFilePath())).toBe(false);
  });

  it('NO WORKTREES: exits 1 with stderr message, no select(), no temp file', async () => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([]);

    const { registerSwitchCommand } = await import('./switch.js');
    const program = new Command();
    program.exitOverride();
    registerSwitchCommand(program);

    await expect(
      program.parseAsync(['switch'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    expect(stderrSpy).toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
    expect(fs.existsSync(switchFilePath())).toBe(false);
  });
});
