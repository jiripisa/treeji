---
phase: quick
plan: 260403-nwk
subsystem: cli/list
tags: [table-layout, list-command, jira-status]
dependency_graph:
  requires: []
  provides: [7-column-list-table]
  affects: [src/commands/list.ts, src/commands/list.test.ts]
tech_stack:
  added: [node:path]
  patterns: [basename-for-name-column, split-ticket-columns]
key_files:
  created: []
  modified:
    - src/commands/list.ts
    - src/commands/list.test.ts
decisions:
  - Used path.basename(wt.path) for name column — more scannable than full paths
  - Split combined ticket column into ticketKeyWidth + jiraStatusWidth — key and status independently readable
  - ticketKeyCol renders plain text; jiraStatusCol applies colorStatus() — aligns with column purpose
metrics:
  duration: 5min
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 260403-nwk: list — restructure columns Summary

**One-liner:** Restructured list table from 6 to 7 columns with basename name column, removed path column, and split ticket+status into two independent columns.

## What Was Changed

### src/commands/list.ts

- Added `import path from 'node:path'` (node: prefix per nodenext conventions)
- New column order: `name | status | branch | remote | age | ticket | jira status`
- **name column** — `path.basename(wt.path)`, width computed from all basenames
- **branch column** — moved from first position to third; now its own dedicated column
- **ticket column** — plain text ticket key only (e.g. `PROJ-123`), no color; uses `ticketKeyWidth`
- **jira status column** — colored status string via `colorStatus()`; uses `jiraStatusWidth` (raw string length pre-color)
- Removed `pathWidth` variable and `wt.path` from data row output
- Removed combined `ticketWidth` variable; replaced by `ticketKeyWidth` and `jiraStatusWidth`

### src/commands/list.test.ts

- Added `name` column assertions in "1. CLEAN WORKTREE ROW": `expect(output).toContain('repo')`
- Added header column assertions: `name`, `branch`, `jira status` present in `lines[0]`
- Added name column assertions in "4. MULTIPLE WORKTREES": `repo-feature` and `repo` both appear
- All 11 existing tests continue to pass without modification to their core assertions

## Final Column Structure

```
name      status  branch              remote    age         ticket    jira status
────────────────────────────────────────────────────────────────────────────────
repo      ✓       main                ↑0 ↓0     1 hour ago
repo-feat ✓       feature/PROJ-123    ↑1 ↓0     2 days ago  PROJ-123  In Progress
```

## Decisions Made

1. **basename for name column** — Worktree directories have descriptive names (repo, repo-feature) that are more scannable than full absolute paths. The full path was not useful in day-to-day scanning.

2. **Separate ticket key and JIRA status columns** — Allows user to see ticket key (`PROJ-123`) even when JIRA is unreachable (key comes from branch name, not API). Status column independently shows API result.

3. **Plain text for ticket key** — No chalk coloring on ticket key column; color reserved for JIRA status only to avoid visual noise.

4. **jiraStatusWidth uses raw string length** — `colorStatus()` wraps text in ANSI codes that inflate `.length`. Width is computed from the pre-colorStatus string; colorStatus() applied only in the rendered cell.

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing TypeScript errors in `src/commands/switch.test.ts` (Buffer type mismatch) were discovered during `tsc --noEmit`. These are out of scope for this task and deferred per scope boundary rules.

## Self-Check: PASSED

- src/commands/list.ts: FOUND
- src/commands/list.test.ts: FOUND
- SUMMARY.md: FOUND
- Commit 8acbef9 (Task 1): FOUND
- Commit ce15da8 (Task 2): FOUND
