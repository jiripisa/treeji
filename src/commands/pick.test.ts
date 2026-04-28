import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock git library
const mockGetGitRoot = vi.fn();
const mockGitWorktreeAdd = vi.fn();
const mockGitWorktreeList = vi.fn();
const mockParseWorktreeList = vi.fn();

vi.mock('../lib/git.js', () => ({
  getGitRoot: (...args: unknown[]) => mockGetGitRoot(...args),
  gitWorktreeAdd: (...args: unknown[]) => mockGitWorktreeAdd(...args),
  gitWorktreeList: (...args: unknown[]) => mockGitWorktreeList(...args),
  parseWorktreeList: (...args: unknown[]) => mockParseWorktreeList(...args),
}));

// Mock slug library
const mockToSlug = vi.fn();

vi.mock('../lib/slug.js', () => ({
  toSlug: (input: string) => mockToSlug(input),
}));

// Mock JIRA library
const mockFetchAssignedIssues = vi.fn();

vi.mock('../lib/jira.js', () => ({
  fetchAssignedIssues: (...args: unknown[]) => mockFetchAssignedIssues(...args),
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

// Mock branch-remote helper
const mockMaybeAdoptRemoteBranch = vi.fn();

vi.mock('../lib/branch-remote.js', () => ({
  maybeAdoptRemoteBranch: (...args: unknown[]) => mockMaybeAdoptRemoteBranch(...args),
}));

// Mock @clack/prompts
const mockCancel = vi.fn();
const mockOutro = vi.fn();
const mockSpinnerStart = vi.fn();
const mockSpinnerStop = vi.fn();
const mockSelect = vi.fn();
const mockIsCancel = vi.fn(() => false);

vi.mock('@clack/prompts', () => ({
  spinner: vi.fn(() => ({ start: mockSpinnerStart, stop: mockSpinnerStop })),
  select: (...args: unknown[]) => mockSelect(...args),
  isCancel: vi.fn(() => false),
  cancel: (...args: unknown[]) => mockCancel(...args),
  outro: (...args: unknown[]) => mockOutro(...args),
}));

// Import the isCancel mock so we can override per-test
const clackMock = await import('@clack/prompts');

describe('pick command', () => {
  const sampleIssues = [
    { key: 'PROJ-123', summary: 'Fix login page', statusName: 'In Progress' },
    { key: 'PROJ-456', summary: 'Add dashboard', statusName: 'To Do' },
  ];

  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockGetGitRoot.mockClear();
    mockGitWorktreeAdd.mockClear();
    mockGitWorktreeList.mockClear();
    mockParseWorktreeList.mockClear();
    mockToSlug.mockClear();
    // Default: no existing worktrees
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([]);
    mockFetchAssignedIssues.mockClear();
    mockMaybeCreateSymlinks.mockClear();
    mockPromptBranchType.mockClear();
    mockMaybeAdoptRemoteBranch.mockClear();
    // Default: helper says "do not adopt remote" — preserves existing test semantics.
    mockMaybeAdoptRemoteBranch.mockResolvedValue({ adopt: false });
    mockCancel.mockClear();
    mockOutro.mockClear();
    mockSpinnerStart.mockClear();
    mockSpinnerStop.mockClear();
    mockSelect.mockClear();
    mockIsCancel.mockClear();
    vi.mocked(clackMock.isCancel).mockClear();

    // Defaults
    mockGetGitRoot.mockResolvedValue('/home/user/myrepo');
    mockGitWorktreeAdd.mockResolvedValue({ existed: false });
    mockFetchAssignedIssues.mockResolvedValue(sampleIssues);
    mockSelect.mockResolvedValue(sampleIssues[0]);
    mockPromptBranchType.mockResolvedValue('feature');
    mockToSlug.mockImplementation((input: string) => {
      const slugs: Record<string, string> = {
        'Fix login page': 'fix-login-page',
        'Add dashboard': 'add-dashboard',
        '!!!': '',
      };
      return slugs[input] ?? input;
    });
    // Default: isCancel returns false (not cancelled)
    vi.mocked(clackMock.isCancel).mockImplementation(() => false);

    mockMaybeCreateSymlinks.mockResolvedValue(undefined);

    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('SUCCESS: correct ticket selected → fetchAssignedIssues called, p.select shown, promptBranchType called, gitWorktreeAdd called with correct path and branch', async () => {
    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await program.parseAsync(['pick'], { from: 'user' });

    expect(mockFetchAssignedIssues).toHaveBeenCalled();
    expect(mockSelect).toHaveBeenCalled();
    expect(mockPromptBranchType).toHaveBeenCalled();
    expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
      '/home/user/PROJ-123-fix-login-page',
      'feature/PROJ-123-fix-login-page',
      { fromRemote: false },
    );
    expect(mockOutro).toHaveBeenCalledWith('Branch: feature/PROJ-123-fix-login-page');
  });

  it('NONE TYPE: when promptBranchType returns empty string, branch name is just the ticketSlug (no prefix)', async () => {
    mockPromptBranchType.mockResolvedValue('');

    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await program.parseAsync(['pick'], { from: 'user' });

    expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
      '/home/user/PROJ-123-fix-login-page',
      'PROJ-123-fix-login-page',
      { fromRemote: false },
    );
    expect(mockOutro).toHaveBeenCalledWith('Branch: PROJ-123-fix-login-page');
  });

  it('EMPTY STATE: issues.length === 0 → p.outro called with "No assigned open tickets found.", gitWorktreeAdd NOT called', async () => {
    mockFetchAssignedIssues.mockResolvedValue([]);

    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await program.parseAsync(['pick'], { from: 'user' });

    expect(mockOutro).toHaveBeenCalledWith('No assigned open tickets found.');
    expect(mockGitWorktreeAdd).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('CANCEL ON SELECT: p.isCancel returns true for select result → p.cancel("Cancelled.") called, process.exit(0), gitWorktreeAdd NOT called', async () => {
    vi.mocked(clackMock.isCancel).mockImplementation((value) => value === mockSelect.mock.results[0]?.value);
    const cancelSymbol = Symbol('cancel');
    mockSelect.mockResolvedValue(cancelSymbol);
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

    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await expect(
      program.parseAsync(['pick'], { from: 'user' }),
    ).rejects.toThrow('exit 0');

    expect(mockCancel).toHaveBeenCalledWith('Cancelled.');
    expect(mockGitWorktreeAdd).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it('JIRA ERROR: fetchAssignedIssues rejects → spinner.stop("Failed to load tickets"), p.cancel called, process.exit(1)', async () => {
    mockFetchAssignedIssues.mockRejectedValue(new Error('JIRA not configured. Run `treeji configure` first.'));

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

    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await expect(
      program.parseAsync(['pick'], { from: 'user' }),
    ).rejects.toThrow('exit 1');

    expect(mockSpinnerStop).toHaveBeenCalledWith('Failed to load tickets');
    expect(mockCancel).toHaveBeenCalledWith('JIRA not configured. Run `treeji configure` first.');
    expect(mockGitWorktreeAdd).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it('SPINNER SHOWN: spinner.start called before fetchAssignedIssues resolves, spinner.stop called after', async () => {
    let resolveIssues!: (value: typeof sampleIssues) => void;
    const issuesPromise = new Promise<typeof sampleIssues>((resolve) => {
      resolveIssues = resolve;
    });
    mockFetchAssignedIssues.mockReturnValue(issuesPromise);

    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    const parsePromise = program.parseAsync(['pick'], { from: 'user' });

    // Allow microtasks to run so spinner.start is called
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSpinnerStart).toHaveBeenCalledWith('Loading assigned tickets...');
    expect(mockSpinnerStop).not.toHaveBeenCalled();

    resolveIssues(sampleIssues);
    await parsePromise;

    expect(mockSpinnerStop).toHaveBeenCalled();
  });

  it('EMPTY SUMMARY FALLBACK: selected issue.summary slugifies to "" → ticketSlug falls back to issue.key alone', async () => {
    const issueWithEmptySummary = { key: 'PROJ-999', summary: '!!!', statusName: 'To Do' };
    mockFetchAssignedIssues.mockResolvedValue([issueWithEmptySummary]);
    mockSelect.mockResolvedValue(issueWithEmptySummary);
    mockToSlug.mockImplementation((input: string) => {
      if (input === '!!!') return '';
      return input;
    });
    mockPromptBranchType.mockResolvedValue('bugfix');

    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await program.parseAsync(['pick'], { from: 'user' });

    expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
      '/home/user/PROJ-999',
      'bugfix/PROJ-999',
      { fromRemote: false },
    );
  });

  it('50 TICKETS NOTE: when issues.length === 50, stderr note written', async () => {
    const fiftyIssues = Array.from({ length: 50 }, (_, i) => ({
      key: `PROJ-${i + 1}`,
      summary: `Issue ${i + 1}`,
      statusName: 'To Do',
    }));
    mockFetchAssignedIssues.mockResolvedValue(fiftyIssues);
    mockSelect.mockResolvedValue(fiftyIssues[0]);
    mockToSlug.mockImplementation((input: string) => input.toLowerCase().replace(/\s+/g, '-'));

    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await program.parseAsync(['pick'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrOutput).toMatch(/50 tickets|first 50/);
  });

  it('EXISTING BRANCH NOTE: when gitWorktreeAdd returns { existed: true }, note printed to stderr containing branch name', async () => {
    mockGitWorktreeAdd.mockResolvedValue({ existed: true });

    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await program.parseAsync(['pick'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrOutput).toContain('Using existing branch:');
  });

  it('NO NOTE: when gitWorktreeAdd returns { existed: false }, note not printed', async () => {
    mockGitWorktreeAdd.mockResolvedValue({ existed: false });

    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await program.parseAsync(['pick'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrOutput).not.toContain('Using existing branch:');
  });

  it('NOT 50 TICKETS: when issues.length !== 50 (e.g. 2), no note written', async () => {
    // sampleIssues has 2 issues — default mock
    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await program.parseAsync(['pick'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrOutput).not.toMatch(/50 tickets|first 50/);
  });

  it('SYMLINK HOOK: calls maybeCreateSymlinks after worktree creation', async () => {
    const { registerPickCommand } = await import('./pick.js');
    const program = new Command();
    program.exitOverride();
    registerPickCommand(program);

    await program.parseAsync(['pick'], { from: 'user' });

    expect(mockMaybeCreateSymlinks).toHaveBeenCalledWith('/home/user/myrepo', '/home/user/PROJ-123-fix-login-page');
  });

  describe('REMOTE BRANCH ADOPTION', () => {
    it('ADOPT REMOTE: when maybeAdoptRemoteBranch returns { adopt: true }, gitWorktreeAdd called with { fromRemote: true }', async () => {
      mockMaybeAdoptRemoteBranch.mockResolvedValue({ adopt: true });

      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick'], { from: 'user' });

      expect(mockMaybeAdoptRemoteBranch).toHaveBeenCalledWith('feature/PROJ-123-fix-login-page');
      expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
        '/home/user/PROJ-123-fix-login-page',
        'feature/PROJ-123-fix-login-page',
        { fromRemote: true },
      );
    });

    it('DECLINE REMOTE: when maybeAdoptRemoteBranch returns { adopt: false }, gitWorktreeAdd called with { fromRemote: false }', async () => {
      mockMaybeAdoptRemoteBranch.mockResolvedValue({ adopt: false });

      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick'], { from: 'user' });

      expect(mockGitWorktreeAdd).toHaveBeenCalledWith(
        '/home/user/PROJ-123-fix-login-page',
        'feature/PROJ-123-fix-login-page',
        { fromRemote: false },
      );
    });
  });

  describe('FILTER ARGUMENT', () => {
    it('NO FILTER (backwards-compat): fetchAssignedIssues called with (50, false), all issues passed to p.select', async () => {
      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick'], { from: 'user' });

      expect(mockFetchAssignedIssues).toHaveBeenCalledWith(50, false);
      const optsArg = mockSelect.mock.calls[0][0] as { options: Array<{ value: { key: string } }> };
      expect(optsArg.options.map((o) => o.value.key)).toEqual(['PROJ-123', 'PROJ-456']);
    });

    it('FILTER MATCHES KEY: only matching issue passed to p.select', async () => {
      mockFetchAssignedIssues.mockResolvedValue([
        { key: 'PROJ-123', summary: 'Foo', statusName: 'To Do' },
        { key: 'OTHER-9', summary: 'Bar', statusName: 'To Do' },
      ]);
      // Default mockSelect resolves to sampleIssues[0]; not relevant for assertion here.

      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick', 'PROJ'], { from: 'user' });

      const optsArg = mockSelect.mock.calls[0][0] as { options: Array<{ value: { key: string } }> };
      expect(optsArg.options.map((o) => o.value.key)).toEqual(['PROJ-123']);
    });

    it('FILTER MATCHES SUMMARY: only matching issue passed to p.select', async () => {
      mockFetchAssignedIssues.mockResolvedValue([
        { key: 'PROJ-1', summary: 'Login bug', statusName: 'To Do' },
        { key: 'PROJ-2', summary: 'Dashboard work', statusName: 'To Do' },
      ]);

      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick', 'login'], { from: 'user' });

      const optsArg = mockSelect.mock.calls[0][0] as { options: Array<{ value: { key: string } }> };
      expect(optsArg.options.map((o) => o.value.key)).toEqual(['PROJ-1']);
    });

    it('CASE-INSENSITIVE summary match: lowercase filter matches uppercase summary', async () => {
      mockFetchAssignedIssues.mockResolvedValue([
        { key: 'PROJ-1', summary: 'LOGIN bug', statusName: 'To Do' },
      ]);

      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick', 'login'], { from: 'user' });

      const optsArg = mockSelect.mock.calls[0][0] as { options: Array<{ value: { key: string } }> };
      expect(optsArg.options.map((o) => o.value.key)).toEqual(['PROJ-1']);
    });

    it('CASE-INSENSITIVE key match: lowercase filter matches uppercase key', async () => {
      mockFetchAssignedIssues.mockResolvedValue([
        { key: 'PROJ-1', summary: 'whatever', statusName: 'To Do' },
      ]);

      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick', 'proj'], { from: 'user' });

      const optsArg = mockSelect.mock.calls[0][0] as { options: Array<{ value: { key: string } }> };
      expect(optsArg.options.map((o) => o.value.key)).toEqual(['PROJ-1']);
    });

    it('SUBSTRING (not just prefix): mid-string match in key works', async () => {
      mockFetchAssignedIssues.mockResolvedValue([
        { key: 'PROJ-123', summary: 'Foo', statusName: 'To Do' },
      ]);

      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick', 'OJ-1'], { from: 'user' });

      const optsArg = mockSelect.mock.calls[0][0] as { options: Array<{ value: { key: string } }> };
      expect(optsArg.options.map((o) => o.value.key)).toEqual(['PROJ-123']);
    });

    it('INCLUDE ALL WHEN FILTER PROVIDED: fetchAssignedIssues called with (50, true)', async () => {
      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick', 'ABC'], { from: 'user' });

      expect(mockFetchAssignedIssues).toHaveBeenCalledWith(50, true);
    });

    it('INCLUDE ALL FALSE WHEN NO FILTER: fetchAssignedIssues called with (50, false)', async () => {
      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick'], { from: 'user' });

      expect(mockFetchAssignedIssues).toHaveBeenCalledWith(50, false);
    });

    it('NO MATCH EMPTY STATE: p.outro called with filter-aware message; p.select NOT called', async () => {
      mockFetchAssignedIssues.mockResolvedValue([
        { key: 'PROJ-1', summary: 'Foo', statusName: 'To Do' },
      ]);

      const { registerPickCommand } = await import('./pick.js');
      const program = new Command();
      program.exitOverride();
      registerPickCommand(program);

      await program.parseAsync(['pick', 'XYZ'], { from: 'user' });

      expect(mockOutro).toHaveBeenCalledWith('No tickets matching "XYZ".');
      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockGitWorktreeAdd).not.toHaveBeenCalled();
    });
  });
});
