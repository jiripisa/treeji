---
phase: quick-260406-9ea
plan: "01"
subsystem: remove-command
tags: [ux, remove, worktrees, blocked-list, chalk]
dependency_graph:
  requires: []
  provides: [blocked-worktree-listing-before-picker]
  affects: [src/commands/remove.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, chalk-colored-output, promise-all-classification]
key_files:
  created: []
  modified:
    - src/commands/remove.ts
    - src/commands/remove.test.ts
decisions:
  - "Classify worktrees via Promise.all returning tagged union { kind: 'safe' | 'blocked', wt, reasons } — avoids double-pass and keeps categorisation logic local"
  - "chalk.yellow for worktree name, chalk.dim for reason string — consistent with list command coloring conventions"
metrics:
  duration: "2 minutes"
  completed: "2026-04-06"
  tasks_completed: 1
  files_modified: 2
---

# Quick Task 260406-9ea: Show Blocked Worktrees Before Interactive Picker — Summary

**One-liner:** Print dirty / no-remote worktrees with chalk-colored reasons before the safe-picker in `treeji remove`, so users understand why certain worktrees are absent from the selection list.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Add failing tests for blocked-worktree output | 6f5f0de | src/commands/remove.test.ts |
| 1 (GREEN) | Implement blocked-worktree listing before picker | b2c00ab | src/commands/remove.ts |

## What Was Built

Modified the interactive picker path (`if (!name)`) in `src/commands/remove.ts`:

1. Added `import chalk from 'chalk'` at the top.
2. Replaced the filter-only categorisation with a `Promise.all` that returns a tagged union per worktree (`{ kind: 'safe' | 'blocked', wt, reasons }`), then reduces into `safeWorktrees[]` and `blockedWorktrees[]`.
3. Before the picker, if any blocked worktrees exist, prints:
   - `"Cannot remove:"` header
   - Each blocked worktree as `  <yellow name>  <dim — reason(s)>`
   - Blank separator line
4. The picker flow, cancel handling, merge-check, and named-worktree path are all unchanged.

Added `logSpy` (`vi.spyOn(console, 'log')`) to the test file and five new test cases covering: BLOCKED DIRTY, BLOCKED NO REMOTE, BLOCKED BOTH, NO BLOCKED, ALL BLOCKED NO SAFE.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/commands/remove.ts` — modified, exists
- `src/commands/remove.test.ts` — modified, exists
- Commit `6f5f0de` — exists (RED tests)
- Commit `b2c00ab` — exists (GREEN implementation)
- All 19 tests pass: `npx vitest run src/commands/remove.test.ts` → 19 passed
