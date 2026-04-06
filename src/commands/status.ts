import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import {
  gitWorktreeList,
  parseWorktreeList,
  gitListBranches,
  gitStatusPorcelain,
  gitAheadBehind,
  gitLastCommitRelativeDate,
} from '../lib/git.js';
import { fetchAssignedIssues } from '../lib/jira.js';
import { colorStatus, extractTicketKey } from '../commands/list.js';
import { loadConfig } from '../lib/config.js';
import type { WorktreeInfo } from '../types/worktree.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JiraIssue {
  key: string;
  summary: string;
  statusName: string;
}

export interface StatusEntry {
  state: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  jira: JiraIssue | null;
  branch: string | null;
  worktree: WorktreeInfo | null;
}

const MAIN_BRANCHES = new Set(['main', 'master']);

// ─── Classification ───────────────────────────────────────────────────────────

/**
 * Pure function — maps three data sources into unified StatusEntry list.
 * No git/jira I/O here; all I/O happens in the command action.
 */
export function classify(
  jiraIssues: JiraIssue[],
  filteredBranches: string[],
  worktrees: WorktreeInfo[],
): StatusEntry[] {
  // Build lookup maps
  const jiraByKey = new Map<string, JiraIssue>(jiraIssues.map((i) => [i.key, i]));
  const worktreeByBranch = new Map<string, WorktreeInfo>(
    worktrees.filter((wt) => wt.branch !== null).map((wt) => [wt.branch!, wt]),
  );
  const branchByTicketKey = new Map<string, string>();
  for (const branch of filteredBranches) {
    const key = extractTicketKey(branch);
    if (key) branchByTicketKey.set(key, branch);
  }

  const entries: StatusEntry[] = [];
  const visitedJiraKeys = new Set<string>();
  const visitedBranches = new Set<string>();
  const visitedWorktreePaths = new Set<string>();

  // Pass 1: Walk JIRA issues → states 1, 2, 3, 7
  for (const issue of jiraIssues) {
    const branch = branchByTicketKey.get(issue.key) ?? null;

    if (branch !== null) {
      // Has a matching branch
      const worktree = worktreeByBranch.get(branch) ?? null;
      const state: 1 | 2 = worktree !== null ? 1 : 2;
      entries.push({ state, jira: issue, branch, worktree });
      visitedJiraKeys.add(issue.key);
      visitedBranches.add(branch);
      if (worktree) visitedWorktreePaths.add(worktree.path);
    } else {
      // No matching branch — check for state 7: JIRA + Worktree but branch deleted
      // A worktree whose branch extracts this ticket key but branch is NOT in filteredBranches
      let state7Worktree: WorktreeInfo | null = null;
      for (const wt of worktrees) {
        if (!visitedWorktreePaths.has(wt.path) && wt.branch !== null) {
          const wtKey = extractTicketKey(wt.branch);
          if (wtKey === issue.key && !filteredBranches.includes(wt.branch)) {
            state7Worktree = wt;
            break;
          }
        }
      }

      if (state7Worktree !== null) {
        entries.push({ state: 7, jira: issue, branch: null, worktree: state7Worktree });
        visitedJiraKeys.add(issue.key);
        visitedWorktreePaths.add(state7Worktree.path);
      } else {
        // State 3: JIRA only
        entries.push({ state: 3, jira: issue, branch: null, worktree: null });
        visitedJiraKeys.add(issue.key);
      }
    }
  }

  // Pass 2: Walk branches not yet visited → states 4, 5
  for (const branch of filteredBranches) {
    if (visitedBranches.has(branch)) continue;
    const worktree = worktreeByBranch.get(branch) ?? null;
    const state: 4 | 5 = worktree !== null ? 4 : 5;
    entries.push({ state, jira: null, branch, worktree });
    visitedBranches.add(branch);
    if (worktree) visitedWorktreePaths.add(worktree.path);
  }

  // Pass 3: Walk worktrees not yet visited → state 6
  // Skip main worktrees whose branch is filtered out (D-01): they are excluded, not "detached"
  const filteredBranchSet = new Set(filteredBranches);
  for (const wt of worktrees) {
    if (visitedWorktreePaths.has(wt.path)) continue;
    // If this worktree's branch is a main/master branch that was filtered out, skip it
    if (wt.branch !== null && MAIN_BRANCHES.has(wt.branch) && !filteredBranchSet.has(wt.branch)) {
      continue;
    }
    entries.push({ state: 6, jira: null, branch: wt.branch, worktree: wt });
    visitedWorktreePaths.add(wt.path);
  }

  return entries;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function jiraPartCompact(issue: JiraIssue, host: string | undefined): string {
  const url = host ? `${host}/browse/${issue.key}` : '';
  const link = `\x1b]8;;${url}\x1b\\${issue.key}\x1b]8;;\x1b\\`;
  return `${link} (${colorStatus(issue.statusName)})`;
}

function renderCompactRow(entry: StatusEntry, host: string | undefined): void {
  const parts: string[] = [];
  if (entry.jira) parts.push(jiraPartCompact(entry.jira, host));
  if (entry.branch) parts.push(chalk.cyan(entry.branch));
  if (entry.worktree) parts.push(chalk.green('✓ worktree'));
  console.log('  ' + parts.join(chalk.dim(' → ')));
}

interface FullRowData {
  entry: StatusEntry;
  status: string;
  ahead: number;
  behind: number;
  age: string;
}

function renderFullRows(
  rowDataList: FullRowData[],
  host: string | undefined,
): void {
  if (rowDataList.length === 0) return;

  // Compute column widths
  const jiraWidth = Math.max(
    'jira'.length,
    ...rowDataList.map((r) =>
      r.entry.jira ? `${r.entry.jira.key} (${r.entry.jira.statusName})`.length : 0,
    ),
  );
  const branchWidth = Math.max(
    'branch'.length,
    ...rowDataList.map((r) => (r.entry.branch ?? '—').length),
  );
  const statusWidth = Math.max(
    'status'.length,
    ...rowDataList.map((r) => {
      if (!r.entry.worktree) return '—'.length;
      const isDirty = r.status.trim().length > 0;
      return `${isDirty ? '✗' : '✓'} ↑${r.ahead} ↓${r.behind}`.length;
    }),
  );
  const ageWidth = Math.max(
    'age'.length,
    ...rowDataList.map((r) => (r.entry.worktree ? r.age : '—').length),
  );

  // Header
  console.log(
    'jira'.padEnd(jiraWidth + 2) +
      'branch'.padEnd(branchWidth + 2) +
      'status'.padEnd(statusWidth + 2) +
      'age'.padEnd(ageWidth + 2) +
      'path',
  );
  console.log(
    '─'.repeat(jiraWidth + 2 + branchWidth + 2 + statusWidth + 2 + ageWidth + 2 + 'path'.length),
  );

  for (const r of rowDataList) {
    const { entry } = r;

    // JIRA cell
    const jiraVisible = entry.jira
      ? `${entry.jira.key} (${entry.jira.statusName})`
      : '';
    let jiraCol: string;
    if (entry.jira) {
      const url = host ? `${host}/browse/${entry.jira.key}` : '';
      const link = `\x1b]8;;${url}\x1b\\${entry.jira.key}\x1b]8;;\x1b\\`;
      jiraCol = `${link} (${colorStatus(entry.jira.statusName)})`;
    } else {
      jiraCol = '';
    }
    jiraCol += ' '.repeat(Math.max(0, jiraWidth + 2 - jiraVisible.length));

    // Branch cell
    const branchVisible = entry.branch ?? '—';
    const branchCol = branchVisible.padEnd(branchWidth + 2);

    // Status cell
    let statusVisible: string;
    let statusCol: string;
    if (entry.worktree) {
      const isDirty = r.status.trim().length > 0;
      const flag = isDirty ? chalk.red('✗') : chalk.green('✓');
      statusVisible = `${isDirty ? '✗' : '✓'} ↑${r.ahead} ↓${r.behind}`;
      statusCol = `${flag} ↑${r.ahead} ↓${r.behind}` + ' '.repeat(Math.max(0, statusWidth + 2 - statusVisible.length));
    } else {
      statusVisible = '—';
      statusCol = '—'.padEnd(statusWidth + 2);
    }

    // Age cell
    const ageVisible = entry.worktree ? r.age : '—';
    const ageCol = ageVisible.padEnd(ageWidth + 2);

    // Path cell
    const pathCol = entry.worktree ? path.basename(entry.worktree.path) : '—';

    console.log(jiraCol + branchCol + statusCol + ageCol + pathCol);
  }
}

async function gatherFullRowData(entries: StatusEntry[]): Promise<FullRowData[]> {
  return Promise.all(
    entries.map(async (entry) => {
      if (!entry.worktree) {
        return { entry, status: '', ahead: 0, behind: 0, age: '—' };
      }
      const [status, ab, age] = await Promise.all([
        gitStatusPorcelain(entry.worktree.path),
        gitAheadBehind(entry.worktree.path),
        gitLastCommitRelativeDate(entry.worktree.path),
      ]);
      return { entry, status, ahead: ab.ahead, behind: ab.behind, age };
    }),
  );
}

function renderSection(
  title: string,
  entries: StatusEntry[],
  full: boolean,
  host: string | undefined,
  fullRowData?: FullRowData[],
): void {
  if (entries.length === 0) return; // D-08: hide empty sections
  console.log(chalk.bold(title));
  if (full && fullRowData) {
    renderFullRows(fullRowData, host);
  } else {
    for (const entry of entries) {
      renderCompactRow(entry, host);
    }
  }
  console.log(); // blank line between sections
}

// ─── Command registration ──────────────────────────────────────────────────────

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Unified dashboard of worktrees, branches, and JIRA tickets')
    .option('--full', 'Show detailed table view instead of compact summary')
    .option('--all', 'Include closed/done JIRA tickets')
    .action(async (opts: { full?: boolean; all?: boolean }) => {
      const includeAll = opts.all ?? false;
      const full = opts.full ?? false;

      // Parallel fetch — JIRA failure is gracefully degraded (Pitfall 2)
      let jiraWarning = false;
      const [porcelain, branches, jiraResult] = await Promise.all([
        gitWorktreeList(),
        gitListBranches(),
        fetchAssignedIssues(50, includeAll).catch(() => {
          jiraWarning = true;
          return [] as JiraIssue[];
        }),
      ]);

      const worktrees = parseWorktreeList(porcelain);

      // Main/master filter (D-01): exclude main/master unless dirty or unpushed
      const mainWorktree = worktrees.find((wt) => wt.isMain);
      let includeMain = false;
      if (mainWorktree) {
        const [mainStatus, mainAB] = await Promise.all([
          gitStatusPorcelain(mainWorktree.path),
          gitAheadBehind(mainWorktree.path),
        ]);
        includeMain = mainStatus.trim().length > 0 || mainAB.ahead > 0;
      }

      const filteredBranches = branches.filter(
        (b) => !MAIN_BRANCHES.has(b) || includeMain,
      );

      const entries = classify(jiraResult, filteredBranches, worktrees);
      const { host } = loadConfig();

      // Group by state
      const byState = (s: number) => entries.filter((e) => e.state === s);

      const sections: Array<{ title: string; state: number }> = [
        { title: 'Active work', state: 1 },
        { title: 'Branch only', state: 2 },
        { title: 'Not started', state: 3 },
        { title: 'Local work', state: 4 },
        { title: 'Orphaned', state: 5 },
        { title: 'Detached', state: 6 },
        { title: 'Mismatched', state: 7 },
      ];

      if (full) {
        // Gather all per-worktree data in parallel for --full mode
        const allFullData = await gatherFullRowData(entries);
        for (const { title, state } of sections) {
          const sectionEntries = byState(state);
          if (sectionEntries.length === 0) continue;
          const sectionFullData = allFullData.filter((r) =>
            sectionEntries.includes(r.entry),
          );
          renderSection(title, sectionEntries, true, host, sectionFullData);
        }
      } else {
        for (const { title, state } of sections) {
          renderSection(title, byState(state), false, host);
        }
      }

      // JIRA warning at the bottom
      if (jiraWarning) {
        console.log(chalk.yellow('⚠ JIRA unreachable — ticket status unavailable'));
      }
    });
}
