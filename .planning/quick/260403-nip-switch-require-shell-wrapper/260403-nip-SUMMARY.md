---
phase: quick
plan: 260403-nip
subsystem: switch-command
tags: [guard, shell-wrapper, tty-hint-removal, tdd]
dependency_graph:
  requires: []
  provides: [wrapper-detection-guard-in-switch]
  affects: [src/commands/switch.ts]
tech_stack:
  added: []
  patterns: [readFileSync-spy-with-saved-original, wrapper-detection-via-rc-file-grep]
key_files:
  created: []
  modified:
    - src/commands/switch.ts
    - src/commands/switch.test.ts
decisions:
  - Saved originalReadFileSync before vi.spyOn to avoid infinite recursion in pass-through mock
  - Used mockImplementation with named functions (mockReadFileSyncWrapperPresent / WrapperAbsent) shared across both describe blocks for DRY test setup
metrics:
  duration: ~4min
  completed: 2026-04-03T15:00:02Z
  tasks_completed: 1
  files_modified: 2
---

# Phase quick Plan 260403-nip: Switch Wrapper Detection Guard Summary

**One-liner:** Shell wrapper detection guard added to `treeji switch` — exits 1 with actionable error when neither `~/.zshrc` nor `~/.bashrc` contains a `treeji()` definition; TTY hint entirely removed.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add wrapper detection guard and remove TTY hint | f5d173a | src/commands/switch.ts, src/commands/switch.test.ts |

## What Was Built

**switch.ts:**
- Added `import os from 'node:os'`
- Added wrapper detection gate at top of `.action()` handler: reads `~/.zshrc` and `~/.bashrc` via `fs.readFileSync`, checks for `treeji()` substring; if neither contains it, writes error to stderr and `process.exit(1)`
- Deleted the `if (process.stdout.isTTY)` block and the "Tip: run 'treeji setup'" stderr write entirely

**switch.test.ts:**
- Added `vi.mock('node:os', ...)` returning `homedir: () => '/home/testuser'`
- Saved `originalReadFileSync` before any mocking to avoid infinite recursion in pass-through
- Added two named mock helper functions used in `beforeEach` of both describe blocks
- Added `WRAPPER ABSENT` test to `direct name arg` describe block: verifies exit 1 + stderr message + no temp file
- Added `WRAPPER ABSENT` test to `interactive mode` describe block: verifies exit 1 + stderr message + `select()` not called
- Removed `TTY HINT` and `NO TTY HINT` tests (two tests deleted)
- Added `NO TTY HINT` replacement test verifying no hint ever appears on successful switch
- Changed `afterEach` to use `vi.restoreAllMocks()` for clean spy teardown
- Existing happy-path tests updated to read temp file via `originalReadFileSync` (not the spy)

## Verification

```
npx vitest run src/commands/switch.test.ts  → 11 passed (11)
npx vitest run                              → 117 passed (117)
```

`switch.ts` contains `treeji()` literal (for wrapper detection): YES
`switch.ts` contains `isTTY`: NO

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed infinite recursion in readFileSync pass-through mock**
- **Found during:** Task 1 (RED phase)
- **Issue:** The plan's suggested pattern `(fs.readFileSync as ...).call(null, ...)` caused a stack overflow because `fs.readFileSync` was already mocked by `vi.spyOn` — calling it recursed into itself
- **Fix:** Saved `const originalReadFileSync = fs.readFileSync.bind(fs)` at module top before any `vi.spyOn` calls; all pass-through calls use `originalReadFileSync` instead
- **Files modified:** src/commands/switch.test.ts

## Known Stubs

None.

## Self-Check: PASSED

- [x] src/commands/switch.ts exists and contains wrapper guard
- [x] src/commands/switch.test.ts exists with 11 tests
- [x] Commit f5d173a exists in git log
- [x] switch.ts has no `isTTY` reference
- [x] switch.ts has `treeji()` detection string
