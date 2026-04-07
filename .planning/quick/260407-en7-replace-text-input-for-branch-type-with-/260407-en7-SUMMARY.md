---
phase: quick
plan: 260407-en7
subsystem: commands/pick, commands/create, lib/branch-type
tags: [ux, branch-type, interactive-select, clack-prompts]
dependency_graph:
  requires: []
  provides: [promptBranchType, BRANCH_TYPE_OPTIONS]
  affects: [src/commands/pick.ts, src/commands/create.ts]
tech_stack:
  added: []
  patterns: [shared-helper-module, tdd-red-green]
key_files:
  created:
    - src/lib/branch-type.ts
    - src/lib/branch-type.test.ts
  modified:
    - src/commands/pick.ts
    - src/commands/pick.test.ts
    - src/commands/create.ts
    - src/commands/create.test.ts
decisions:
  - "promptBranchType returns empty string for none — branch construction uses type ? type/slug : slug pattern in both commands"
  - "Custom type option prompts p.text() inside promptBranchType — cancellation handled within helper, not callers"
  - "create type arg changed from required <type> to optional [type] — backward compatible (existing callers pass type, new interactive flow when omitted)"
metrics:
  duration: 8min
  completed: 2026-04-07
  tasks: 2
  files: 6
---

# Phase quick Plan 260407-en7: Replace text input for branch type with select menu Summary

Replace the freeform `p.text()` branch type prompt in `pick` and `create` commands with a 9-option `@clack/prompts` `select()` menu via a shared `promptBranchType()` helper.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create shared promptBranchType helper and update pick.ts | 75f3320 | src/lib/branch-type.ts, src/lib/branch-type.test.ts, src/commands/pick.ts, src/commands/pick.test.ts |
| 2 | Update create command — make type optional, prompt when missing | d42a040 | src/commands/create.ts, src/commands/create.test.ts, src/lib/branch-type.test.ts |

## What Was Built

**`src/lib/branch-type.ts`** — Shared helper module with:
- `BRANCH_TYPE_OPTIONS` — 9 entries: feature, fix, refactor, docs, style, test, chore, custom, none (each with a descriptive hint)
- `promptBranchType()` — async function that shows `p.select()`, handles cancel (`process.exit(0)`), returns empty string for "none", calls `p.text()` for "custom", returns the selected value string for all other types

**`src/commands/pick.ts`** — Replaced inline `p.text()` block with `const type = await promptBranchType()`. Branch name now uses `type ? \`${type}/${ticketSlug}\` : ticketSlug` to support the "none" case.

**`src/commands/create.ts`** — Changed command signature from `create <slug> <type>` (required) to `create <slug> [type]` (optional). When `typeArg` is undefined, calls `await promptBranchType()`. Both JIRA and manual paths use the same `type ? ...` branch construction pattern.

## Tests

- `src/lib/branch-type.test.ts`: 9 tests — BRANCH_TYPE_OPTIONS structure, standard type return, none returns empty string, custom triggers p.text(), cancel on select exits, cancel on custom text exits
- `src/commands/pick.test.ts`: Updated — replaced `mockText` references with `mockPromptBranchType`; added NONE TYPE test (empty string produces branch without prefix); removed CANCEL ON TYPE test (now covered by branch-type tests)
- `src/commands/create.test.ts`: Updated — added `mockPromptBranchType` mock; 4 new OPTIONAL TYPE ARG tests covering prompt invocation, fix branch, none manual path, none JIRA path

**Total: 100 tests pass across 7 test files.**

## Decisions Made

1. `promptBranchType` returns `""` for "none" — callers use `type ? \`${type}/slug\` : slug` pattern (consistent in both commands)
2. Cancel handling (select and custom text) lives inside `promptBranchType` — callers don't need to check `isCancel` for this step
3. `create` type arg made optional (`[type]` not `<type>`) — backward compatible since Commander.js optional args still accept positional values

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/lib/branch-type.ts` — FOUND
- `src/lib/branch-type.test.ts` — FOUND
- Commit 75f3320 — FOUND (feat(quick-260407-en7): shared promptBranchType helper and pick command update)
- Commit d42a040 — FOUND (feat(quick-260407-en7): make create type arg optional with interactive select fallback)
- 100 tests pass — VERIFIED
