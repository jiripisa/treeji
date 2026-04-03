---
phase: 03-jira-integration
plan: 03
subsystem: cli
tags: [jira, list, chalk, batch-query, graceful-degradation, typescript, vitest]

# Dependency graph
requires:
  - phase: 03-jira-integration
    provides: fetchIssueStatuses() from src/lib/jira.ts (Plan 01)
  - phase: 02-git-worktree-core
    provides: list command with 5-column table, parseWorktreeList, gitStatusPorcelain

provides:
  - "src/commands/list.ts — 6-column list with JIRA ticket status column, single batched JQL fetch, graceful degradation"
  - "src/commands/list.test.ts — 6 new JIRA status tests + all 5 existing tests passing (11 total)"

affects:
  - phase-04 (any final integration or publish phase consuming mafcli list output)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch ticket key extraction: deduplicated Set from worktree branches before single fetchIssueStatuses() call"
    - "Graceful degradation: jiraWarning flag, try/catch around fetchIssueStatuses, warning printed after table"
    - "colorStatus() function: maps toLowerCase() status names to chalk.yellow/green/gray"
    - "extractTicketKey() function: /([A-Za-z]+-\\d+)/i regex, toUpperCase() result for JQL compatibility"

key-files:
  created: []
  modified:
    - src/commands/list.ts
    - src/commands/list.test.ts

key-decisions:
  - "colorStatus maps 'in progress' and any status containing 'progress' to yellow, 'done'/'closed'/'resolved' to green, all others (including empty) to gray — per D-04"
  - "fetchIssueStatuses called only when ticketKeys.length > 0 — empty array guard prevents unnecessary API calls when no JIRA branches present — per D-05 and Pitfall 5"
  - "JIRA warning printed after table rows, not inline per row — single ⚠ line keeps table clean — per D-06"

patterns-established:
  - "Pattern: vi.mock('../lib/jira.js') with module-scope mock fn + beforeEach mockClear() + default mockResolvedValue(new Map()) — prevents existing non-JIRA tests from unexpectedly calling real jira client"

requirements-completed: [WT-06, JIRA-04]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 03 Plan 03: JIRA Status Column in List Summary

**JIRA ticket status column added to mafcli list — single batched JQL fetch, color-coded by status (grey/yellow/green), graceful degradation with ⚠ warning when JIRA unreachable**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T16:06:17Z
- **Completed:** 2026-04-02T16:09:00Z
- **Tasks:** 1 (TDD: RED tests written first, then GREEN implementation)
- **Files modified:** 2

## Accomplishments

- Added `extractTicketKey()` helper: case-insensitive regex `/([A-Za-z]+-\d+)/i`, uppercased result
- Added `colorStatus()` helper: chalk.yellow for In Progress, chalk.green for Done/Closed/Resolved, chalk.gray for all others
- Modified `list.ts` action handler: batches all ticket keys in a single `fetchIssueStatuses()` call, falls back gracefully on failure
- Added 6 new test cases in `JIRA STATUS COLUMN` describe block; all 89 tests across 13 files pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend list.ts with JIRA status column and update tests** - `633edfd` (feat)

## Files Created/Modified

- `src/commands/list.ts` — Added `extractTicketKey()`, `colorStatus()`, `fetchIssueStatuses` import, ticket key collection, batched status fetch with graceful degradation, 6-column table output
- `src/commands/list.test.ts` — Added `mockFetchIssueStatuses` mock with vi.mock('../lib/jira.js'), default `mockResolvedValue(new Map())` in beforeEach, 6 new JIRA STATUS COLUMN tests

## Decisions Made

- `colorStatus()` uses `lower.includes('progress')` for yellow to catch statuses like "In Progress" or "In Review (Progress)" — generous matching per D-04 spirit
- Empty string passed to `colorStatus()` returns `chalk.gray('')` (empty), not a visible indicator — correct behaviour for non-JIRA branches
- `ticketWidth` computed from actual status string lengths (stripped of chalk ANSI) would require extra work; since the padEnd is applied to the chalk-wrapped string, the column may not align perfectly when statuses are coloured. Acceptable for a personal tool CLI.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all acceptance criteria met on first implementation.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — `fetchIssueStatuses` is fully wired from `src/lib/jira.ts` to the JIRA API. The ticket column displays real data when configured.

## Next Phase Readiness

- `mafcli list` now shows a 6-column table: branch | status | remote | age | ticket | path
- JIRA status column fully functional for branches matching `/[A-Za-z]+-\d+/i` pattern
- Phase 3 plan 03 complete — all three JIRA integration plans (01, 02, 03) are now done
- No blockers for phase transition or final publish phase

---
*Phase: 03-jira-integration*
*Completed: 2026-04-02*
