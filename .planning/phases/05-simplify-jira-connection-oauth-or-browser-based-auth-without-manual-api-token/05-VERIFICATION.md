---
phase: 05-simplify-jira-connection-oauth-or-browser-based-auth-without-manual-api-token
verified: 2026-04-07T12:50:00Z
status: passed
score: 5/5 must-haves verified
gaps:
  - truth: "Requirements AUTH-01, AUTH-02, AUTH-03 are traceable in REQUIREMENTS.md"
    status: resolved
    reason: "AUTH-01, AUTH-02, AUTH-03 appear in the PLAN frontmatter and ROADMAP.md but are completely absent from REQUIREMENTS.md — no definition, no description, no traceability row exists for these IDs"
    artifacts: []
    missing:
      - "Add AUTH-01, AUTH-02, AUTH-03 definitions to REQUIREMENTS.md under a new 'Authentication UX' section"
      - "Add traceability rows mapping AUTH-01, AUTH-02, AUTH-03 to Phase 5 in the Traceability table"
human_verification:
  - test: "Run treeji configure interactively (without flags) on a machine with a browser"
    expected: "After entering URL and email, the default browser opens to https://id.atlassian.com/manage-profile/security/api-tokens automatically, then a @clack note with title 'Browser opened' appears"
    why_human: "Browser-open behavior requires a display environment and real TTY — cannot be verified via grep or module import"
  - test: "Run treeji configure interactively over SSH (no display) or set DISPLAY= to simulate headless"
    expected: "After entering URL and email, no browser launches; a @clack note with title 'Open in your browser' appears containing the full token URL for manual copy"
    why_human: "Headless fallback path depends on the OS environment's ability to open a browser — cannot be mocked via code scan"
  - test: "Use a deliberately wrong API token via treeji configure, then run any JIRA-backed command (treeji create or treeji list)"
    expected: "Error message reads: 'JIRA authentication failed (401 Unauthorized). Run treeji configure again to update your API token.'"
    why_human: "Requires live JIRA credentials and a real API call to trigger a 401 response from the Atlassian API"
---

# Phase 5: Simplify JIRA Connection Verification Report

**Phase Goal:** User runs `treeji configure` and the browser opens to the Atlassian API token page automatically — no need to know or navigate to the token URL manually. Auth failures show clear re-configure guidance.
**Verified:** 2026-04-07T12:50:00Z
**Status:** gaps_found — implementation is fully verified; requirement traceability gap found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Interactive configure opens browser to Atlassian API token page after collecting URL and email | VERIFIED | `configure.ts` L66-84: `await open(ATLASSIAN_TOKEN_URL)` in try block after emailResult, before tokenResult prompt |
| 2 | When browser cannot open (SSH/headless), URL is printed with manual instructions | VERIFIED | `configure.ts` L79-84: catch path calls `p.note()` with title 'Open in your browser' and full URL embedded in message |
| 3 | Non-interactive mode (--url --email --token) does NOT open browser | VERIFIED | `configure.ts` L29-33: `isNonInteractive` branch does not call `open()`; test at `configure.test.ts` L93 asserts `expect(mockOpen).not.toHaveBeenCalled()` |
| 4 | 401 JIRA API errors show clear message directing user to run treeji configure again | VERIFIED | `jira.ts` L27-30: `is401` detected before 429 check; throws with exact message `Run \`treeji configure\` again to update your API token.` |
| 5 | TREEJI_JIRA_TOKEN env var fallback continues to work | VERIFIED | `keychain.ts` L12-13 untouched: returns `process.env.TREEJI_JIRA_TOKEN` when set; tests in `keychain.test.ts` confirm env var path |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/commands/configure.ts` | Browser-guided token setup flow | VERIFIED | Contains `import open from 'open'`, `ATLASSIAN_TOKEN_URL` constant, try/catch browser-open block, `p.note()` for both success and fallback paths |
| `src/lib/jira.ts` | 401 detection with re-configure message | VERIFIED | Contains `is401` check at L27, throws with `treeji configure` string at L29; check is BEFORE 429 retry logic at L31 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/commands/configure.ts` | `open` package | `import open from 'open'` | VERIFIED | `configure.ts` L3: `import open from 'open'`; `package.json` confirms `"open": "^11.0.0"` in `dependencies` |
| `src/lib/jira.ts` | error message | 401 detection in withRetry | VERIFIED | `jira.ts` L27: `const is401 = msg.includes('401') \|\| msg.toLowerCase().includes('unauthorized')`; L29 throws message matching `/treeji configure/` |

### Data-Flow Trace (Level 4)

