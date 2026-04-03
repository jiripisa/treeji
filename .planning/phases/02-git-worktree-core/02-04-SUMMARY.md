---
phase: 02-git-worktree-core
plan: 04
subsystem: cli
tags: [commander, worktree, sentinel-output, shell-wrapper, git]

# Dependency graph
requires:
  - phase: 02-01
    provides: git.ts library with gitWorktreeList, parseWorktreeList, gitStatusPorcelain, gitWorktreeRemove, gitDeleteBranch, gitWorktreePrune

provides:
  - switch command: sentinel output protocol (__MAFCLI_CD__:/path) for shell cd
  - remove command: dirty-check + force override + correct delete sequence (worktree → branch → prune)
  - setup command: prints mafcd shell wrapper function to stdout

affects: [02-05, 03-jira-integration, any plan that wires commands to index.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sentinel output: stdout reserved for machine-readable __MAFCLI_CD__:/path, all human output to stderr"
    - "Dirty-check before delete: gitStatusPorcelain returns empty string for clean, non-empty for dirty"
    - "Force flag: gitWorktreeRemove(path, force) + gitDeleteBranch(branch, force) both accept boolean force param"
    - "Delete order: gitWorktreeRemove always before gitDeleteBranch, then gitWorktreePrune last"

key-files:
  created:
    - src/commands/switch.ts
    - src/commands/switch.test.ts
    - src/commands/remove.ts
    - src/commands/remove.test.ts
    - src/commands/setup.ts
    - src/commands/setup.test.ts
  modified: []

key-decisions:
  - "switch command: only stdout output is the __MAFCLI_CD__:path sentinel — zero console.log or @clack/prompts calls allowed in switch.ts"
  - "remove command: gitWorktreeRemove called BEFORE gitDeleteBranch, then gitWorktreePrune last — this order matters for clean git state"
  - "setup command: synchronous, no async — just process.stdout.write(SHELL_WRAPPER)"

patterns-established:
  - "Pattern: stdout contamination guard — switch command tests assert process.stdout.write called EXACTLY ONCE"
  - "Pattern: ExitError mock throws to prevent test continuation after process.exit(1)"

requirements-completed: [WT-03, WT-04, CLI-01]

# Metrics
duration: 4min
completed: 2026-04-02
---

# Phase 02 Plan 04: Switch, Remove, Setup Commands Summary

**switch sentinel output (stdout only), remove dirty-check with force bypass, mafcd shell wrapper via setup — completing the worktree lifecycle commands**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-02T11:08:18Z
- **Completed:** 2026-04-02T11:11:40Z
- **Tasks:** 2 (TDD: 4 commits total — 2 RED + 2 GREEN)
- **Files modified:** 6

## Accomplishments
- switch.ts: exactly one stdout line with `__MAFCLI_CD__:/path` sentinel — zero other stdout, all errors to stderr
- remove.ts: dirty worktree blocked without `--force`; `--force` uses `-D` branch delete; correct delete order (worktree → branch → prune)
- setup.ts: prints complete mafcd shell function to stdout with install instructions, `__MAFCLI_CD__` sentinel reference, and cd invocation

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: switch.test.ts failing tests** - `6a99897` (test)
2. **Task 1 GREEN: switch.ts implementation** - `1a93ff3` (feat)
3. **Task 2 RED: remove.test.ts + setup.test.ts failing tests** - `5cb9adf` (test)
4. **Task 2 GREEN: remove.ts + setup.ts + TS type fixes** - `e0752ae` (feat)

## Files Created/Modified
- `src/commands/switch.ts` - registerSwitchCommand: sentinel output protocol
- `src/commands/switch.test.ts` - 5 tests: branch suffix match, dir match, no-extra-stdout, not-found, sentinel format
- `src/commands/remove.ts` - registerRemoveCommand: dirty-check, --force, delete sequence
- `src/commands/remove.test.ts` - 5 tests: clean delete, dirty block, force dirty, not found, branch delete failure
- `src/commands/setup.ts` - registerSetupCommand: prints mafcd shell function to stdout
- `src/commands/setup.test.ts` - 4 tests: stdout contains mafcd, __MAFCLI_CD__, cd invocation, .zshrc reference

## Decisions Made
- switch command: ONLY `process.stdout.write` is allowed in switch.ts — no console.log, no @clack/prompts (would contaminate stdout and break mafcd shell function parsing)
- remove command: delete order is gitWorktreeRemove → gitDeleteBranch → gitWorktreePrune; branch is deleted with `-D` flag when `--force` is passed
- setup command: synchronous action, no async/await needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type errors in test files for process.exit mock**
- **Found during:** Task 2 (TypeScript check after GREEN phase)
- **Issue:** `process.exit` accepts `string | number | null | undefined`, but test mocks used `(code?: number)` or `(code) =>` which failed strict TS
- **Fix:** Updated mock signatures to `(code?: string | number | null) => never` with `typeof code === 'number'` check
- **Files modified:** src/commands/switch.test.ts, src/commands/remove.test.ts
- **Verification:** `npx tsc --noEmit` reports zero errors in new files; all 64 tests pass
- **Committed in:** e0752ae (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type bug in test mocks)
**Impact on plan:** Minor type correction in test mocks. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in configure.ts and configure.test.ts are out of scope — documented in deferred-items.md. These do not affect the new code or test execution.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- switch, remove, setup commands fully implemented and tested
- All three commands need to be registered in src/index.ts (Plan 02-05 or similar integration step)
- mafcd shell function is ready for users to install via `mafcli setup >> ~/.zshrc`

---
*Phase: 02-git-worktree-core*
*Completed: 2026-04-02*

## Self-Check: PASSED

All files exist and all commits are present in git history.
