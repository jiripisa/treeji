---
phase: quick
plan: 260403-ocn
subsystem: list-command
tags: [cli, jira, hyperlink, osc8, columns, tdd]
dependency_graph:
  requires: []
  provides: [merged-jira-column, osc8-hyperlinks]
  affects: [src/commands/list.ts, src/commands/list.test.ts]
tech_stack:
  added: []
  patterns: [OSC 8 terminal hyperlinks, visible-text padding]
key_files:
  created: []
  modified:
    - src/commands/list.ts
    - src/commands/list.test.ts
decisions:
  - "loadConfig() called once per render to get host for hyperlink URL construction"
  - "jiraWidth computed from visible text (no escape sequences) to ensure correct column padding"
  - "jiraColPadded uses manual string repeat for padding since padEnd() counts escape chars"
metrics:
  duration: "2 minutes"
  completed: "2026-04-03T15:35:34Z"
  tasks: 1
  files: 2
---

# Quick Task 260403-ocn: Merge JIRA Columns with OSC 8 Hyperlink Summary

**One-liner:** Merged `ticket` + `jira status` columns into single `jira` column with OSC 8 terminal hyperlinks pointing to `{host}/browse/{key}`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| RED | Add failing tests for merged jira column | 2467f61 | src/commands/list.test.ts |
| GREEN | Implement merged jira column with OSC 8 hyperlinks | 56e6551 | src/commands/list.ts |

## What Was Built

The `list` command now renders 5 columns instead of 6:

**Before:** `name | status | branch | age | ticket | jira status`

**After:** `name | status | branch | age | jira`

The `jira` column:
- Renders the ticket key as an OSC 8 terminal hyperlink (`\x1b]8;;{url}\x1b\{key}\x1b]8;;\x1b\`)
- Appends ` (colored status)` when JIRA is reachable
- Shows only the hyperlinked key when JIRA is unreachable
- Is empty when the branch has no ticket key

Column alignment is correct: `jiraWidth` is computed from visible text lengths (without escape sequences), and `jiraColPadded` uses manual `' '.repeat()` since `padEnd()` counts escape sequence characters as visible width.

## Decisions Made

- `loadConfig()` is called once per `list` invocation (after data gathering, before rendering) to get the JIRA `host` for URL construction
- `jiraWidth` uses `key.length` or `${key} (${status})`.length — raw strings, no escape sequences — so column separator and padding stay aligned
- `jiraColPadded = jiraColRaw + ' '.repeat(jiraWidth + 2 - jiraVisible.length)` pattern is required because padEnd() would count OSC 8 escape characters

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- src/commands/list.ts: modified, exists
- src/commands/list.test.ts: modified, exists
- Commit 2467f61: exists (RED test commit)
- Commit 56e6551: exists (GREEN implementation commit)
- All 16 tests pass
