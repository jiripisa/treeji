---
phase: 05-simplify-jira-connection-oauth-or-browser-based-auth-without-manual-api-token
plan: "01"
subsystem: auth-ux
tags: [configure, browser-open, 401-detection, jira-client, ux]
dependency_graph:
  requires: []
  provides: [browser-guided-token-setup, 401-error-guidance]
  affects: [src/commands/configure.ts, src/lib/jira.ts]
tech_stack:
  added: [open@11]
  patterns: [try-catch-open, 401-detection-before-429-retry]
key_files:
  created: []
  modified:
    - src/commands/configure.ts
    - src/commands/configure.test.ts
    - src/lib/jira.ts
    - src/lib/jira.test.ts
    - package.json
decisions:
  - "open package added as production dependency (ESM-native v11)"
  - "Browser-open attempt wrapped in try/catch — failure falls back to printed URL, no crash"
  - "401 detection added BEFORE 429 check in withRetry — ensures immediate throw without retries"
  - "is401 check uses both '401' string and case-insensitive 'unauthorized' to cover jira.js error variants"
metrics:
  duration: "~3 min"
  completed_date: "2026-04-07"
  tasks_completed: 2
  files_changed: 5
---

# Phase 05 Plan 01: Browser-Guided Token Setup and 401 Detection Summary

**One-liner:** Auto-open Atlassian API token page in browser during interactive configure, with 401 error guidance directing user to re-run `treeji configure`.

## What Was Built

### Task 1: Browser-guided token flow in configure command

Added `open` (v11, ESM-native) as a production dependency. During the interactive `treeji configure` flow, after the email prompt and before the token password prompt:

1. Attempts `await open(ATLASSIAN_TOKEN_URL)` where URL is `https://id.atlassian.com/manage-profile/security/api-tokens`
2. On success: shows `p.note()` with title "Browser opened" directing user to create and paste token
3. On failure (SSH/headless — `open()` rejects): shows `p.note()` with title "Open in your browser" and the full URL for manual copy

Non-interactive mode (`--url --email --token`) is completely unchanged — no browser open occurs.

### Task 2: 401 detection in JIRA client

Modified `withRetry` in `src/lib/jira.ts` to detect 401 authentication errors before the existing 429 retry logic:

- Detects `msg.includes('401')` OR `msg.toLowerCase().includes('unauthorized')`
- Throws immediately (no retries) with: `JIRA authentication failed (401 Unauthorized). Run \`treeji configure\` again to update your API token.`
- 429 retry behavior unchanged

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `open` v11 as production dep | ESM-native, matches project's ESM-first stack; v11 is current stable |
| try/catch around `open()` | SSH/headless environments where xdg-open/open fails should degrade gracefully, not crash |
| 401 check before 429 check | 401 should never retry (wrong credentials won't fix themselves); ordering matters |
| Both '401' and 'unauthorized' detection | jira.js surfaces different error message formats depending on HTTP client behavior |

## Test Coverage

- `src/commands/configure.test.ts`: 10 tests pass (added 3 new: browser-open success, browser-open fallback, non-interactive no-open)
- `src/lib/jira.test.ts`: 26 tests pass (added 4 new: 401 message, Unauthorized message, no retry on 401, 429 still retries)
- Full suite: 212 passed, 2 skipped (pre-existing switch.test.ts skips), 0 failures

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is fully wired.

## Self-Check: PASSED
