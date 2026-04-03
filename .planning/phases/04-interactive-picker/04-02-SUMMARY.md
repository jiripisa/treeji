---
phase: 04-interactive-picker
plan: 02
subsystem: cli
tags: [pick, jira, clack, typescript, vitest, tdd, worktree]

# Dependency graph
requires:
  - phase: 04-01
    provides: "fetchAssignedIssues() from jira.ts; colorStatus export from list.ts"
  - phase: 03-jira-integration
    provides: "gitWorktreeAdd from git.ts; toSlug from slug.ts"
provides:
  - "registerPickCommand() exported from src/commands/pick.ts — interactive JIRA ticket picker with worktree creation"
  - "pick command registered in src/index.ts — accessible via mafcli pick"
affects:
  - Phase 4 complete — v1 milestone achieved

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pick.ts uses selected issue data directly — no second fetchIssue() JIRA call (D-04)"
    - "Empty state uses p.outro (not p.cancel) — empty is not an error (Pitfall 3)"
    - "isCancel checked after BOTH p.select() and p.text() calls"
    - "TDD RED-GREEN cycle: failing tests written before pick.ts existed"

key-files:
  created:
    - src/commands/pick.ts
    - src/commands/pick.test.ts
  modified:
    - src/index.ts

key-decisions:
  - "No second fetchIssue() call in pick — selected issue object already has key, summary, statusName"
  - "p.outro for empty state, p.cancel for errors — semantically correct per @clack/prompts design"
  - "ticketSlug empty fallback: summarySlug ? key-summary : key — same pattern as create.ts"

requirements-completed: [WT-05]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 4 Plan 02: Interactive Picker Command Summary

**mafcli pick implemented with interactive JIRA ticket selection via @clack/prompts — spinner, p.select with status hints, p.text for branch type, gitWorktreeAdd creation; Phase 4 and v1 milestone complete**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-02T20:48:59Z
- **Completed:** 2026-04-02T20:50:41Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Implemented `src/commands/pick.ts` with `registerPickCommand()` following full interactive flow: spinner while loading, `p.select()` with ticket key + summary label and colored status hint, `p.text()` for branch type, `gitWorktreeAdd()` with same ticketSlug logic as create.ts
- 7 unit tests in `pick.test.ts` covering all WT-05 behaviors: SUCCESS, EMPTY STATE, CANCEL ON SELECT, CANCEL ON TYPE, JIRA ERROR, SPINNER SHOWN, EMPTY SUMMARY FALLBACK — written in TDD order (RED then GREEN)
- Wired `registerPickCommand` into `src/index.ts` — `mafcli pick` is now accessible as CLI command
- Full test suite grew from 95 to 102 tests, all passing; `npm run build` succeeds; `mafcli --help` shows `pick` in command list

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement pick.ts and pick.test.ts** - `ad27cb8` (feat)
2. **Task 2: Wire registerPickCommand into index.ts** - `6723314` (feat)

## Files Created/Modified

- `src/commands/pick.ts` — created: `registerPickCommand()` with full interactive flow
- `src/commands/pick.test.ts` — created: 7 unit tests covering all WT-05 behaviors
- `src/index.ts` — modified: import + `registerPickCommand(program)` call added (lines 10, 24)

## Decisions Made

- No second `fetchIssue()` call — the selected issue object from `p.select()` already contains `key`, `summary`, `statusName`; fetching again would be redundant and slower
- `p.outro('No assigned open tickets found.')` for empty state — `p.outro` is the correct UX choice (normal completion), not `p.cancel` (which signals an error/abort)
- `isCancel` checked after both `p.select()` and `p.text()` — Ctrl+C at either prompt exits cleanly with code 0

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all data flows are wired. `fetchAssignedIssues` calls the real JIRA API, `gitWorktreeAdd` calls real git, all prompt responses flow to real worktree creation.

## Self-Check: PASSED

- `src/commands/pick.ts` — FOUND
- `src/commands/pick.test.ts` — FOUND
- `src/index.ts` modified with registerPickCommand — FOUND
- Commit `ad27cb8` (Task 1) — FOUND
- Commit `6723314` (Task 2) — FOUND

---
*Phase: 04-interactive-picker*
*Completed: 2026-04-02*
