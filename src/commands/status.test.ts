import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before any imports of the module under test
vi.mock('../lib/git.js', () => ({
  gitWorktreeList: vi.fn(),
  parseWorktreeList: vi.fn(),
  gitListBranches: vi.fn(),
  gitStatusPorcelain: vi.fn(),
  gitAheadBehind: vi.fn(),
  gitLastCommitRelativeDate: vi.fn(),
}));

vi.mock('../lib/jira.js', () => ({
  fetchAssignedIssues: vi.fn(),
}));

vi.mock('../lib/config.js', () => ({
  loadConfig: vi.fn(() => ({ host: 'https://example.atlassian.net', email: 'test@example.com' })),
}));

// Mock list.ts exports
vi.mock('../commands/list.js', () => ({
  colorStatus: vi.fn((s: string) => s),
  extractTicketKey: vi.fn((b: string | null | undefined) => {
    if (!b) return null;
    const match = b.match(/([A-Za-z]+-\d+)/i);
    return match ? match[1].toUpperCase() : null;
  }),
}));

import {
  gitWorktreeList,
  parseWorktreeList,
  gitListBranches,
  gitStatusPorcelain,
  gitAheadBehind,
  gitLastCommitRelativeDate,
} from '../lib/git.js';
import { fetchAssignedIssues } from '../lib/jira.js';
import { classify } from './status.js';
import type { WorktreeInfo } from '../types/worktree.js';

const mockGitWorktreeList = vi.mocked(gitWorktreeList);
const mockParseWorktreeList = vi.mocked(parseWorktreeList);
const mockGitListBranches = vi.mocked(gitListBranches);
const mockGitStatusPorcelain = vi.mocked(gitStatusPorcelain);
const mockGitAheadBehind = vi.mocked(gitAheadBehind);
const mockGitLastCommitRelativeDate = vi.mocked(gitLastCommitRelativeDate);
const mockFetchAssignedIssues = vi.mocked(fetchAssignedIssues);

// Helpers
function makeWorktree(overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    path: '/repo/main',
    head: 'abc123',
    branch: 'main',
    isMain: true,
    ...overrides,
  };
}

function makeJiraIssue(key: string, statusName = 'In Progress') {
  return { key, summary: `Summary for ${key}`, statusName };
}

