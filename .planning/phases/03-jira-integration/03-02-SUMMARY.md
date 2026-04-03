---
phase: 03-jira-integration
plan: "02"
subsystem: cli
tags: [jira, worktree, create, commander, clack, slug]

# Dependency graph
requires:
  - phase: 03-01
    provides: fetchIssue() function in src/lib/jira.ts
  - phase: 02-04
    provides: create command with manual slug path in src/commands/create.ts
provides:
  - JIRA ticket ID auto-detection in create command (JIRA_KEY_RE regex)
  - Branch naming as {type}/PROJ-123-{summary-slug} from fetched JIRA summary
  - Empty slug fallback to ticket key alone when summary slugifies empty
  - Spinner UX during JIRA API fetch and worktree creation
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JIRA_KEY_RE = /^[A-Z]+-\\d+$/ for ticket ID auto-detection"
    - "Branching on slug format: JIRA key takes JIRA path, anything else takes manual path"
    - "summarySlug ? `${key}-${summarySlug}` : key — empty-slug fallback pattern"
    - "TDD: RED (failing tests) → GREEN (implementation) → no refactor needed"

key-files:
  created: []
  modified:
    - src/commands/create.ts
    - src/commands/create.test.ts

key-decisions:
  - "JIRA detection uses /^[A-Z]+-\\d+$/ regex (D-01) — uppercase letter project key followed by digits only"
  - "Ticket key is never passed through toSlug() — only summary goes through slug transform (ensures PROJ-123 stays intact)"
  - "Two spinners: one for JIRA fetch, one for worktree creation — matches existing UX pattern"

patterns-established:
  - "Dual-path action handler: test slug format first (JIRA vs manual), early return after JIRA path"
  - "JIRA error handling: catch block with p.cancel(message) + process.exit(1) — same pattern as manual path"

requirements-completed:
  - WT-01

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 03 Plan 02: JIRA Ticket ID Detection in Create Command Summary

**JIRA ticket ID auto-detection in `mafcli create` using /^[A-Z]+-\d+$/ regex — fetches summary via fetchIssue(), builds branch as `{type}/PROJ-123-{summary-slug}` with empty-slug fallback to ticket key**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-02T16:06:10Z
- **Completed:** 2026-04-02T16:08:00Z
- **Tasks:** 1 (TDD: 2 commits — test then implementation)
- **Files modified:** 2

## Accomplishments

- Implemented JIRA ticket ID auto-detection with `/^[A-Z]+-\d+$/` regex in `create` command
- JIRA path: fetchIssue() called with ticket key, summary slugified, branch built as `{type}/PROJ-123-{summary-slug}`
- Empty slug fallback: when `toSlug(issue.summary)` returns empty string, falls back to ticket key alone (e.g., `bugfix/PROJ-456`)
- Manual slug path from Phase 2 preserved unchanged — no fetchIssue call for non-JIRA input
- Spinner UX: one spinner around JIRA fetch, second spinner around worktree creation

## Task Commits

TDD task with two commits:

1. **RED — Failing tests** - `cd10690` (test)
2. **GREEN — Implementation** - `f7973d1` (feat)

## Files Created/Modified

- `src/commands/create.ts` — Added JIRA detection branch, fetchIssue import, JIRA_KEY_RE regex, empty-slug fallback
- `src/commands/create.test.ts` — Added mockFetchIssue mock and 5 JIRA PATH test cases

## Decisions Made

- Ticket key is NOT passed through `toSlug()` — only the fetched summary goes through slug normalization. This ensures `PROJ-123` stays intact in the branch name.
- Two separate spinners used (fetch + worktree) rather than a single spinner — clearer user feedback on two distinct async operations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Core value proposition implemented: `mafcli create PROJ-123 feature` now works end-to-end
- Phase 03 Plan 03 (JIRA status in list command) was already committed before this plan ran — no blocking dependencies

---
*Phase: 03-jira-integration*
*Completed: 2026-04-02*
