import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Module-scope mock functions (Phase 1 established pattern)
const mockGitWorktreeList = vi.fn();
const mockParseWorktreeList = vi.fn();
const mockGitStatusPorcelain = vi.fn();
const mockGitAheadBehind = vi.fn();
const mockGitLastCommitRelativeDate = vi.fn();

vi.mock('../lib/git.js', () => ({
  gitWorktreeList: (...args: unknown[]) => mockGitWorktreeList(...args),
  parseWorktreeList: (...args: unknown[]) => mockParseWorktreeList(...args),
  gitStatusPorcelain: (...args: unknown[]) => mockGitStatusPorcelain(...args),
  gitAheadBehind: (...args: unknown[]) => mockGitAheadBehind(...args),
  gitLastCommitRelativeDate: (...args: unknown[]) => mockGitLastCommitRelativeDate(...args),
}));

const mockFetchIssueStatuses = vi.fn();

vi.mock('../lib/jira.js', () => ({
  fetchIssueStatuses: (...args: unknown[]) => mockFetchIssueStatuses(...args),
}));

// Capture console.log output
const captureConsoleLog = () => {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  return { lines, spy };
};

describe('list command', () => {
  beforeEach(() => {
    mockGitWorktreeList.mockClear();
    mockParseWorktreeList.mockClear();
    mockGitStatusPorcelain.mockClear();
    mockGitAheadBehind.mockClear();
    mockGitLastCommitRelativeDate.mockClear();
    mockFetchIssueStatuses.mockClear();
    mockFetchIssueStatuses.mockResolvedValue(new Map()); // default: no JIRA statuses

    // Default return values
    mockGitWorktreeList.mockResolvedValue('worktree /repo\nHEAD abc123\nbranch refs/heads/main\n');
    mockParseWorktreeList.mockReturnValue([
      { path: '/repo', head: 'abc123', branch: 'main', isMain: true },
    ]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitAheadBehind.mockResolvedValue({ ahead: 0, behind: 0 });
    mockGitLastCommitRelativeDate.mockResolvedValue('1 hour ago');
  });

  describe('1. CLEAN WORKTREE ROW', () => {
    it('shows branch name, age, ahead/behind for a clean worktree', async () => {
      const { lines, spy } = captureConsoleLog();

      mockGitStatusPorcelain.mockResolvedValue('');
      mockGitAheadBehind.mockResolvedValue({ ahead: 0, behind: 0 });
      mockGitLastCommitRelativeDate.mockResolvedValue('1 hour ago');

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await program.parseAsync(['list'], { from: 'user' });

      spy.mockRestore();

      const output = lines.join('\n');
      expect(output).toContain('main');
      expect(output).toContain('1 hour ago');
      expect(output).toContain('↑0 ↓0');
      // Clean worktree should show ✓ symbol, not the word 'dirty'
      expect(output).not.toMatch(/dirty/);
      expect(output).toContain('✓');
      // name column shows basename of worktree path
      expect(output).toContain('repo');
      // Header should contain new column names
      const header = lines[0];
      expect(header).toContain('name');
      expect(header).toContain('branch');
      expect(header).toContain('jira status');
    });
  });

  describe('2. DIRTY WORKTREE ROW', () => {
    it('shows dirty indicator when worktree has uncommitted changes', async () => {
      const { lines, spy } = captureConsoleLog();

      mockGitStatusPorcelain.mockResolvedValue('M src/index.ts\n');
      mockGitAheadBehind.mockResolvedValue({ ahead: 1, behind: 0 });
      mockGitLastCommitRelativeDate.mockResolvedValue('2 hours ago');

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await program.parseAsync(['list'], { from: 'user' });

      spy.mockRestore();

      const output = lines.join('\n');
      expect(output).toContain('main');
      // Output should contain ✗ symbol for dirty worktree
      expect(output).toContain('✗');
    });
  });

  describe('3. NO UPSTREAM', () => {
    it('completes without error when worktree has no upstream, shows ↑0 ↓0', async () => {
      const { lines, spy } = captureConsoleLog();

      // gitAheadBehind returns {ahead:0, behind:0} even with no upstream
      mockGitAheadBehind.mockResolvedValue({ ahead: 0, behind: 0 });

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await expect(
        program.parseAsync(['list'], { from: 'user' })
      ).resolves.not.toThrow();

      spy.mockRestore();

      const output = lines.join('\n');
      expect(output).toContain('↑0 ↓0');
    });
  });

  describe('4. MULTIPLE WORKTREES', () => {
    it('shows all worktrees when multiple exist', async () => {
      const { lines, spy } = captureConsoleLog();

      mockParseWorktreeList.mockReturnValue([
        { path: '/repo', head: 'abc123', branch: 'main', isMain: true },
        { path: '/repo-feature', head: 'def456', branch: 'feature/PROJ-101', isMain: false },
      ]);
      mockGitStatusPorcelain.mockResolvedValue('');
      mockGitAheadBehind.mockResolvedValue({ ahead: 0, behind: 0 });
      mockGitLastCommitRelativeDate.mockResolvedValue('3 days ago');

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await program.parseAsync(['list'], { from: 'user' });

      spy.mockRestore();

      const output = lines.join('\n');
      expect(output).toContain('main');
      expect(output).toContain('feature/PROJ-101');
      // name column shows basenames of worktree directories
      expect(output).toContain('repo-feature');
      expect(output).toContain('repo');
    });
  });

  describe('5. EMPTY LIST', () => {
    it('exits gracefully when no worktrees found', async () => {
      const { lines, spy } = captureConsoleLog();

      mockParseWorktreeList.mockReturnValue([]);

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await expect(
        program.parseAsync(['list'], { from: 'user' })
      ).resolves.not.toThrow();

      spy.mockRestore();

      // Should not crash; output may be empty or contain a message
      // Just verify it ran without throwing
      expect(true).toBe(true);
    });
  });

  describe('JIRA STATUS COLUMN', () => {
    it('STATUS SHOWN: shows JIRA ticket status and key for matching branch', async () => {
      const { lines, spy } = captureConsoleLog();

      mockParseWorktreeList.mockReturnValue([
        { path: '/repo-feature', head: 'abc123', branch: 'feature/PROJ-123-fix-login', isMain: false },
      ]);
      mockFetchIssueStatuses.mockResolvedValue(new Map([['PROJ-123', 'In Progress']]));

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await program.parseAsync(['list'], { from: 'user' });

      spy.mockRestore();

      const output = lines.join('\n');
      expect(output).toContain('In Progress');
      expect(output).toContain('PROJ-123');
    });

    it('STATUS TO DO GREY: shows To Do status for ticket in To Do state', async () => {
      const { lines, spy } = captureConsoleLog();

      mockParseWorktreeList.mockReturnValue([
        { path: '/repo-feature', head: 'abc123', branch: 'feature/PROJ-456-oprava', isMain: false },
      ]);
      mockFetchIssueStatuses.mockResolvedValue(new Map([['PROJ-456', 'To Do']]));

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await program.parseAsync(['list'], { from: 'user' });

      spy.mockRestore();

      const output = lines.join('\n');
      expect(output).toContain('To Do');
    });

    it('STATUS DONE GREEN: shows Done status for completed ticket', async () => {
      const { lines, spy } = captureConsoleLog();

      mockParseWorktreeList.mockReturnValue([
        { path: '/repo-feature', head: 'abc123', branch: 'bugfix/PROJ-789-done-thing', isMain: false },
      ]);
      mockFetchIssueStatuses.mockResolvedValue(new Map([['PROJ-789', 'Done']]));

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await program.parseAsync(['list'], { from: 'user' });

      spy.mockRestore();

      const output = lines.join('\n');
      expect(output).toContain('Done');
    });

    it('JIRA UNREACHABLE: table still printed with branch name, warning shown below', async () => {
      const { lines, spy } = captureConsoleLog();

      mockParseWorktreeList.mockReturnValue([
        { path: '/repo-feature', head: 'abc123', branch: 'feature/PROJ-500-some-task', isMain: false },
      ]);
      mockFetchIssueStatuses.mockRejectedValue(new Error('Network error'));

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await program.parseAsync(['list'], { from: 'user' });

      spy.mockRestore();

      const output = lines.join('\n');
      expect(output).toContain('feature/PROJ-500-some-task');
      expect(output).toContain('⚠ JIRA unreachable');
    });

    it('NO TICKET KEY: fetchIssueStatuses not called when branch has no ticket ID', async () => {
      const { lines, spy } = captureConsoleLog();

      mockParseWorktreeList.mockReturnValue([
        { path: '/repo', head: 'abc123', branch: 'main', isMain: true },
      ]);

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await program.parseAsync(['list'], { from: 'user' });

      spy.mockRestore();

      expect(mockFetchIssueStatuses.mock.calls.length).toBe(0);
    });

    it('BATCH NOT N+1: fetchIssueStatuses called exactly once with all ticket keys', async () => {
      const { lines, spy } = captureConsoleLog();

      mockParseWorktreeList.mockReturnValue([
        { path: '/repo-a', head: 'abc123', branch: 'feature/PROJ-100', isMain: false },
        { path: '/repo-b', head: 'def456', branch: 'bugfix/PROJ-200', isMain: false },
      ]);
      mockFetchIssueStatuses.mockResolvedValue(new Map());

      const { registerListCommand } = await import('./list.js');
      const program = new Command();
      program.exitOverride();
      registerListCommand(program);

      await program.parseAsync(['list'], { from: 'user' });

      spy.mockRestore();

      expect(mockFetchIssueStatuses.mock.calls.length).toBe(1);
      const calledWith = mockFetchIssueStatuses.mock.calls[0][0] as string[];
      expect(calledWith).toHaveLength(2);
      expect(calledWith).toContain('PROJ-100');
      expect(calledWith).toContain('PROJ-200');
    });
  });
});
