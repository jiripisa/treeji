---
phase: quick
plan: 260403-c5y
subsystem: switch-command
tags: [interactive, clack-prompts, worktree, sentinel-protocol]
dependency_graph:
  requires: [src/lib/git.ts (parseWorktreeList, gitWorktreeList)]
  provides: [interactive worktree picker in switch command]
  affects: [src/commands/switch.ts, src/commands/switch.test.ts]
tech_stack:
  added: []
  patterns: [@clack/prompts select() with output:process.stderr for clean stdout sentinel]
key_files:
  modified:
    - src/commands/switch.ts
    - src/commands/switch.test.ts
decisions:
  - "@clack/prompts select() called with output:process.stderr to keep stdout containing only the __MAFCLI_CD__ sentinel"
  - "Commander argument changed from <name> (required) to [name] (optional) to enable interactive fallback"
metrics:
  duration: 93s
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_changed: 2
---

# Quick Task 260403-c5y: Switch Command Interactive Worktree Picker — Summary

**One-liner:** Extended `mafcli switch` with an interactive `@clack/prompts select()` fallback when called without arguments, routing all UI output to stderr while preserving the stdout-only `__MAFCLI_CD__:path` sentinel protocol.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | Extend switch command + add interactive tests (TDD) | cc04ae3 | src/commands/switch.ts, src/commands/switch.test.ts |

## What Was Built

### src/commands/switch.ts
- Commander argument changed from `switch <name>` to `switch [name]` (optional)
- When `name` is provided: existing lookup behavior unchanged (no regression)
- When `name` is undefined and no worktrees: writes `mafcli: no worktrees found` to stderr, exits 1
- When `name` is undefined and worktrees exist: calls `select({ message, options, output: process.stderr })`
- On cancel (`isCancel(result)`): writes `mafcli: cancelled` to stderr, exits 1, no stdout writes
- On selection: emits `__MAFCLI_CD__:${result}\n` to stdout (sole stdout output — invariant preserved)

### src/commands/switch.test.ts
- Added second `describe` block: `'switch command — interactive mode (no name arg)'`
- Mocked `@clack/prompts` at module level alongside existing git mock
- 5 new tests: sentinel emission, output:stderr guard, cancel path, no-worktrees path, single-line stdout invariant
- Total: 10 tests passing (5 original + 5 new)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed implicit `any` TypeScript error in test**
- **Found during:** Verification (tsc --noEmit)
- **Issue:** `stderrSpy.mock.calls.map((c) => ...)` — parameter `c` implicitly has `any` type under strict TS
- **Fix:** Added explicit type annotation `(c: unknown[])` to the map callback
- **Files modified:** src/commands/switch.test.ts
- **Commit:** cc04ae3 (included in same commit, fix was minor)

## Known Stubs

None — all functionality fully wired and tested.

## Self-Check

Files exist:
- src/commands/switch.ts — modified
- src/commands/switch.test.ts — modified

Commit exists: cc04ae3

## Self-Check: PASSED