Level 4 not applicable to this phase. The changed artifacts are command handlers and a client library function — neither renders dynamic data from a data store. The `open()` call and the error thrown in `withRetry` are direct side-effects, not data-display paths.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (non-browser tests) | `npm test -- --run` | 621 passed, 1 failed (pre-existing `switch.test.ts` failure unrelated to Phase 5) | PASS |
| Production build succeeds with `open` dep | `npm run build` | `dist/index.js 41.49 KB — Build success` | PASS |
| configure.test.ts browser-open tests | Covered in full suite above | 10 tests pass in configure.test.ts | PASS |
| jira.test.ts 401 detection tests | Covered in full suite above | 26 tests pass in jira.test.ts | PASS |

The one failing test (`switch.test.ts` WRAPPER ABSENT assertion) is a pre-existing failure documented in the PLAN acceptance criteria as an expected skip — it is unrelated to Phase 5.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 05-01-PLAN.md | Not defined in REQUIREMENTS.md | ORPHANED | ID appears in PLAN frontmatter and ROADMAP.md Phase 5 requirements list but has no entry in `.planning/REQUIREMENTS.md` |
| AUTH-02 | 05-01-PLAN.md | Not defined in REQUIREMENTS.md | ORPHANED | Same as AUTH-01 |
| AUTH-03 | 05-01-PLAN.md | Not defined in REQUIREMENTS.md | ORPHANED | Same as AUTH-01 |

AUTH-01, AUTH-02, AUTH-03 are completely absent from `.planning/REQUIREMENTS.md`. The file defines v1 requirements (WT-01 through WT-06, JIRA-01 through JIRA-05, CLI-01 through CLI-06) and explicitly lists OAuth 2.0 as Out of Scope. Phase 5 introduced new auth-UX requirement IDs without adding them to the requirements document or the traceability table.

This is a documentation/traceability gap. The implementation itself satisfies the behaviors the IDs presumably describe — but those behaviors are not formally defined or traceable.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

Scanned `configure.ts`, `jira.ts`, `configure.test.ts`, `jira.test.ts`. No TODOs, placeholders, empty returns, or stub patterns found. All handlers are fully implemented.

### Human Verification Required

#### 1. Browser auto-open in interactive configure

**Test:** Run `treeji configure` interactively (without any flags) on a machine with a graphical browser available. Enter a valid JIRA URL and email address at the prompts.
**Expected:** The default browser opens automatically to `https://id.atlassian.com/manage-profile/security/api-tokens`. A clack note with title "Browser opened" appears in the terminal directing the user to create and paste a token.
**Why human:** Browser launch requires a display environment and real TTY. Unit tests mock `open()` — they verify the call is made but not that the OS actually launches a browser window.

#### 2. Headless/SSH fallback path

**Test:** Run `treeji configure` interactively over an SSH session without X11 forwarding, or temporarily unset `DISPLAY` on Linux to simulate a headless environment.
**Expected:** No browser opens. A clack note with title "Open in your browser" appears containing the full URL `https://id.atlassian.com/manage-profile/security/api-tokens` for manual copy-paste.
**Why human:** The fallback triggers when `open()` rejects. The actual rejection depends on the OS trying and failing to launch a browser — cannot be simulated by code scan alone.

#### 3. Live 401 error message

**Test:** Configure `treeji` with a deliberately invalid or expired API token, then run `treeji create PROJ-1 feature` or `treeji list`.
**Expected:** The error printed to the terminal reads: `JIRA authentication failed (401 Unauthorized). Run treeji configure again to update your API token.`
**Why human:** Requires live JIRA credentials and a real Atlassian API response returning HTTP 401.

### Gaps Summary

The implementation is complete and correct. All five observable truths are verified at all applicable levels (artifact existence, substantive content, wiring, and spot-check via test suite and build). The production build succeeds. Tests pass (621/622 — the one failure is a pre-existing unrelated issue in `switch.test.ts`).

The single gap is a documentation/traceability issue: AUTH-01, AUTH-02, and AUTH-03 appear as requirement IDs in the PLAN frontmatter and ROADMAP.md but are not defined anywhere in `.planning/REQUIREMENTS.md`. There is no description, no acceptance criteria, and no traceability row for these IDs. The requirements document explicitly lists "OAuth 2.0 authentication" as Out of Scope — Phase 5 introduced a narrower auth-UX improvement (browser-guided token setup) that warrants its own requirement definitions.

This gap does not block the goal from being achieved in the codebase. It is a planning artifact consistency issue.

---

_Verified: 2026-04-07T12:50:00Z_
_Verifier: Claude (gsd-verifier)_
