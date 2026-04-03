---
phase: 02-git-worktree-core
plan: 02
subsystem: cli
tags: [commander, clack, git-worktree, slug, typescript, tdd]

# Dependency graph
requires:
  - phase: 02-git-worktree-core/02-01
    provides: "getGitRoot, gitWorktreeAdd from src/lib/git.ts; toSlug, validateSlug from src/lib/slug.ts"
provides:
  - "registerCreateCommand — mafcli create <slug> <type> command"
  - "src/commands/create.ts — worktree creation with branch naming {type}/{slug}"
  - "src/commands/create.test.ts — 5 unit tests covering success, Czech input, empty slug, validation error, type passthrough"
affects: [03-jira-integration, index.ts registration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN cycle for Commander.js command implementation"
    - "vi.mock('../lib/git.js') + vi.mock('../lib/slug.js') module mock pattern"
    - "process.exit spy with Number() cast for TypeScript strict mode compatibility"
    - "path.resolve(gitRoot, '..', cleanSlug) for worktree path resolution from git root"

key-files:
  created:
    - src/commands/create.ts
    - src/commands/create.test.ts
  modified: []

key-decisions:
  - "Type argument is used as-is in branch name — no sanitization on type (user's responsibility, consistent with CLI-03 spec)"
  - "process.exit mock requires Number() cast to satisfy TypeScript strict mode (string | number union)"

patterns-established:
  - "Commander command actions: toSlug() always called on slug input before any git call"
  - "Worktree path always resolved via path.resolve(gitRoot, '..', cleanSlug) — never from process.cwd()"

requirements-completed: [CLI-03, CLI-04]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 2 Plan 02: Create Command Summary

**Commander.js `mafcli create <slug> <type>` with slug sanitization via toSlug(), path resolution from git root, and branch naming `{type}/{slug}`**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T11:08:04Z
- **Completed:** 2026-04-02T11:10:10Z
- **Tasks:** 2 (TDD: RED test commit + GREEN implementation commit)
- **Files modified:** 2

## Accomplishments
- Implemented `mafcli create <slug> <type>` command via `registerCreateCommand`
- Slug sanitization always applied through `toSlug()` — raw user input never used directly as branch/dir name
- Worktree path resolved from git root (not cwd) via `path.resolve(gitRoot, '..', cleanSlug)` — Pitfall 3 mitigated
- 5 unit tests: success path, Czech diacritic input, empty slug error, validation error, type passthrough

## Task Commits

Each task was committed atomically:

1. **Task 1: create.test.ts — write failing tests (RED)** - `9ffe85b` (test)
2. **Task 2: create.ts — implement create command (GREEN)** - `0e6ef37` (feat)

## Files Created/Modified
- `src/commands/create.ts` - registerCreateCommand implementing worktree creation
- `src/commands/create.test.ts` - 5 unit tests covering all acceptance criteria

## Decisions Made
- Type argument is used as-is in branch name — no sanitization required (user provides it explicitly, consistent with CLI-03 spec)
- Used `Number()` cast on `process.exit` mock code to satisfy TypeScript strict mode (process.exit accepts `string | number | null | undefined`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict mode error in test ExitError constructor**
- **Found during:** Task 2 (GREEN implementation, TypeScript check)
- **Issue:** `code ?? 1` in `mockImplementation((code) => throw new ExitError(code ?? 1))` — TypeScript infers `code` as `string | number | null | undefined`, but `ExitError` constructor expects `number`
- **Fix:** Added `Number()` cast: `throw new ExitError(Number(code ?? 1))`
- **Files modified:** `src/commands/create.test.ts`
- **Verification:** `npx tsc --noEmit` shows no errors in create files
- **Committed in:** `0e6ef37` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary TypeScript correctness fix. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `configure.ts`, `configure.test.ts`, and `switch.test.ts` — out of scope for this plan, not caused by these changes.

## Next Phase Readiness
- `registerCreateCommand` is ready to be imported and registered in `src/index.ts`
- D-09 compatibility maintained: `create <slug> <type>` interface is clean for Phase 3 JIRA ticket ID integration

---
*Phase: 02-git-worktree-core*
*Completed: 2026-04-02*

## Self-Check: PASSED

- FOUND: src/commands/create.ts
- FOUND: src/commands/create.test.ts
- FOUND: commit 9ffe85b (test RED)
- FOUND: commit 0e6ef37 (feat GREEN)
