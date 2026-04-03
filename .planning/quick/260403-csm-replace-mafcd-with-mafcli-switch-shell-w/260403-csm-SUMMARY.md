---
phase: quick
plan: 260403-csm
subsystem: shell-integration
tags: [shell-wrapper, setup, switch, mafcli]
dependency_graph:
  requires: []
  provides: [mafcli-shell-function]
  affects: [setup, switch]
tech_stack:
  added: []
  patterns: [shell-function-dispatch, command-passthrough]
key_files:
  created: []
  modified:
    - src/commands/setup.ts
    - src/commands/switch.ts
    - src/commands/setup.test.ts
decisions:
  - "mafcli() shell function uses '$1' for subcommand dispatch (check for 'switch') and 'command mafcli' passthrough for all other subcommands — replaces separate mafcd function"
metrics:
  duration: "3min"
  completed: "2026-04-03"
  tasks: 2
  files: 3
---

# Phase quick Plan 260403-csm: Replace mafcd with mafcli() shell function Summary

**One-liner:** Replaced separate `mafcd()` wrapper with unified `mafcli()` shell function that intercepts `switch` for cd and passes all other subcommands through via `command mafcli`.

## What Was Built

- `setup.ts`: `SHELL_WRAPPER` constant now defines `mafcli()` instead of `mafcd()`. The function checks if `$1 = "switch"`, runs `command mafcli switch "$@"`, parses the `__MAFCLI_CD__:` sentinel from stdout, and `cd`s to the path. All other subcommands fall through to `command mafcli "$@"`.
- `setup.ts`: `.description()` updated to reference "mafcli shell function".
- `switch.ts`: `.description()` updated to remove `mafcd` reference.
- `setup.test.ts`: STDOUT CONTENT test renamed and assertion changed to `toContain('mafcli()')`. ARGS PASSTHROUGH assertion updated — old wrapper forbade `"$1"` entirely, but new wrapper legitimately uses `$1` for subcommand dispatch, so assertion now verifies `command mafcli` passthrough instead.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace SHELL_WRAPPER in setup.ts and update switch.ts description | a2e3fa8 | src/commands/setup.ts, src/commands/switch.ts |
| 2 | Update setup.test.ts assertions for the new mafcli() wrapper | 04254d2 | src/commands/setup.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ARGS PASSTHROUGH test assertion invalid for new wrapper**
- **Found during:** Task 2
- **Issue:** The test `expect(output).not.toContain('"$1"')` was written for `mafcd()` where `$1` would have been an incorrect passthrough mechanism. The new `mafcli()` wrapper intentionally uses `[ "$1" = "switch" ]` for subcommand dispatch, making the old negation assertion incorrect.
- **Fix:** Changed assertion to `expect(output).toContain('command mafcli')` — verifies the passthrough to the real binary instead of forbidding `$1`.
- **Files modified:** src/commands/setup.test.ts
- **Commit:** 04254d2

## Verification

- All 15 tests pass (`setup.test.ts` + `switch.test.ts`)
- Zero `mafcd` references in `src/`

## Self-Check: PASSED

- src/commands/setup.ts: FOUND
- src/commands/switch.ts: FOUND
- src/commands/setup.test.ts: FOUND
- Commit a2e3fa8: FOUND
- Commit 04254d2: FOUND
