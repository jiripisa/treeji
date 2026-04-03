---
phase: quick
plan: 260403-dvk
subsystem: cli-commands
tags: [ux, output, safety, testing]
dependency_graph:
  requires: []
  provides: [improved-cli-ux, dirty-worktree-confirm, symbol-status-output, tty-hints]
  affects: [switch, setup, create, list, remove, pick, index]
tech_stack:
  added: []
  patterns: [stderr-for-instructions, tty-detection, confirmation-prompt]
key_files:
  created: []
  modified:
    - src/commands/switch.ts
    - src/commands/setup.ts
    - src/commands/create.ts
    - src/commands/list.ts
    - src/commands/remove.ts
    - src/commands/pick.ts
    - src/index.ts
    - src/commands/switch.test.ts
    - src/commands/setup.test.ts
    - src/commands/create.test.ts
    - src/commands/list.test.ts
    - src/commands/remove.test.ts
    - src/commands/pick.test.ts
decisions:
  - switch temp file uses mode 0o600 for security; TTY hint only shown when stdout is TTY
  - setup instructions go to stderr so stdout stays clean for shell redirection (mafcli setup >> ~/.zshrc)
  - remove --force on dirty now requires explicit confirmation (--yes skips it for scripts)
  - list uses ✗/✓ symbols instead of dirty/clean text for cleaner table output
  - pick shows 50-ticket note only on exact 50 results to signal possible pagination
metrics:
  duration: ~8min
  completed_date: "2026-04-03"
  tasks_completed: 3
  files_modified: 13
---

# Quick Task 260403-dvk: UX Improvements Batch Summary

**One-liner:** Seven-file UX polish: TTY hints to stderr, 0o600 temp file, install instructions off stdout, create previews, ✗/✓ symbols, dirty-remove confirmation with --yes flag, 50-ticket pagination note.

## Tasks Completed

| # | Task | Commit |
|---|------|--------|
| 1 | Output and display improvements (switch, setup, create, list, pick, index) | 97fbc02 |
| 2 | remove.ts dirty confirmation prompt and --yes flag | d236ad3 |
| 3 | Update test assertions for all changed behaviors | 4ad12ba |

## Changes by File

### src/commands/switch.ts
- `fs.writeFileSync` now passes `{ mode: 0o600 }` — temp file is private
- After writing the switch file, prints TTY hint to stderr when `process.stdout.isTTY` is true: _"Tip: run 'mafcli setup' and add the shell function to ~/.zshrc for cd support"_

### src/commands/setup.ts
- Before printing the shell wrapper to stdout, writes install instructions to stderr: _"Add the following to ~/.zshrc (or ~/.bashrc), then run: source ~/.zshrc"_
- stdout remains clean — `mafcli setup >> ~/.zshrc` now works correctly without capturing the instruction text

### src/commands/create.ts
- Prints preview line to stderr before each spinner starts (both JIRA and manual paths): `Creating: {branch}  →  {worktreePath}`
- Command description updated: mentions both JIRA and manual modes

### src/commands/list.ts
- `dirtyLabel` changed from `chalk.red('dirty  ')` / `chalk.green('clean  ')` to `chalk.red('✗      ')` / `chalk.green('✓      ')`

### src/commands/remove.ts
- Added `--yes` option for script use
- When `--force` is used on a dirty worktree, prompts for confirmation via `p.confirm()`
- `--force --yes` skips the confirmation prompt entirely

### src/commands/pick.ts
- After `spinner.stop()`, if `issues.length === 50` writes: _"Showing first 50 tickets (most recently updated)"_ to stderr

### src/index.ts
- Program description updated with multi-line examples block

## Deviations from Plan

None — plan executed exactly as written. The Task 1 done criteria acknowledged that one list test asserting `/dirty/` would fail until Task 3 updated it (expected flow).

## Test Coverage Added

- `switch.test.ts`: TTY HINT, FILE MODE, NO TTY HINT (3 new tests)
- `setup.test.ts`: STDERR INSTRUCTIONS, STDOUT ONLY (2 new tests); fixed INSTALL INSTRUCTIONS to check stderr
- `create.test.ts`: JIRA PREVIEW, MANUAL PREVIEW (2 new tests)
- `list.test.ts`: Updated dirty/clean assertions to use ✗/✓ symbols
- `remove.test.ts`: FORCE DIRTY CONFIRM ABORT, FORCE DIRTY YES FLAG (2 new tests); updated FORCE DIRTY
- `pick.test.ts`: 50 TICKETS NOTE, NOT 50 TICKETS (2 new tests)

**Total:** 116 tests passing (was 104 before this task)

## Self-Check: PASSED

- src/commands/switch.ts: FOUND
- src/commands/setup.ts: FOUND
- src/commands/create.ts: FOUND
- src/commands/list.ts: FOUND
- src/commands/remove.ts: FOUND
- src/commands/pick.ts: FOUND
- src/index.ts: FOUND
- Commits 97fbc02, d236ad3, 4ad12ba: FOUND
- `npx vitest run`: 116 tests passed
- `npx tsc --noEmit`: exits 0
