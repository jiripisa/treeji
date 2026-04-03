# Deferred Items — Phase 02 Git Worktree Core

## Pre-existing TypeScript Errors (Out of Scope for 02-01)

These TS errors existed before Phase 2 and are in Phase 1 files. They do not block runtime tests (vitest runs fine). Deferred to a future fix plan or Phase 1 cleanup.

**Errors in src/commands/configure.ts and src/commands/configure.test.ts:**

- configure.test.ts(44,44): Expected 0 arguments, but got 1
- configure.test.ts(91,40): Type 'string' not assignable to 'undefined'
- configure.test.ts(91,80): Type 'string' not assignable to 'undefined'
- configure.test.ts(117,29): Type 'string | number' not assignable to 'number'
- configure.ts(45,13): 'v' is possibly 'undefined'
- configure.ts(56,29): 'v' is possibly 'undefined'
- configure.ts(65,29): 'v' is possibly 'undefined'

**Confirmed pre-existing:** Verified via `git stash` — errors present before any 02-01 changes.