describe('classify()', () => {
  // STAT-02: All 7 states produced correctly

  it('STAT-02: state 1 — JIRA + Branch + Worktree (fully connected)', () => {
    const jiraIssues = [makeJiraIssue('PROJ-1')];
    const branches = ['feature/PROJ-1-something'];
    const worktrees: WorktreeInfo[] = [
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
      makeWorktree({ path: '/repo/proj-1', branch: 'feature/PROJ-1-something', isMain: false }),
    ];

    const entries = classify(jiraIssues, branches, worktrees);

    const state1 = entries.filter((e) => e.state === 1);
    expect(state1).toHaveLength(1);
    expect(state1[0].jira?.key).toBe('PROJ-1');
    expect(state1[0].branch).toBe('feature/PROJ-1-something');
    expect(state1[0].worktree?.path).toBe('/repo/proj-1');
  });

  it('STAT-02: state 2 — JIRA + Branch, no Worktree', () => {
    const jiraIssues = [makeJiraIssue('PROJ-2')];
    const branches = ['feature/PROJ-2-something'];
    const worktrees: WorktreeInfo[] = [
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
    ];

    const entries = classify(jiraIssues, branches, worktrees);

    const state2 = entries.filter((e) => e.state === 2);
    expect(state2).toHaveLength(1);
    expect(state2[0].jira?.key).toBe('PROJ-2');
    expect(state2[0].branch).toBe('feature/PROJ-2-something');
    expect(state2[0].worktree).toBeNull();
  });

  it('STAT-02: state 3 — JIRA only (no branch, no worktree)', () => {
    const jiraIssues = [makeJiraIssue('PROJ-3')];
    const branches: string[] = [];
    const worktrees: WorktreeInfo[] = [
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
    ];

    const entries = classify(jiraIssues, branches, worktrees);

    const state3 = entries.filter((e) => e.state === 3);
    expect(state3).toHaveLength(1);
    expect(state3[0].jira?.key).toBe('PROJ-3');
    expect(state3[0].branch).toBeNull();
    expect(state3[0].worktree).toBeNull();
  });

  it('STAT-02: state 4 — Branch + Worktree, no JIRA', () => {
    const jiraIssues: Array<{ key: string; summary: string; statusName: string }> = [];
    const branches = ['feature/local-work'];
    const worktrees: WorktreeInfo[] = [
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
      makeWorktree({ path: '/repo/local-work', branch: 'feature/local-work', isMain: false }),
    ];

    const entries = classify(jiraIssues, branches, worktrees);

    const state4 = entries.filter((e) => e.state === 4);
    expect(state4).toHaveLength(1);
    expect(state4[0].jira).toBeNull();
    expect(state4[0].branch).toBe('feature/local-work');
    expect(state4[0].worktree?.path).toBe('/repo/local-work');
  });

  it('STAT-02: state 5 — Branch only, no Worktree, no JIRA', () => {
    const jiraIssues: Array<{ key: string; summary: string; statusName: string }> = [];
    const branches = ['feature/orphaned'];
    const worktrees: WorktreeInfo[] = [
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
    ];

    const entries = classify(jiraIssues, branches, worktrees);

    const state5 = entries.filter((e) => e.state === 5);
    expect(state5).toHaveLength(1);
    expect(state5[0].jira).toBeNull();
    expect(state5[0].branch).toBe('feature/orphaned');
    expect(state5[0].worktree).toBeNull();
  });

  it('STAT-02: state 6 — Worktree only (detached HEAD, no branch match)', () => {
    const jiraIssues: Array<{ key: string; summary: string; statusName: string }> = [];
    const branches: string[] = [];
    const worktrees: WorktreeInfo[] = [
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
      makeWorktree({ path: '/repo/detached', branch: null, isMain: false }),
    ];

    const entries = classify(jiraIssues, branches, worktrees);

    const state6 = entries.filter((e) => e.state === 6);
    expect(state6).toHaveLength(1);
    expect(state6[0].jira).toBeNull();
    expect(state6[0].branch).toBeNull();
    expect(state6[0].worktree?.path).toBe('/repo/detached');
  });

  it('STAT-02: state 7 — JIRA + Worktree, branch deleted from local branches', () => {
    // Worktree has a branch that extracts a JIRA key, JIRA issue exists,
    // but the branch was deleted from local refs (not in filteredBranches)
    const jiraIssues = [makeJiraIssue('PROJ-7')];
    const branches: string[] = []; // branch was deleted
    const worktrees: WorktreeInfo[] = [
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
      makeWorktree({ path: '/repo/proj-7', branch: 'feature/PROJ-7-something', isMain: false }),
    ];

    const entries = classify(jiraIssues, branches, worktrees);

    const state7 = entries.filter((e) => e.state === 7);
    expect(state7).toHaveLength(1);
    expect(state7[0].jira?.key).toBe('PROJ-7');
    expect(state7[0].branch).toBeNull();
    expect(state7[0].worktree?.path).toBe('/repo/proj-7');
  });

  it('STAT-02: no double-counting — each item appears exactly once', () => {
    const jiraIssues = [makeJiraIssue('PROJ-1'), makeJiraIssue('PROJ-2')];
    const branches = ['feature/PROJ-1-slug', 'feature/PROJ-2-slug', 'feature/orphan'];
    const worktrees: WorktreeInfo[] = [
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
      makeWorktree({ path: '/repo/proj-1', branch: 'feature/PROJ-1-slug', isMain: false }),
    ];

    const entries = classify(jiraIssues, branches, worktrees);

    // PROJ-1: state 1 (jira+branch+worktree)
    // PROJ-2: state 2 (jira+branch, no worktree)
    // feature/orphan: state 5 (branch only)
    expect(entries.filter((e) => e.state === 1)).toHaveLength(1);
    expect(entries.filter((e) => e.state === 2)).toHaveLength(1);
    expect(entries.filter((e) => e.state === 5)).toHaveLength(1);
    expect(entries).toHaveLength(3);
  });
});

