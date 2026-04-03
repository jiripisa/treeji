---
phase: 01-scaffold-config
plan: 02
subsystem: infra
tags: [typescript, commander, keychain, napi-rs-keyring, conf, clack-prompts, jira-js, configure-command, vitest, esm]

# Dependency graph
requires:
  - phase: 01-scaffold-config plan 01
    provides: TypeScript ESM scaffold, all deps installed, test stub files, JiraConfig interface
provides:
  - src/lib/keychain.ts — setToken/getToken/deleteToken via @napi-rs/keyring with MAFCLI_JIRA_TOKEN env var override
  - src/lib/config.ts — loadConfig/saveConfig via conf (host + email only, no token)
  - src/lib/jira-validate.ts — validateJiraCredentials via jira.js Version3Client /myself endpoint
  - src/commands/configure.ts — registerConfigureCommand with interactive + non-interactive modes, validation, summary table
  - src/index.ts updated — registerConfigureCommand wired to Commander program
  - All 5 test files fully implemented (20 tests, zero .todo stubs)
affects: [02-worktree-commands, 03-list-status]

# Tech tracking
tech-stack:
  added: []  # All deps installed in Plan 01; no new packages added
  patterns:
    - "Class-based vi.mock() pattern for ESM constructor mocks (arrow function doesn't work with new)"
    - "Shared module-level mock fn references + beforeEach clearance for predictable test isolation"
    - "process.exit mock via throw for cancel-path testing without continuation"
    - "MAFCLI_JIRA_TOKEN env var checked before keychain access — CI-friendly credential override"
    - "Token separation: config.ts never receives token parameter, keychain.ts is sole token store"

key-files:
  created:
    - src/lib/keychain.ts
    - src/lib/config.ts
    - src/lib/jira-validate.ts
    - src/commands/configure.ts
  modified:
    - src/index.ts
    - src/lib/keychain.test.ts
    - src/lib/config.test.ts
    - src/lib/jira-validate.test.ts
    - src/commands/configure.test.ts
    - src/build.test.ts

key-decisions:
  - "Class-based vi.mock() required for constructor mocks — arrow function implementations cannot be called with new in vitest"
  - "Shared mock fn references declared at module scope allow direct .mockClear() without re-importing mocked modules"
  - "process.exit mock throws ExitError for cancel path testing — no-op mock lets execution continue past cancel, causing downstream crashes"

patterns-established:
  - "Pattern: vi.mock with class body for modules used as constructors (@napi-rs/keyring, conf, jira.js)"
  - "Pattern: module-scope mock fns + beforeEach clearance for all configure command test isolation"

requirements-completed: [JIRA-01, CLI-02]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 01 Plan 02: Configure Command Summary

**`mafcli configure` implemented with OS keychain token storage (@napi-rs/keyring), conf-based non-secret config, jira.js /myself validation, interactive + non-interactive modes, and all 20 vitest tests passing green**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-02T08:36:33Z
- **Completed:** 2026-04-02T08:41:35Z
- **Tasks:** 2 completed
- **Files modified:** 10

## Accomplishments

- Three library files (keychain.ts, config.ts, jira-validate.ts) implemented per research Pattern 2 spec — token never touches conf store
- `mafcli configure` command fully functional: `--url/--email/--token` flags for non-interactive mode (D-01), `@clack/prompts` interactive flow with `initialValue` pre-fill from existing config (D-02), JIRA `/myself` validation spinner (D-03), summary note table with token source and connection result (D-04)
- All 20 tests across 5 test files pass with `npx vitest run`; zero `.todo` stubs remain
- `node dist/index.js configure --help` shows `--url`, `--email`, `--token` with shell history warning on token flag

## Task Commits

Each task was committed atomically:

1. **Task 1: keychain.ts, config.ts, jira-validate.ts + tests** - `fdfc81b` (feat)
2. **Task 2: configure.ts, index.ts update, configure.test.ts, build.test.ts** - `89e092b` (feat)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified

