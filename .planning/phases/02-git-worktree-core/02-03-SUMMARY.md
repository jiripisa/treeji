---
phase: 02-git-worktree-core
plan: 03
subsystem: commands
tags: [tdd, list, chalk, table, git-worktree]
dependency_graph:
  requires: [02-01]
  provides: [registerListCommand, mafcli-list-command]
  affects: [src/index.ts]
tech_stack:
  added: []
  patterns: [chalk colored table, Promise.all parallel git calls, TDD red-green]
key_files:
  created:
    - src/commands/list.ts
    - src/commands/list.test.ts
  modified: []
decisions:
  - "Use chalk.red/chalk.green for dirty/clean coloring — no cli-table3 dependency per research recommendation (D-03)"
  - "Pad columns with padEnd for alignment — simpler than third-party table lib for 5 columns"
  - "Gather per-worktree data in parallel via Promise.all for performance"
metrics:
  duration: "3min"
  completed: "2026-04-02T11:09:31Z"
  tasks: 1
  files: 2
---

# Phase 2 Plan 03: list command — colored worktree table Summary

Implements `mafcli list` as a chalk-colored aligned table showing branch, dirty/clean status, ↑N ↓M ahead/behind, relative commit age, and path for all worktrees.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | list.test.ts RED then list.ts GREEN | 5417cf8 | src/commands/list.ts, src/commands/list.test.ts |

## What Was Built

`src/commands/list.ts` — exports `registerListCommand` that:
1. Calls `gitWorktreeList()` + `parseWorktreeList()` to get all worktrees
2. Gathers status for each worktree in parallel via `Promise.all([gitStatusPorcelain, gitAheadBehind, gitLastCommitRelativeDate])`
3. Renders a padEnd-aligned table with 5 columns: branch, status (dirty/clean in red/green), remote (↑N ↓M), age, path
4. Handles empty worktree list gracefully with "No worktrees found." message

`src/commands/list.test.ts` — 5 test cases:
1. Clean worktree row — verifies branch, age, ↑0 ↓0, no "dirty" in output
2. Dirty worktree row — verifies "dirty" indicator present
3. No upstream — verifies no error thrown, ↑0 ↓0 shown
4. Multiple worktrees — both branch names in output
5. Empty list — graceful exit, no crash

## Decisions Made

- No cli-table3 dependency — chalk + padEnd is sufficient for 5 columns (research D-03 recommendation)
- `chalk.red('dirty  ')` / `chalk.green('clean  ')` — 7-char padded labels for alignment
- `↑${ahead} ↓${behind}`.padEnd(10) — Unicode arrow format per D-03

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows from real git.ts functions (mocked in tests, real in integration).

## Self-Check: PASSED

- [x] src/commands/list.ts exists
- [x] src/commands/list.test.ts exists
- [x] Commit 5417cf8 exists
- [x] 5 test cases pass
- [x] grep "chalk.red\|chalk.green" returns match
- [x] grep "registerListCommand" returns match
- [x] grep "↑.*↓\|aheadBehind" returns match
