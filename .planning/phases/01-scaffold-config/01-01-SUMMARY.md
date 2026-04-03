---
phase: 01-scaffold-config
plan: 01
subsystem: infra
tags: [typescript, commander, tsup, vitest, napi-rs-keyring, conf, clack-prompts, jira-js, esm, cli]

# Dependency graph
requires: []
provides:
  - TypeScript ESM CLI project scaffold (package.json, tsconfig.json, tsup.config.ts, vitest.config.ts)
  - All runtime dependencies installed (commander, @napi-rs/keyring, conf, @clack/prompts, jira.js)
  - All dev dependencies installed (typescript, tsup, tsx, vitest, @types/node)
  - CLI entry point src/index.ts with shebang + Commander program.parse()
  - Shared JiraConfig interface in src/types/config.ts
  - 5 test stub files covering CLI-02, CLI-06, JIRA-01 behaviors (all .todo state)
  - dist/index.js built with shebang as first line and executable permissions (mode 755)
affects: [02-configure-command, 03-worktree-commands, 04-list-status]

# Tech tracking
tech-stack:
  added:
    - commander@14.0.3 — CLI argument parsing and subcommand routing
    - "@napi-rs/keyring@1.2.0" — OS keychain storage (replaces deprecated keytar)
    - conf@15.1.0 — Config file persistence at ~/.config/mafcli/
    - "@clack/prompts@1.2.0" — Interactive terminal prompts
    - jira.js@5.3.1 — JIRA Cloud REST API v3 TypeScript client
    - typescript@6.0.2 — TypeScript compiler
    - tsup@8.5.1 — esbuild-powered CLI bundler with shebang detection
    - tsx@4.21.0 — TypeScript development runner
    - vitest@4.1.2 — ESM-native test runner
    - "@types/node@25.5.0" — Node.js type definitions
  patterns:
    - ESM-only output with "type":"module" and tsup format=['esm']
    - module:nodenext with explicit .js extensions on relative imports
    - tsup shebang auto-detection marks dist/index.js executable
    - @napi-rs/keyring for keychain (prebuilt NAPI binaries, no compilation)
    - JiraConfig interface separates non-secret config from token (token stays in keychain only)

key-files:
  created:
    - package.json
    - tsconfig.json
    - tsup.config.ts
    - vitest.config.ts
    - .gitignore
    - src/index.ts
    - src/types/config.ts
    - src/build.test.ts
    - src/lib/keychain.test.ts
    - src/lib/config.test.ts
    - src/lib/jira-validate.test.ts
    - src/commands/configure.test.ts
  modified: []

key-decisions:
  - "Use @napi-rs/keyring over keytar — prebuilt NAPI binaries, no node-gyp, Sep 2025 release replaces deprecated keytar"
  - "ESM-only output — all key deps (conf, execa, @clack/prompts) are ESM-only; type=module throughout"
  - "module:nodenext in tsconfig — requires explicit .js extensions on relative imports, prevents ERR_MODULE_NOT_FOUND at runtime"
  - "JiraConfig interface excludes apiToken/token — token flows only through keychain.ts, never conf store"
  - "Added types=['node'] to tsconfig — required for @types/node resolution with module:nodenext"

patterns-established:
  - "Pattern 1 (Shebang Entry): src/index.ts starts with #!/usr/bin/env node as first line — tsup auto-marks dist/index.js executable"
  - "Pattern 2 (ESM Imports): All relative imports use .js extension even for .ts source files"
  - "Pattern 3 (Token Separation): JiraConfig interface never holds token field — token only in keychain or MAFCLI_JIRA_TOKEN env var"

requirements-completed: [CLI-06]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 01 Plan 01: Scaffold & Config Bootstrap Summary

**TypeScript ESM CLI scaffold with tsup build pipeline, Commander entry point, @napi-rs/keyring for macOS Keychain, and 5 vitest test stubs for CLI-02/CLI-06/JIRA-01 behaviors**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-02T08:31:00Z
- **Completed:** 2026-04-02T08:33:30Z
- **Tasks:** 2 completed
- **Files modified:** 13

## Accomplishments

- Project manifest and build tooling fully configured: package.json (type=module, bin.mafcli, files=[dist]), tsconfig.json (module=nodenext), tsup.config.ts (ESM-only), vitest.config.ts
- All 9 dependencies installed (5 runtime + 4 dev): commander, @napi-rs/keyring, conf, @clack/prompts, jira.js, typescript, tsup, tsx, vitest, @types/node
- CLI entry point (src/index.ts) with shebang produces dist/index.js with executable bit — `mafcli --help` prints help text
- JiraConfig type defined with host+email (no token field) and 5 test scaffold files created with 20 .todo tests, vitest exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize project — package.json, tsconfig, tsup, vitest, install deps** - `97f2a36` (chore)
2. **Task 2: Create entry point, shared types, and test scaffolds** - `ab2d0f6` (feat)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified

