---
phase: quick
plan: 260407-eaz
subsystem: worktree-creation
tags: [symlink, ide-settings, worktree-hooks, create, pick]
dependency_graph:
  requires: []
  provides: [maybeSymlinkIdea hook in worktree-hooks.ts]
  affects: [src/commands/create.ts, src/commands/pick.ts]
tech_stack:
  added: [node:fs/promises (stat, symlink)]
  patterns: [post-worktree-creation hook, prompt-driven symlink]
key_files:
  created:
    - src/lib/worktree-hooks.ts
    - src/lib/worktree-hooks.test.ts
  modified:
    - src/commands/create.ts
    - src/commands/pick.ts
    - src/commands/create.test.ts
    - src/commands/pick.test.ts
decisions:
  - maybeSymlinkIdea uses named imports from node:fs/promises (not default) — required for vi.mock compatibility in vitest
  - confirm prompt placed after both worktree creation paths in create.ts (JIRA and manual slug)
metrics:
  duration: 3min
  completed: 2026-04-07
  tasks: 2
  files: 6
---

# Quick Task 260407-eaz: Symlink .idea Directory in New Worktrees Summary

**One-liner:** Post-worktree-creation hook that detects `.idea` in the main repo and prompts user to symlink it into new worktrees, sharing IntelliJ/WebStorm settings across all worktrees.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create maybeSymlinkIdea utility with tests (TDD) | 32208e5 | src/lib/worktree-hooks.ts, src/lib/worktree-hooks.test.ts |
| 2 | Integrate maybeSymlinkIdea into create and pick commands | 08a25ab | src/commands/create.ts, src/commands/pick.ts, src/commands/create.test.ts, src/commands/pick.test.ts |

## Verification

All 34 tests pass:
- `src/lib/worktree-hooks.test.ts`: 4 tests (all 4 behaviors)
- `src/commands/create.test.ts`: 17 tests (15 existing + 2 new integration)
- `src/commands/pick.test.ts`: 13 tests (12 existing + 1 new integration)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Named imports from node:fs/promises instead of default import**
- **Found during:** Task 1 (GREEN phase — 2 tests failing)
- **Issue:** `import fs from 'node:fs/promises'` uses default import; vitest `vi.mock('node:fs/promises', ...)` only intercepts named exports. `fs.stat` and `fs.symlink` were not being mocked.
- **Fix:** Changed to `import { stat, symlink } from 'node:fs/promises'` — named imports match the mock factory's named exports.
- **Files modified:** src/lib/worktree-hooks.ts
- **Commit:** 32208e5

## Known Stubs

None.

## Self-Check: PASSED