- `src/lib/keychain.ts` — setToken/getToken/deleteToken; MAFCLI_JIRA_TOKEN env var checked before keychain call
- `src/lib/config.ts` — loadConfig/saveConfig via conf; imports JiraConfig type; never stores token
- `src/lib/jira-validate.ts` — validateJiraCredentials using Version3Client with Basic Auth; returns { success, displayName?, error? }
- `src/commands/configure.ts` — registerConfigureCommand: non-interactive mode when all 3 flags present, interactive @clack/prompts mode otherwise; URL trailing-slash normalization; summary table D-04
- `src/index.ts` — wired registerConfigureCommand import and call
- `src/lib/keychain.test.ts` — 4 tests: env var override, null-on-empty, setToken mock call, deleteToken no-throw
- `src/lib/config.test.ts` — 4 tests: saveConfig writes host+email, loadConfig round-trip, empty config, type assertion comment
- `src/lib/jira-validate.test.ts` — 3 tests: 200 success with displayName, 401 error, ECONNREFUSED error
- `src/commands/configure.test.ts` — 7 tests: non-interactive flags, D-02 initialValue pre-fill, cancel exits without saving, validateJiraCredentials called, D-04 success note, failure note
- `src/build.test.ts` — 2 tests: shebang first line, executable bit; guarded with `skipIf(!existsSync(distEntry))`

## Decisions Made

- **Class-based vi.mock() for constructors:** vitest's arrow-function mock factory cannot be used with `new` — had to switch to class body syntax for `@napi-rs/keyring`'s `Entry`, `conf`'s `Conf`, and `jira.js`'s `Version3Client`.
- **Module-scope mock fn references:** Declared `const mockNote = vi.fn()` etc. at file scope so tests can call `mockNote.mockClear()` directly in `beforeEach` rather than re-importing — prevents stale mock state across test cases.
- **ExitError for cancel path:** Mocking `process.exit` as a no-op allows code to continue past cancel check, crashing on `host.replace(...)`. Throwing a recognizable error in the mock stops execution cleanly and the test asserts `.rejects.toThrow('exit 0')`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock() constructor incompatibility**
- **Found during:** Task 1 (keychain.ts, config.ts tests)
- **Issue:** `vi.mock` arrow function implementations throw "is not a constructor" when the module exports a class used with `new`. All three test files failed with this error.
- **Fix:** Rewrote mock factories to use `class` body syntax inside `vi.mock()` factory functions for `@napi-rs/keyring`, `conf`, and `jira.js`.
- **Files modified:** src/lib/keychain.test.ts, src/lib/config.test.ts, src/lib/jira-validate.test.ts
- **Verification:** `npx vitest run src/lib/keychain.test.ts src/lib/config.test.ts src/lib/jira-validate.test.ts` exits 0, all 11 tests green
- **Committed in:** fdfc81b (Task 1 commit)

**2. [Rule 1 - Bug] Fixed cancel-path test using process.exit throw**
- **Found during:** Task 2 (configure.test.ts — cancel signal test)
- **Issue:** `process.exit` mocked as no-op allowed execution to continue past `if (p.isCancel(...)) { p.cancel(); process.exit(0); }` — then `host.replace(...)` was called on a cancelled Symbol, throwing `TypeError: host.replace is not a function`
- **Fix:** Changed `process.exit` mock to throw `new ExitError(0)` (custom error class); test now asserts `.rejects.toThrow('exit 0')`
- **Files modified:** src/commands/configure.test.ts
- **Verification:** `npx vitest run src/commands/configure.test.ts` exits 0, all 7 tests green
- **Committed in:** 89e092b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test mock bugs, no production code impact)
**Impact on plan:** Required for test correctness. No production code changes, no scope creep.

## Issues Encountered

None beyond the mock pattern issues documented above as deviations.

## User Setup Required

None — no external service configuration required at this step. The `mafcli configure` command itself is the user setup mechanism. Users run it to configure their JIRA credentials.

## Known Stubs

None — all test stubs replaced with passing implementations. No placeholder data or hardcoded empty values in production code.

## Next Phase Readiness

- `mafcli configure` fully functional: saves JIRA URL + email to conf, stores token in OS keychain, validates against JIRA /myself, prints summary table
- `getToken(email)` returns `MAFCLI_JIRA_TOKEN` env var value when set — CI-ready
- `~/.config/mafcli/config.json` contains only `host` and `email` — token security verified
- All 20 vitest tests green; `npm run build` exits 0
- Phase 01 complete — worktree commands (Phase 02) can import `getToken`, `loadConfig` directly

---
*Phase: 01-scaffold-config*
*Completed: 2026-04-02*

## Self-Check: PASSED

All files verified present: keychain.ts, config.ts, jira-validate.ts, configure.ts, SUMMARY.md.
Both task commits confirmed in git log: fdfc81b, 89e092b.
`npx vitest run` exits 0 with 20 tests across 5 files. `npm run build` exits 0. `node dist/index.js configure --help` shows all flags.
