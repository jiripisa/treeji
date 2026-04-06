---
phase: quick-260406-b1q
plan: 01
subsystem: git-worktree / remove-command
tags: [bug-fix, git, worktree, remove, cwd]
dependency_graph:
  requires: []
  provides: [gitRoot-threading-in-remove]
  affects: [src/lib/git.ts, src/commands/remove.ts]
tech_stack:
  added: []
  patterns: [conditional -C flag prepend for git subcommands]
key_files:
  created: []
  modified:
    - src/lib/git.ts
    - src/commands/remove.ts
    - src/lib/git.test.ts
    - src/commands/remove.test.ts
decisions:
  - "Optional gitRoot param added as last param to preserve backward compat — callers without gitRoot continue to work unchanged"
  - "getGitRoot() called before gitWorktreeList() in both flows — ensures root captured while CWD is still valid"
metrics:
  duration: "~2 min"
  completed: "2026-04-06"
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 260406-b1q: remove gitRoot CWD fix

**One-liner:** Added optional `gitRoot` param to `gitWorktreeRemove`, `gitWorktreePrune`, `gitDeleteBranch` and threaded it from `getGitRoot()` call in `remove.ts` so git commands use `-C` flag after worktree directory is deleted.

## What Was Built

When `treeji remove` is run from inside the worktree being removed, `git worktree remove` deletes the directory — leaving the shell CWD pointing to a non-existent path. Any subsequent git command relying on CWD to find the repo fails with "not a git repository".

The fix:
1. Three functions in `git.ts` gained optional `gitRoot?: string` as last param. When provided, `-C gitRoot` is prepended to the git args.
2. `remove.ts` calls `getGitRoot()` before any git operation in both the interactive and direct-name flows, then passes the captured root to all three calls.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (TDD RED) | Failing tests for gitRoot param | 8e34b5e | src/lib/git.test.ts |
| 1 (TDD GREEN) | Implement gitRoot param in three functions | 815cbfe | src/lib/git.ts |
| 2 | Thread gitRoot through remove + update assertions | 6530436 | src/commands/remove.ts, src/commands/remove.test.ts |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- src/lib/git.ts modified: confirmed
- src/commands/remove.ts modified: confirmed
- All commits present: 8e34b5e, 815cbfe, 6530436
- 154 tests pass, build exits 0
