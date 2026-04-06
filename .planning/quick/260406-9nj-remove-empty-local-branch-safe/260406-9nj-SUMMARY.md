---
phase: quick-260406-9nj
plan: "01"
subsystem: remove-command
tags: [remove, git, interactive-picker, worktrees]
dependency_graph:
  requires: []
  provides: [gitCommitsAheadOf, empty-local-branch-safe-remove, blocked-with-commits-display]
  affects: [src/commands/remove.ts, src/lib/git.ts]
tech_stack:
  added: []
  patterns: [tdd, git-log-range-query]
key_files:
  created: []
  modified:
    - src/lib/git.ts
    - src/lib/git.test.ts
    - src/commands/remove.ts
    - src/commands/remove.test.ts
decisions:
  - gitCommitsAheadOf only called when !onRemote — avoids unnecessary git invocations for on-remote branches
  - Empty local branch check uses three-way AND: !onRemote && commits.length === 0 && !isDirty — all three must be true for safe classification
  - Commit lines printed with 6-space indent using chalk.dim for visual hierarchy under blocked entry
metrics:
  duration: "~2 minutes"
  completed: "2026-04-06T05:01:15Z"
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 260406-9nj: Remove Empty Local Branch Safe — Summary

**One-liner:** gitCommitsAheadOf(branch, base) added to git.ts; remove picker now classifies clean empty-local branches as safe and shows commit list under blocked non-remote branches.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add gitCommitsAheadOf to git.ts with 3 unit tests | 53b2b49 |
| 2 | Update remove.ts picker + 2 new tests + 3 updated tests | 45f501d |

## What Was Built

### gitCommitsAheadOf (src/lib/git.ts)

New export: `gitCommitsAheadOf(branch, base)` — runs `git log {base}..{branch} --oneline`, returns array of commit lines. Returns empty array on error or when no commits ahead.

### Empty local branch safe classification (src/commands/remove.ts)

Before this change, any branch not on the remote was blocked regardless of commit count. Now:
- Branch not on remote + 0 commits ahead of main + clean working tree = **safe** (added to picker)
- Branch not on remote + has commits = **blocked** (unchanged, still shows "branch not pushed to remote")

### Commit list display for blocked entries

When a blocked entry has the "branch not pushed to remote" reason and the branch has commits, each commit line is printed indented under the blocked entry:
```
Cannot remove:
  my-feature  — branch not pushed to remote
      abc123 Fix login bug
      def456 Add validation
```

## Test Coverage

- `src/lib/git.test.ts`: 3 new tests for gitCommitsAheadOf (two lines, empty, error)
- `src/commands/remove.test.ts`: 2 new tests (EMPTY LOCAL BRANCH SAFE, BLOCKED WITH COMMITS); 3 existing tests updated to configure `mockGitCommitsAheadOf`
- Full suite: 146 tests pass (14 test files)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- src/lib/git.ts: FOUND
- src/lib/git.test.ts: FOUND
- src/commands/remove.ts: FOUND
- src/commands/remove.test.ts: FOUND
- Commit 53b2b49: FOUND
- Commit 45f501d: FOUND
