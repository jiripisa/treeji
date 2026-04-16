import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock git library
const mockGetGitRoot = vi.fn();
const mockGitWorktreeAdd = vi.fn();

vi.mock('../lib/git.js', () => ({
  getGitRoot: (...args: unknown[]) => mockGetGitRoot(...args),
  gitWorktreeAdd: (...args: unknown[]) => mockGitWorktreeAdd(...args),
}));

// Mock slug library
const mockToSlug = vi.fn();
const mockValidateSlug = vi.fn();

vi.mock('../lib/slug.js', () => ({
  toSlug: (input: string) => mockToSlug(input),
  validateSlug: (slug: string) => mockValidateSlug(slug),
  SLUG_MAX_LENGTH: 50,
}));

// Mock @clack/prompts to avoid interactive TTY requirements
const mockCancel = vi.fn();
const mockOutro = vi.fn();
const mockSpinnerStart = vi.fn();
const mockSpinnerStop = vi.fn();

vi.mock('@clack/prompts', () => ({
  cancel: (...args: unknown[]) => mockCancel(...args),
  outro: (...args: unknown[]) => mockOutro(...args),
  spinner: vi.fn(() => ({ start: mockSpinnerStart, stop: mockSpinnerStop })),
}));

// Mock JIRA library
const mockFetchIssue = vi.fn();

vi.mock('../lib/jira.js', () => ({
  fetchIssue: (...args: unknown[]) => mockFetchIssue(...args),
}));

// Mock worktree-hooks
const mockMaybeCreateSymlinks = vi.fn();

vi.mock('../lib/worktree-hooks.js', () => ({
  maybeCreateSymlinks: (...args: unknown[]) => mockMaybeCreateSymlinks(...args),
}));

// Mock branch-type helper
const mockPromptBranchType = vi.fn();

vi.mock('../lib/branch-type.js', () => ({
  promptBranchType: (...args: unknown[]) => mockPromptBranchType(...args),
}));

