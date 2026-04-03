---
phase: 03-jira-integration
plan: 01
subsystem: api
tags: [jira, jira.js, Version3Client, retry, backoff, typescript, vitest]

# Dependency graph
requires:
  - phase: 01-scaffold-config
    provides: loadConfig() and getToken() credential chain
provides:
  - "src/lib/jira.ts — shared JIRA client wrapper (fetchIssue, fetchIssueStatuses, withRetry)"
  - "src/lib/jira.test.ts — 14 unit tests covering JIRA-02, JIRA-04, JIRA-05"
affects:
  - 03-02-create-jira (will import fetchIssue from jira.ts)
  - 03-03-list-jira (will import fetchIssueStatuses from jira.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createJiraClient() factory: loads config+token on demand, throws descriptive errors before constructing Version3Client"
    - "withRetry() internal helper: 3 attempts, 400/800/1600ms backoff, 429 detection via message string"
    - "fetchIssueStatuses() empty-guard: returns new Map() immediately when array is empty, skipping Version3Client construction"

key-files:
  created:
    - src/lib/jira.ts
    - src/lib/jira.test.ts
  modified: []

key-decisions:
  - "searchForIssuesUsingJqlEnhancedSearchPost (POST) used over deprecated GET variant — forward-compatible with Atlassian endpoint removal"
  - "withRetry detects 429 via error message string ('429' or 'too many requests') — jira.js does not expose structured error with statusCode"
  - "Version3Client mock cleared per-describe-block via vi.mocked().mockClear() in beforeEach — prevents constructor call count leaking across test suites"

patterns-established:
  - "Pattern: Import Version3Client in test file for vi.mocked() mock clearing — required when testing empty-guard that must assert constructor not called"
  - "Pattern: fields cast as (issue.fields?.status as { name?: string } | undefined)?.name ?? '' — jira.js fields are loosely typed"

requirements-completed: [JIRA-02, JIRA-03, JIRA-04, JIRA-05]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 03 Plan 01: JIRA Client Wrapper Summary

**JIRA client wrapper with Version3Client factory, fetchIssue/fetchIssueStatuses exports, and 429 retry/backoff — centralised for all Phase 3 command consumers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T16:00:48Z
- **Completed:** 2026-04-02T16:03:48Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Created `src/lib/jira.ts` with `fetchIssue()`, `fetchIssueStatuses()`, internal `createJiraClient()` factory and `withRetry()` helper
- 14 unit tests covering JIRA-02, JIRA-04, JIRA-05 — all passing GREEN
- Full test suite (78/78) passes with no regressions
- Used `searchForIssuesUsingJqlEnhancedSearchPost` (POST) exclusively — deprecated GET variant absent

## Task Commits

Each task was committed atomically:

1. **Task 1: Write jira.test.ts (RED phase)** - `ce35486` (test)
2. **Task 2: Implement src/lib/jira.ts (GREEN phase)** - `bc36114` (feat)

_Note: TDD plan — test commit (RED) followed by implementation commit (GREEN). Test file was also updated in Task 2 commit to fix Version3Client mock clearing._

## Files Created/Modified

- `src/lib/jira.ts` — JIRA client wrapper: createJiraClient() factory, withRetry() helper, fetchIssue() and fetchIssueStatuses() exports
- `src/lib/jira.test.ts` — 14 unit tests covering all requirement IDs (JIRA-02, JIRA-04, JIRA-05)

## Decisions Made

- `searchForIssuesUsingJqlEnhancedSearchPost` (POST) used over deprecated `searchForIssuesUsingJql` (GET) — jira.js 5.3.1 marks the GET endpoint `@deprecated` with a note it is "being removed"
- `withRetry` detects HTTP 429 via error message string (`msg.includes('429') || msg.toLowerCase().includes('too many requests')`) — jira.js throws plain Error objects without a structured statusCode property
- `fetchIssueStatuses([])` guard returns empty Map without constructing Version3Client — prevents JQL parse error from JIRA on empty `issue in ()` query

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Version3Client constructor call count leaking across test suites**
- **Found during:** Task 2 (implement jira.ts GREEN phase)
- **Issue:** The `fetchIssueStatuses` test asserting `expect(Version3Client).not.toHaveBeenCalled()` failed because constructor calls from the `fetchIssue` test suite (6 previous tests) accumulated in the mock without being cleared. The original test file had no mechanism to clear the Version3Client constructor mock.
- **Fix:** Added `import { Version3Client } from 'jira.js'` at test file top, then added `vi.mocked(Version3Client).mockClear()` to both `beforeEach` blocks — both in `fetchIssue` and `fetchIssueStatuses` describe blocks.
- **Files modified:** `src/lib/jira.test.ts`
- **Verification:** 14/14 tests pass; empty-guard test correctly asserts constructor not called in isolation
- **Committed in:** `bc36114` (Task 2 feat commit, included test file update)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test mock setup)
**Impact on plan:** Auto-fix necessary for test correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed mock clearing issue above.

## Known Stubs

None — both exported functions are fully implemented and wired to real Version3Client API calls.

## Next Phase Readiness

- `src/lib/jira.ts` is ready for consumption by `create.ts` (Plan 02) and `list.ts` (Plan 03)
- `fetchIssue(ticketKey)` returns `{ key, summary, statusName }` — all fields needed for branch slug construction
- `fetchIssueStatuses(keys)` returns `Map<string, string>` — ready for status column in list view
- No blockers for Phase 3 continuation

---
*Phase: 03-jira-integration*
*Completed: 2026-04-02*