- `package.json` — npm manifest: type=module, bin.mafcli=dist/index.js, files=[dist], engines.node>=20, all scripts
- `package-lock.json` — lockfile for deterministic installs
- `tsconfig.json` — TypeScript ESM config: module=nodenext, strict=true, types=["node"]
- `tsup.config.ts` — tsup bundle config: entry=src/index.ts, format=['esm'], target=node20
- `vitest.config.ts` — vitest config: environment=node, globals=false
- `.gitignore` — excludes node_modules/, dist/, .env
- `src/index.ts` — CLI entry point: shebang + Commander program wired with name/description/version
- `src/types/config.ts` — JiraConfig interface: host and email fields (no token)
- `src/build.test.ts` — CLI-06 smoke test stubs (shebang + executable bit)
- `src/lib/keychain.test.ts` — CLI-02 token storage test stubs
- `src/lib/config.test.ts` — JIRA-01 config read/write test stubs
- `src/lib/jira-validate.test.ts` — JIRA-01 /myself validation test stubs
- `src/commands/configure.test.ts` — JIRA-01 configure command test stubs

## Decisions Made

- **@napi-rs/keyring over keytar:** keytar deprecated since 2022, no Node 22+ support. @napi-rs/keyring ships prebuilt NAPI binaries, no native compilation risk on end-user machines.
- **ESM-only output:** All key deps are ESM-only. Pure ESM avoids dual-format complexity.
- **module:nodenext:** Enforces explicit .js extensions on relative imports, preventing ERR_MODULE_NOT_FOUND at runtime (TypeScript would compile fine but Node.js ESM loader would fail).
- **JiraConfig has no token field:** Security separation — token lives only in @napi-rs/keyring keychain or MAFCLI_JIRA_TOKEN env var, never in conf file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `types: ["node"]` to tsconfig.json**
- **Found during:** Task 2 (Create entry point, shared types, and test scaffolds)
- **Issue:** `npx tsc --noEmit` failed with TS2591 errors — `@types/node` installed but not declared in tsconfig `types` array, so `node:fs`, `node:path`, and `process` were unresolved in build.test.ts
- **Fix:** Added `"types": ["node"]` to tsconfig.json compilerOptions
- **Files modified:** tsconfig.json
- **Verification:** `npx tsc --noEmit` exits 0 after fix
- **Committed in:** ab2d0f6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical TypeScript configuration)
**Impact on plan:** Essential fix for TypeScript correctness — plan's success criterion requires `npx tsc --noEmit` exits 0. No scope creep.

## Issues Encountered

None beyond the tsconfig deviation above.

## User Setup Required

None - no external service configuration required. All dependencies install without native compilation (`@napi-rs/keyring` uses prebuilt NAPI binaries).

## Known Stubs

All test files contain only `.todo` tests — this is intentional per plan design. Wave 2 plans (starting with 01-02) will implement the actual test bodies.

- `src/build.test.ts` — 2 todos (shebang + executable bit checks against dist/index.js)
- `src/lib/keychain.test.ts` — 4 todos (env var fallback, null case, round-trip, deleteToken)
- `src/lib/config.test.ts` — 4 todos (saveConfig, loadConfig round-trip, empty case, no-token assertion)
- `src/lib/jira-validate.test.ts` — 3 todos (/myself 200, 401, unreachable)
- `src/commands/configure.test.ts` — 7 todos (non-interactive flags, interactive prompts, post-save validation)

These stubs are intentional scaffolds. Plan 01-02 will wire the implementations that make these tests pass.

## Next Phase Readiness

- Build pipeline fully functional — Plan 01-02 can `import` from src/ files immediately
- All node_modules installed — no blocking npm install needed
- Test infrastructure ready — `npx vitest run` exits 0, ready for Wave 2 implementations
- JiraConfig interface defined and importable as `import type { JiraConfig } from '../types/config.js'`
- No blockers for Plan 01-02 (configure command implementation)

---
*Phase: 01-scaffold-config*
*Completed: 2026-04-02*

## Self-Check: PASSED

All files verified present. Both commits (97f2a36, ab2d0f6) confirmed in git log. dist/index.js exists with shebang as first line.
