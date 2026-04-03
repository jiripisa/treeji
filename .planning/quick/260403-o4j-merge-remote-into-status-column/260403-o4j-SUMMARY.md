---
phase: quick
plan: 260403-o4j
subsystem: list-command
tags: [cli, display, ux, refactor]
dependency_graph:
  requires: []
  provides: [merged-status-column]
  affects: [src/commands/list.ts]
tech_stack:
  added: []
  patterns: [chalk-padEnd-alignment, dynamic-column-width]
key_files:
  modified:
    - src/commands/list.ts
    - src/commands/list.test.ts
decisions:
  - statusWidth computed from plain strings (no chalk) so padEnd on chalk-wrapped string preserves correct visual alignment
metrics:
  duration: "3 min"
  completed: "2026-04-03"
  tasks: 1
  files: 2
---

# Quick Task 260403-o4j: Merge Remote Column into Status Column

**One-liner:** Merged dirty flag (✓/✗) and ahead/behind counts (↑N ↓M) into single status column, removing standalone remote column — 6-column layout.

## What Was Done

Reduced the 7-column list output to 6 columns by combining the `status` (dirty/clean flag) and `remote` (↑N ↓M) columns into a single `status` column showing `✓ ↑0 ↓0` or `✗ ↑3 ↓1`.

### Changes

**src/commands/list.ts:**
- Removed `remote` column from header (`console.log`) and data row template
- Added `statusWidth` computed dynamically from the max length of rendered status strings across all rows and the `'status'` header label
- Built `statusCol` combining chalk-colored flag and remote string: `` `${flag} ${remote}`.padEnd(statusWidth + 2) ``
- Updated separator line to use `statusWidth + 2` instead of the two separate `8 + 10` terms

**src/commands/list.test.ts:**
- Added `describe('STATUS COLUMN MERGED')` block with two new test cases:
  - `HEADER NO REMOTE`: asserts header does not contain string `'remote'` but does contain `'status'`
  - `COMBINED STATUS`: asserts clean row output contains both `✓` and `↑2 ↓1`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check

- [x] `src/commands/list.ts` — modified, confirmed
- [x] `src/commands/list.test.ts` — modified, confirmed
- [x] Commit `d087f93` exists: `feat(list): merge remote column into status column — 6-column layout`
- [x] All 13 tests pass

## Self-Check: PASSED
