---
phase: quick-260428-lau
plan: 01
status: complete
date: 2026-04-28
---

# Quick Task 260428-lau — Summary

## Description

Upravit `pick` a `create`: pokud lokální branch pro worktree neexistuje, zkontrolovat zda existuje na remote (`origin/<branch>`); pokud ano, zeptat se uživatele, jestli ji fetchnout a worktree na ni nasadit (track `origin/<branch>`). Při odmítnutí nebo absenci remote branch zachovat dosavadní chování.

## What changed

### `src/lib/git.ts`
- Added `gitRemoteBranchExists(branch)` using `git ls-remote --heads origin <branch>` — detects branches on origin even before they have been fetched (the existing `gitBranchExistsOnRemote` only checks the local remote-tracking cache).
- Extended `gitWorktreeAdd(path, branch, opts?)` with optional `{ fromRemote: true }`. When set, runs `git fetch origin <branch>` followed by `git worktree add --track -b <branch> <path> origin/<branch>`, wiring upstream automatically.

### `src/lib/branch-remote.ts` (new)
- `maybeAdoptRemoteBranch(branch)` — prompt-bearing helper:
  - If local branch already exists → returns `{ adopt: false }` (no prompt).
  - Else checks `gitRemoteBranchExists`; if remote exists, asks via `p.confirm`: `Branch '<branch>' exists on origin. Fetch it and track origin/<branch>?`
  - Confirm → `{ adopt: true }` (caller should pass `{ fromRemote: true }` to `gitWorktreeAdd`).
  - Decline / no remote → `{ adopt: false }` (existing `-b` from HEAD path runs unchanged).
  - Cancel (Esc) → owns `p.cancel('Cancelled.') + process.exit(0)` matching `pick.ts` idiom.

### `src/commands/create.ts`
- Both JIRA and manual-slug paths now call `maybeAdoptRemoteBranch(branch)` before `gitWorktreeAdd`. When `adopt: true`, `gitWorktreeAdd` is invoked with `{ fromRemote: true }`. Helper called BEFORE spinner.start to avoid prompt-during-spinner terminal corruption.

### `src/commands/pick.ts`
- Step 5 (worktree creation) wired to call `maybeAdoptRemoteBranch` before `gitWorktreeAdd`, with the same `fromRemote` plumb-through.

## Tests

- `src/lib/git.test.ts` — added cases for `gitRemoteBranchExists` (positive/negative/error) and the new `gitWorktreeAdd` `fromRemote=true` branch (verifies `fetch origin <branch>` + `worktree add --track`).
- `src/lib/branch-remote.test.ts` (new) — covers all four paths: local exists, no remote, confirm, decline, cancel.
- `src/commands/{create,pick}.test.ts` — extended existing mocks to allow the optional third arg + added adopt=true/false coverage.

`npm run test`: **231 passed | 2 skipped**
`npm run build`: **success**

## Commits

| Hash | Message |
|------|---------|
| `4db25ac` | feat(quick-260428-lau-01): add gitRemoteBranchExists + fromRemote option in gitWorktreeAdd |
| `d8985e2` | feat(quick-260428-lau-01): add maybeAdoptRemoteBranch helper for remote-branch adoption prompt |
| `8198dc9` | feat(quick-260428-lau-01): wire maybeAdoptRemoteBranch into create + pick before gitWorktreeAdd |

## Notes

- `src/lib/git.ts` stayed free of `@clack/prompts` — UI logic lives in `branch-remote.ts` and the commands.
- Existing `gitBranchExistsOnRemote` (used by `remove` for "is it published" check) was left alone; new `gitRemoteBranchExists` lives alongside it with different semantics.
- Manual-slug path in `create.ts` was included in the change (in addition to JIRA paths) — the call-site is identical and the user benefit (catching a teammate-pushed branch with the same name) applies equally.