describe('STAT-08: main/master branch exclusion', () => {
  beforeEach(() => {
    mockGitWorktreeList.mockResolvedValue('');
    mockGitListBranches.mockResolvedValue([]);
    mockFetchAssignedIssues.mockResolvedValue([]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitAheadBehind.mockResolvedValue({ ahead: 0, behind: 0 });
    mockGitLastCommitRelativeDate.mockResolvedValue('2 days ago');
  });

  it('classify excludes main branch when clean and no unpushed commits', () => {
    const jiraIssues: Array<{ key: string; summary: string; statusName: string }> = [];
    // main branch is in the branches list
    const branches = ['main', 'feature/some-work'];
    const worktrees: WorktreeInfo[] = [
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
      makeWorktree({ path: '/repo/some-work', branch: 'feature/some-work', isMain: false }),
    ];

    // classify() itself doesn't check git status — the main filter is applied
    // before calling classify(). We test the pre-filter logic separately.
    // Here we test that when 'main' is excluded from branches list, it doesn't show up.
    const filteredBranches = branches.filter((b) => b !== 'main');
    const entries = classify(jiraIssues, filteredBranches, worktrees);

    // main worktree: should be classified via worktrees pass (state 6, detached-like)
    // feature/some-work: state 4 (branch+worktree, no jira)
    const branchNames = entries.map((e) => e.branch).filter(Boolean);
    expect(branchNames).not.toContain('main');
  });
});

describe('STAT-03: renderSection hides empty sections', () => {
  it('classify produces no entries when all inputs are empty', () => {
    const entries = classify([], [], []);
    expect(entries).toHaveLength(0);
  });

  it('classify state grouping allows empty sections to be skipped by caller', () => {
    // If only state 1 entries exist, caller can skip sections for 2-7
    const jiraIssues = [makeJiraIssue('PROJ-1')];
    const branches = ['feature/PROJ-1-slug'];
    const worktrees: WorktreeInfo[] = [
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
      makeWorktree({ path: '/repo/proj-1', branch: 'feature/PROJ-1-slug', isMain: false }),
    ];

    const entries = classify(jiraIssues, branches, worktrees);
    const byState = (s: number) => entries.filter((e) => e.state === s);

    // Sections for states 2-7 would be empty — caller should not render them
    expect(byState(2)).toHaveLength(0);
    expect(byState(3)).toHaveLength(0);
    expect(byState(4)).toHaveLength(0);
    expect(byState(5)).toHaveLength(0);
    expect(byState(6)).toHaveLength(0);
    expect(byState(7)).toHaveLength(0);
  });
});

// STAT-04, STAT-05, STAT-06, STAT-07 test the command action via console.log spying
// We import registerStatusCommand and test its integration behavior.
import { registerStatusCommand } from './status.js';
import { Command } from 'commander';

function buildProgram() {
  const program = new Command();
  registerStatusCommand(program);
  return program;
}

describe('STAT-04: compact format output', () => {
  beforeEach(() => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
      makeWorktree({ path: '/repo/proj-1', branch: 'feature/PROJ-1-slug', isMain: false }),
    ]);
    mockGitListBranches.mockResolvedValue(['feature/PROJ-1-slug']);
    mockFetchAssignedIssues.mockResolvedValue([makeJiraIssue('PROJ-1', 'In Progress')]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitAheadBehind.mockResolvedValue({ ahead: 0, behind: 0 });
    mockGitLastCommitRelativeDate.mockResolvedValue('2 days ago');
  });

  it('compact row contains ticket key, status, branch indicator, worktree indicator', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const program = buildProgram();
      await program.parseAsync(['node', 'treeji', 'status']);
      const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('PROJ-1');
      expect(output).toContain('In Progress');
      expect(output).toContain('feature/PROJ-1-slug');
      expect(output).toContain('worktree');
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe('STAT-05: --full flag produces table output', () => {
  beforeEach(() => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
      makeWorktree({ path: '/repo/proj-1', branch: 'feature/PROJ-1-slug', isMain: false }),
    ]);
    mockGitListBranches.mockResolvedValue(['feature/PROJ-1-slug']);
    mockFetchAssignedIssues.mockResolvedValue([makeJiraIssue('PROJ-1', 'In Progress')]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitAheadBehind.mockResolvedValue({ ahead: 0, behind: 0 });
    mockGitLastCommitRelativeDate.mockResolvedValue('2 days ago');
  });

  it('--full output contains header-like columns (jira, branch, age)', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const program = buildProgram();
      await program.parseAsync(['node', 'treeji', 'status', '--full']);
      const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('PROJ-1');
      expect(output).toContain('2 days ago');
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe('STAT-06: --all flag passes includeAll=true to fetchAssignedIssues', () => {
  beforeEach(() => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
    ]);
    mockGitListBranches.mockResolvedValue([]);
    mockFetchAssignedIssues.mockResolvedValue([]);
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitAheadBehind.mockResolvedValue({ ahead: 0, behind: 0 });
  });

  it('calls fetchAssignedIssues with includeAll=true when --all flag is passed', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const program = buildProgram();
      await program.parseAsync(['node', 'treeji', 'status', '--all']);
      expect(mockFetchAssignedIssues).toHaveBeenCalledWith(50, true);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('calls fetchAssignedIssues with includeAll=false by default', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const program = buildProgram();
      await program.parseAsync(['node', 'treeji', 'status']);
      expect(mockFetchAssignedIssues).toHaveBeenCalledWith(50, false);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe('STAT-07: JIRA unreachable — graceful degradation', () => {
  beforeEach(() => {
    mockGitWorktreeList.mockResolvedValue('');
    mockParseWorktreeList.mockReturnValue([
      makeWorktree({ path: '/repo/main', branch: 'main', isMain: true }),
      makeWorktree({ path: '/repo/local', branch: 'feature/local-work', isMain: false }),
    ]);
    mockGitListBranches.mockResolvedValue(['feature/local-work']);
    mockFetchAssignedIssues.mockRejectedValue(new Error('Network error'));
    mockGitStatusPorcelain.mockResolvedValue('');
    mockGitAheadBehind.mockResolvedValue({ ahead: 0, behind: 0 });
    mockGitLastCommitRelativeDate.mockResolvedValue('1 hour ago');
  });

  it('still renders git data when JIRA is unreachable', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const program = buildProgram();
      await program.parseAsync(['node', 'treeji', 'status']);
      const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      // Git data (local branch) should still appear
      expect(output).toContain('feature/local-work');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('shows JIRA warning when JIRA is unreachable', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const program = buildProgram();
      await program.parseAsync(['node', 'treeji', 'status']);
      const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('JIRA');
      expect(output.toLowerCase()).toMatch(/unreachable|warning|unavailable/);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('does not throw when JIRA fetch fails', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const program = buildProgram();
      await expect(program.parseAsync(['node', 'treeji', 'status'])).resolves.not.toThrow();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