describe('create command', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    mockGetGitRoot.mockClear();
    mockGitWorktreeAdd.mockClear();
    mockToSlug.mockClear();
    mockValidateSlug.mockClear();
    mockCancel.mockClear();
    mockOutro.mockClear();
    mockSpinnerStart.mockClear();
    mockSpinnerStop.mockClear();
    mockFetchIssue.mockClear();
    mockMaybeCreateSymlinks.mockClear();
    mockPromptBranchType.mockClear();

    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    mockMaybeCreateSymlinks.mockResolvedValue(undefined);

    // Default: git root returns a known path
    mockGetGitRoot.mockResolvedValue('/home/user/myrepo');
    // Default: gitWorktreeAdd resolves with { existed: false } (new branch)
    mockGitWorktreeAdd.mockResolvedValue({ existed: false });
    // Default: toSlug passes input through (simple slugify behavior)
    mockToSlug.mockImplementation((input: string) => input);
    // Default: validateSlug returns undefined (valid)
    mockValidateSlug.mockReturnValue(undefined);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('SUCCESS: creates worktree with correct branch name and path for clean slug', async () => {
    mockToSlug.mockReturnValue('my-feature');
    mockValidateSlug.mockReturnValue(undefined);

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await program.parseAsync(['create', 'my-feature', 'feature'], { from: 'user' });

    expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
      '/home/user/my-feature',
      'feature/my-feature',
    );
  });

  it('SUCCESS: Czech input is slugified before use — branch and path use cleaned slug', async () => {
    // 'přihlášení' slugifies to 'prihlaseni'
    mockToSlug.mockReturnValue('prihlaseni');
    mockValidateSlug.mockReturnValue(undefined);

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await program.parseAsync(['create', 'přihlášení', 'bugfix'], { from: 'user' });

    expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
      '/home/user/prihlaseni',
      'bugfix/prihlaseni',
    );
  });

  it('EMPTY SLUG ERROR: exits before calling gitWorktreeAdd when toSlug returns empty string', async () => {
    mockToSlug.mockReturnValue('');
    // validateSlug('') returns 'Slug cannot be empty'
    mockValidateSlug.mockReturnValue('Slug cannot be empty');

    class ExitError extends Error {
      code: number;
      constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
      }
    }
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new ExitError(Number(code ?? 1));
    });

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await expect(
      program.parseAsync(['create', '!!!', 'feature'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    expect(mockGitWorktreeAdd).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it('VALIDATION ERROR: exits before calling gitWorktreeAdd when validateSlug returns an error', async () => {
    mockToSlug.mockReturnValue('a'.repeat(60)); // exceeds max length after slugify
    mockValidateSlug.mockReturnValue('Slug must be at most 50 characters');

    class ExitError extends Error {
      code: number;
      constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
      }
    }
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new ExitError(Number(code ?? 1));
    });

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await expect(
      program.parseAsync(['create', 'a'.repeat(60), 'feature'], { from: 'user' })
    ).rejects.toThrow('exit 1');

    expect(mockGitWorktreeAdd).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it('TYPE VALIDATION: type with special chars is used as-is in branch name (no sanitization on type)', async () => {
    mockToSlug.mockReturnValue('my-feature');
    mockValidateSlug.mockReturnValue(undefined);

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await program.parseAsync(['create', 'my-feature', 'invalid-type!!!'], { from: 'user' });

    // type is used as-is in branch name — no sanitization
    expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
      '/home/user/my-feature',
      'invalid-type!!!/my-feature',
    );
  });

  describe('JIRA PATH', () => {
    it('SUCCESS: creates worktree from JIRA ticket ID using fetched summary as slug', async () => {
      mockFetchIssue.mockResolvedValue({ key: 'PROJ-123', summary: 'Fix login page', statusName: 'To Do' });
      mockToSlug.mockImplementation((input: string) => {
        if (input === 'Fix login page') return 'fix-login-page';
        return input;
      });

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      await program.parseAsync(['create', 'PROJ-123', 'feature'], { from: 'user' });

      expect(mockFetchIssue).toHaveBeenCalledWith('PROJ-123');
      expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
        '/home/user/PROJ-123-fix-login-page',
        'feature/PROJ-123-fix-login-page',
      );
    });

    it('EMPTY SLUG FALLBACK: falls back to ticket key when summary slugifies to empty string', async () => {
      mockFetchIssue.mockResolvedValue({ key: 'PROJ-456', summary: '!!!', statusName: '' });
      mockToSlug.mockImplementation((input: string) => {
        if (input === '!!!') return '';
        return input;
      });

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      await program.parseAsync(['create', 'PROJ-456', 'bugfix'], { from: 'user' });

      expect(mockFetchIssue).toHaveBeenCalledWith('PROJ-456');
      expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
        '/home/user/PROJ-456',
        'bugfix/PROJ-456',
      );
    });

    it('ERROR PROPAGATION: p.cancel and process.exit(1) called when fetchIssue throws', async () => {
      mockFetchIssue.mockRejectedValue(new Error('JIRA not configured. Run `treeji configure` first.'));

      class ExitError extends Error {
        code: number;
        constructor(code: number) {
          super(`exit ${code}`);
          this.code = code;
        }
      }
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new ExitError(Number(code ?? 1));
      });

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      await expect(
        program.parseAsync(['create', 'PROJ-789', 'feature'], { from: 'user' })
      ).rejects.toThrow('exit 1');

      expect(mockCancel).toHaveBeenCalledWith('JIRA not configured. Run `treeji configure` first.');
      expect(mockGitWorktreeAdd).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });

    it('MANUAL PATH PRESERVED: manual slug does not call fetchIssue', async () => {
      mockToSlug.mockReturnValue('my-feature');
      mockValidateSlug.mockReturnValue(undefined);

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      await program.parseAsync(['create', 'my-feature', 'feature'], { from: 'user' });

      expect(mockFetchIssue).not.toHaveBeenCalled();
      expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
        '/home/user/my-feature',
        'feature/my-feature',
      );
    });

    it('EXISTING BRANCH NOTE (JIRA PATH): when gitWorktreeAdd returns { existed: true }, note printed to stderr', async () => {
      mockFetchIssue.mockResolvedValue({ key: 'PROJ-123', summary: 'Fix login page', statusName: 'To Do' });
      mockToSlug.mockImplementation((input: string) => {
        if (input === 'Fix login page') return 'fix-login-page';
        return input;
      });
      mockGitWorktreeAdd.mockResolvedValue({ existed: true });

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      await program.parseAsync(['create', 'PROJ-123', 'feature'], { from: 'user' });

      const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
      expect(stderrOutput).toContain('Using existing branch:');
    });

    it('NO NOTE (JIRA PATH): when gitWorktreeAdd returns { existed: false }, note not printed', async () => {
      mockFetchIssue.mockResolvedValue({ key: 'PROJ-123', summary: 'Fix login page', statusName: 'To Do' });
      mockToSlug.mockImplementation((input: string) => {
        if (input === 'Fix login page') return 'fix-login-page';
        return input;
      });
      mockGitWorktreeAdd.mockResolvedValue({ existed: false });

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      await program.parseAsync(['create', 'PROJ-123', 'feature'], { from: 'user' });

      const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
      expect(stderrOutput).not.toContain('Using existing branch:');
    });

    it('SPINNER SHOWN: spinnerStart called before fetchIssue resolves, spinnerStop called after', async () => {
      let resolveIssue!: (value: { key: string; summary: string; statusName: string }) => void;
      const issuePromise = new Promise<{ key: string; summary: string; statusName: string }>((resolve) => {
        resolveIssue = resolve;
      });
      mockFetchIssue.mockReturnValue(issuePromise);
      mockToSlug.mockReturnValue('fix-login-page');

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      const parsePromise = program.parseAsync(['create', 'PROJ-123', 'feature'], { from: 'user' });

      // Allow microtasks to run so spinner.start is called
      await new Promise((r) => setTimeout(r, 0));
      expect(mockSpinnerStart).toHaveBeenCalled();
      expect(mockSpinnerStop).not.toHaveBeenCalled();

      resolveIssue({ key: 'PROJ-123', summary: 'Fix login page', statusName: 'To Do' });
      await parsePromise;

      expect(mockSpinnerStop).toHaveBeenCalled();
    });
  });

  it('EXISTING BRANCH NOTE (MANUAL PATH): when gitWorktreeAdd returns { existed: true }, note printed to stderr', async () => {
    mockToSlug.mockReturnValue('my-feature');
    mockValidateSlug.mockReturnValue(undefined);
    mockGitWorktreeAdd.mockResolvedValue({ existed: true });

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await program.parseAsync(['create', 'my-feature', 'feature'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrOutput).toContain('Using existing branch:');
  });

  it('NO NOTE (MANUAL PATH): when gitWorktreeAdd returns { existed: false }, note not printed', async () => {
    mockToSlug.mockReturnValue('my-feature');
    mockValidateSlug.mockReturnValue(undefined);
    mockGitWorktreeAdd.mockResolvedValue({ existed: false });

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await program.parseAsync(['create', 'my-feature', 'feature'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrOutput).not.toContain('Using existing branch:');
  });

  it('JIRA PREVIEW: prints branch and path to stderr before spinner starts for JIRA path', async () => {
    mockFetchIssue.mockResolvedValue({ key: 'PROJ-123', summary: 'Fix login page', statusName: 'To Do' });
    mockToSlug.mockImplementation((input: string) => {
      if (input === 'Fix login page') return 'fix-login-page';
      return input;
    });

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await program.parseAsync(['create', 'PROJ-123', 'feature'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrOutput).toContain('feature/PROJ-123-fix-login-page');
    expect(stderrOutput).toContain('PROJ-123-fix-login-page');
  });

  it('MANUAL PREVIEW: prints branch and path to stderr before spinner starts for manual path', async () => {
    mockToSlug.mockReturnValue('my-feature');
    mockValidateSlug.mockReturnValue(undefined);

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await program.parseAsync(['create', 'my-feature', 'feature'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrOutput).toContain('feature/my-feature');
    expect(stderrOutput).toContain('/home/user/my-feature');
  });

  it('SYMLINK HOOK: calls maybeCreateSymlinks after worktree creation (manual path)', async () => {
    mockToSlug.mockReturnValue('my-feature');
    mockValidateSlug.mockReturnValue(undefined);

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await program.parseAsync(['create', 'my-feature', 'feature'], { from: 'user' });

    expect(mockMaybeCreateSymlinks).toHaveBeenCalledWith('/home/user/myrepo', '/home/user/my-feature');
  });

  it('SYMLINK HOOK (JIRA PATH): calls maybeCreateSymlinks after worktree creation', async () => {
    mockFetchIssue.mockResolvedValue({ key: 'PROJ-123', summary: 'Fix login page', statusName: 'To Do' });
    mockToSlug.mockImplementation((input: string) => {
      if (input === 'Fix login page') return 'fix-login-page';
      return input;
    });

    const { registerCreateCommand } = await import('./create.js');
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program);

    await program.parseAsync(['create', 'PROJ-123', 'feature'], { from: 'user' });

    expect(mockMaybeCreateSymlinks).toHaveBeenCalledWith('/home/user/myrepo', '/home/user/PROJ-123-fix-login-page');
  });

  describe('OPTIONAL TYPE ARG', () => {
    it('PROMPT SHOWN: when type arg omitted, promptBranchType is called', async () => {
      mockToSlug.mockReturnValue('my-feature');
      mockValidateSlug.mockReturnValue(undefined);
      mockPromptBranchType.mockResolvedValue('fix');

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      await program.parseAsync(['create', 'my-feature'], { from: 'user' });

      expect(mockPromptBranchType).toHaveBeenCalled();
    });

    it('BRANCH NAME: when type omitted and promptBranchType returns "fix", branch is fix/slug', async () => {
      mockToSlug.mockReturnValue('my-feature');
      mockValidateSlug.mockReturnValue(undefined);
      mockPromptBranchType.mockResolvedValue('fix');

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      await program.parseAsync(['create', 'my-feature'], { from: 'user' });

      expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
        '/home/user/my-feature',
        'fix/my-feature',
      );
    });

    it('NONE TYPE (MANUAL PATH): when type omitted and promptBranchType returns "", branch is just slug without prefix', async () => {
      mockToSlug.mockReturnValue('my-feature');
      mockValidateSlug.mockReturnValue(undefined);
      mockPromptBranchType.mockResolvedValue('');

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      await program.parseAsync(['create', 'my-feature'], { from: 'user' });

      expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
        '/home/user/my-feature',
        'my-feature',
      );
    });

    it('NONE TYPE (JIRA PATH): when type omitted and promptBranchType returns "", branch is just ticketSlug without prefix', async () => {
      mockFetchIssue.mockResolvedValue({ key: 'PROJ-123', summary: 'Fix login page', statusName: 'To Do' });
      mockToSlug.mockImplementation((input: string) => {
        if (input === 'Fix login page') return 'fix-login-page';
        return input;
      });
      mockPromptBranchType.mockResolvedValue('');

      const { registerCreateCommand } = await import('./create.js');
      const program = new Command();
      program.exitOverride();
      registerCreateCommand(program);

      await program.parseAsync(['create', 'PROJ-123'], { from: 'user' });

      expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
        '/home/user/PROJ-123-fix-login-page',
        'PROJ-123-fix-login-page',
      );
    });
  });
});
