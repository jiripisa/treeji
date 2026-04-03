# Project Research Summary

**Project:** mafcli
**Domain:** TypeScript CLI tool — git worktree management with JIRA Cloud integration
**Researched:** 2026-04-02
**Confidence:** HIGH

## Executive Summary

mafcli is a personal developer productivity tool that closes the workflow gap between JIRA ticket management and git worktree operations. The research confirms this is a well-understood problem domain with several partial solutions (gwq, wtp, worktrunk, jira-cli) but no existing tool that combines JIRA-driven worktree creation with live ticket status in the worktree list. The recommended approach is a layered TypeScript CLI using Commander.js for argument parsing, jira.js for typed JIRA Cloud API access, execa for git subprocess execution, and conf for credential storage — all wired together with a clean commands/services/lib separation that keeps business logic testable in isolation.

The recommended build sequence prioritizes infrastructure before features: config storage first, then git primitives, then JIRA integration, then the interactive UX layer. This order is driven by hard dependencies discovered in the feature research — every JIRA feature requires working credential storage, and every worktree operation requires working git primitives. The MVP is well-scoped at six commands (config, create, list, pick, remove, shell cd) and delivers complete replacement of the manual `git worktree add -b feature/PROJ-123-slug` workflow.

The key risks are architectural rather than technical. Two pitfalls must be addressed before any code is written: (1) the `switch`/`cd` command requires a shell function integration pattern that cannot be retrofitted easily after the interface is established, and (2) credential storage must use the OS keychain rather than plain-text JSON from day one, as migrating existing users off plain-text is painful. A third early decision — using `ticket-ID-prefixed` branch slugs with a proper Unicode-aware slugify library — prevents branch collision issues that are difficult to recover from after users have pushed branches.

## Key Findings

### Recommended Stack

The stack is modern ESM-native TypeScript targeting Node.js 22 LTS. All selected packages are ESM-only or dual CJS/ESM, which requires consistent `--module nodenext` in tsconfig and careful attention to interop. The development toolchain (tsx for local runs, tsup for production builds, vitest for tests) eliminates the ts-node overhead and produces proper CLI binaries with shebangs. No framework-level choices are contentious — these are established, high-download packages with strong maintenance histories.

**Core technologies:**
- Node.js 22 LTS: runtime — stable LTS, active until April 2027; commander@14 and jira.js@5 both require Node.js 20+
- TypeScript 5.8+: language — `--module nodenext` fixes for Node.js 22 ESM behavior; strict mode required for Zod 4 inference
- Commander.js 14: CLI argument parsing — 35M weekly downloads, 180KB, 0 dependencies, 18ms startup; correct scale for a personal tool
- jira.js 5.2: JIRA Cloud REST API v3 — only TypeScript-native client with full v3 coverage and Basic Auth support
- execa 9.6: git subprocess execution — ESM-native, template string syntax, no shell injection risk, async-first
- @clack/prompts 1.1: interactive prompts — cleaner than Inquirer.js v9+ (which fragmented its API in ESM migration)
- conf 15.1: config persistence — stores at `~/.config/mafcli/`, ESM-only, correct tool for user-level global state
- Zod 4: schema validation — 14x perf improvement over v3; validates JIRA API responses beyond what jira.js types provide
- tsup 8.5: build — esbuild-powered, handles shebang for CLI bin entries, dual CJS/ESM output

**Key rejection:** simple-git has no worktree API methods (confirmed by type definitions) — it would call `.raw(['worktree', 'add', ...])` anyway, making execa the better transparent choice.

### Expected Features

The MVP must replace the full manual `git worktree add -b feature/PROJ-123-slug ../PROJ-123-slug` workflow end to end. No existing tool combines worktree management with JIRA — this is the core differentiator.

**Must have (table stakes):**
- `mafcli config set` — store JIRA URL, email, API token (prerequisite for all JIRA features)
- `mafcli create <TICKET-ID> [type]` — fetch ticket, create branch + worktree, print path
- `mafcli list` — show all worktrees with branch, dirty indicator, ahead/behind, JIRA status
- `mafcli pick` — interactive list of assigned JIRA tickets → select to create worktree
- `mafcli remove <worktree>` — delete worktree and branch safely
- Shell `cd` function — CLI outputs path; shell wrapper changes directory in parent shell

**Should have (competitive differentiators):**
- JIRA ticket status shown inline in `mafcli list` — unique among all comparable tools
- Fuzzy search in `mafcli pick` — filter assigned tickets by typing
- `mafcli open <worktree>` — open worktree in configured editor
- Uncommitted changes safety check before delete

**Defer (v2+):**
- JIRA ticket status transitions (move to In Progress on create)
- `mafcli prune` — bulk remove worktrees for closed tickets
- Automated shell function injection into `.zshrc`/`.bashrc`
- Per-repo JIRA project configuration

**Anti-features to avoid:** full TUI/interactive interface, automatic branch type detection from issue type, automatic worktree deletion on ticket close, multi-project JIRA support, GitHub/GitLab PR integration.

### Architecture Approach

The recommended architecture separates concerns into three layers: commands (Commander.js handlers owning input, prompts, and output), services (pure business logic for worktree and JIRA operations), and lib (adapters for external I/O — git subprocess and config file). Commands orchestrate services; services never import commands; all git subprocess calls are routed through a single `lib/git.ts` adapter. This pattern makes services independently testable and prevents prompt logic from leaking into service methods.

**Major components:**
1. `src/commands/` — one file per CLI command; owns arg validation, @clack/prompts calls, and console output
2. `src/services/worktree.ts` — worktree CRUD, branch name generation, path resolution; depends on lib/git.ts
3. `src/services/jira.ts` — issue fetching, JQL queries, data mapping; wraps jira.js Version3Client
4. `src/lib/git.ts` — execa wrapper for all git subprocess calls; single mockable point for tests
5. `src/lib/config.ts` — config read/write with `requireConfig()` guard; provides `JiraConfig` to services
6. `src/types/` — shared interfaces (WorktreeInfo, JiraIssue, JiraConfig) preventing duplication

**Critical architectural constraint:** `@clack/prompts` calls must live exclusively in command handlers, never in services. A service that calls interactive prompts cannot be used from non-interactive contexts (automation, tests) and hangs waiting for terminal input.

### Critical Pitfalls

1. **Shell directory change limitation** — A CLI subprocess cannot change the parent shell's `$PWD`. Implement the sentinel output pattern (`__MAFCLI_CD__:/path`) immediately: the binary prints the path with a prefix; a shell function installed via `mafcli setup` intercepts it and calls `cd`. Design this protocol before writing the `switch` command — retrofitting it after distribution breaks existing shell wrappers.

2. **Plain-text credential storage** — Storing the JIRA API token in `~/.config/mafcli/config.json` exposes it to local processes and enables accidental dotfiles commits. Use `keytar` for OS keychain storage (macOS Keychain, Windows Credential Manager, libsecret on Linux) with `MAFCLI_JIRA_TOKEN` env var as fallback. This decision must be made before the first `config set` implementation.

3. **Branch slug generation edge cases** — JIRA summaries contain Unicode, Czech diacritics, emoji, and 255-character titles. Use the `slugify` library with `strict: true`; always prefix with ticket ID (`PROJ-123-fix-login`) to guarantee uniqueness. Unit test against Czech diacritics, emoji, all-special-character titles, and max-length summaries before any branch is created.

4. **N+1 JIRA API calls in `list`** — Fetching one issue per worktree hits burst rate limits at 5+ active worktrees. Batch all issue lookups into a single JQL `issue in (KEY-1, KEY-2, ...)` request. Build the batching pattern into JiraService from the start, not as a performance fix later.

5. **`assignee = email` in JQL fails silently** — JIRA Cloud v3 removed email from JQL in 2019. Use `assignee = currentUser()` for all JQL queries. Validate against a real JIRA Cloud instance before building any UI around the results.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Project Scaffold and Config Foundation

**Rationale:** All JIRA features require credential storage, and all worktree operations require working git infrastructure. These have no dependencies of their own, making them the correct starting point. Security architecture (keychain vs plain text) must be decided here — it cannot be retrofitted cheaply.

**Delivers:** Working `mafcli config set/get` command, project build pipeline (tsup + tsx + vitest), TypeScript project structure per architecture spec.

**Addresses:** JIRA credential configuration (table stakes feature), `requireConfig()` guard used by all subsequent commands.

**Avoids:** Plain-text token storage pitfall (Pitfall 4). Keytar integration must be established before any other command is built.

**Research flag:** Standard patterns — no phase-level research needed. Config storage with keytar is well-documented.

### Phase 2: Git Worktree Core Operations

**Rationale:** The git worktree layer (`lib/git.ts`, `services/worktree.ts`) has no JIRA dependency. Building it first allows the create/list/remove workflow to be tested end-to-end without network calls. This also forces the branch naming convention (slug generation, ticket ID prefix) to be established before any branches exist.

**Delivers:** `mafcli create <TICKET-ID> [type]` (without JIRA lookup — accepts manual ticket data), `mafcli list` (without JIRA status), `mafcli remove <worktree>`, shell `cd` function and `mafcli setup` command.

**Addresses:** Create worktree, list worktrees, delete worktree, shell cd (all table stakes features).

**Avoids:** Branch slug edge cases (Pitfall 3 — unit test slugify before any branch creation), stale metadata on delete (Pitfall 2 — `git worktree prune` in delete flow), shell directory change limitation (Pitfall 1 — sentinel protocol established here), missing node_modules hint (Pitfall 5 — post-create UX output).

**Research flag:** Standard patterns — git worktree commands, --porcelain format, execa usage are all well-documented.

### Phase 3: JIRA Integration Layer

**Rationale:** The JIRA service layer builds on the working config foundation from Phase 1. All JIRA API patterns (JQL with `currentUser()`, batched issue lookups, rate limit handling) should be established in `services/jira.ts` before any UI is built around them. Validating against a real JIRA Cloud instance is required before Phase 4.

**Delivers:** `services/jira.ts` with batched JQL lookup, rate limit handling, Zod-validated responses. Enhanced `mafcli list` showing JIRA ticket status. Full `mafcli create` pulling ticket data from JIRA.

**Addresses:** JIRA status in list (differentiator), create from ticket ID (table stakes).

**Avoids:** `currentUser()` JQL pattern (Pitfall 7), N+1 API calls (Pitfall 6 — batched from day one), JIRA rate limiting without retry (Pitfall 6).

**Research flag:** Needs phase research — JIRA Cloud REST API v3 specifics (pagination with `nextPageToken` vs `startAt`, `fields` parameter costs, `currentUser()` behavior with Basic Auth) warrant targeted research before implementation. Verify against a real instance early.

### Phase 4: Interactive UX and Pick Command

**Rationale:** `mafcli pick` (interactive ticket selection) depends on the JIRA integration from Phase 3. The @clack/prompts integration belongs here since prompts live in command handlers, not services. Once JIRA data flows correctly, the interactive wrapper is straightforward.

**Delivers:** `mafcli pick` — interactive list of assigned JIRA tickets with selection to create worktree. Spinner feedback on all JIRA API calls. Fuzzy search in picker (v1.x).

**Addresses:** Interactive ticket picker (differentiator), worktree health indicators (differentiator).

**Avoids:** No loading indicator pitfall (UX pitfall — spinners on all async operations).

**Research flag:** Standard patterns — @clack/prompts docs are clear and the integration point is well-defined.

### Phase 5: Polish, Safety, and Distribution

**Rationale:** Safety checks (uncommitted changes warning, JIRA connectivity validation on first run), error message humanization, and npm distribution setup belong in a hardening phase after the core flow is stable. These have no feature dependencies but require the full workflow to be testable.

**Delivers:** Uncommitted changes check before delete, `mafcli setup` validation flow, human-readable git error messages, offline graceful degradation, npm publish configuration (bin field, prepublish build).

**Addresses:** Uncommitted changes warning (v1.x feature), open in editor (v1.x feature), shell function auto-injection (v1.x feature).

**Avoids:** Raw git error messages passed through unchanged (UX pitfall), no JIRA connectivity check on first run (UX pitfall), offline crash on unreachable JIRA (UX pitfall).

**Research flag:** Standard patterns — npm package distribution for CLI tools is well-documented.

### Phase Ordering Rationale

- Config must precede all JIRA features (hard dependency on credentials).
- Git worktree layer precedes JIRA integration to enable offline testing of core workflow.
- JIRA integration precedes interactive UX because prompts wrap JIRA data — services must work before UI is layered on top.
- Shell integration (sentinel protocol) is established in Phase 2 with worktree operations, not Phase 4 — retrofitting it after command interfaces exist is a breaking change.
- Security decisions (keychain storage) are forced to Phase 1 because migrating existing users off plain-text storage requires a `config migrate` command that adds scope to a later phase.

### Research Flags

Needs research during planning:
- **Phase 3 (JIRA Integration):** JIRA Cloud REST API v3 pagination (`nextPageToken` cursor, not `startAt`), `fields` parameter point costs, `currentUser()` JQL behavior with Basic Auth, and rate limit response headers require verification against real API behavior. One focused research session before implementation prevents rework.

Phases with standard patterns (skip research-phase):
- **Phase 1:** conf, keytar, tsup configuration are well-documented with official docs.
- **Phase 2:** git worktree --porcelain format, execa usage, slug generation are established patterns.
- **Phase 4:** @clack/prompts API is straightforward and well-documented.
- **Phase 5:** npm CLI distribution is a standard pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Commander.js, jira.js, execa selections verified against npm download data, official docs, and type definitions. simple-git rejection confirmed by actual type definition review. |
| Features | HIGH | Comprehensive competitor analysis (gwq, wtp, worktrunk, jira-cli) and git worktree ecosystem is well-documented. |
| Architecture | HIGH | Standard CLI layering pattern with concrete TypeScript examples. Build order verified against actual component dependencies. |
| Pitfalls | HIGH (git/Node.js patterns), MEDIUM (JIRA API specifics) | Git worktree mechanics and POSIX shell constraints are definitive. JIRA rate limit specifics and pagination cursor behavior need real-instance validation. |

**Overall confidence:** HIGH

### Gaps to Address

- **keytar native compilation on target systems:** keytar requires native bindings that must compile during `npm install`. The fallback to `MAFCLI_JIRA_TOKEN` env var must be tested on a clean system without Xcode CLI tools. Consider whether `@napi-rs/keyring` (pure Rust, prebuilt binaries) is a better choice — worth investigating in Phase 1 if keytar compilation proves fragile.
- **JIRA pagination cursor behavior:** The research notes that `/search/jql` uses `nextPageToken` not `startAt`, but this was a single community source. Validate against the Atlassian REST API docs and a real instance before Phase 3 implementation.
- **`mafcli pick` with large ticket backlogs (50+ assigned tickets):** @clack/prompts `select()` behavior with long lists is not tested in the research. If the list is unwieldy, a fuzzy filter or search-as-you-type input may be needed at MVP rather than v1.x.

## Sources

### Primary (HIGH confidence)
- [simple-git type definitions](https://github.com/steveukx/git-js/blob/main/simple-git/typings/simple-git.d.ts) — confirmed no worktree methods (WebFetch verification)
- [TypeScript 5.8 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/) — Node.js 22 ESM/CJS compatibility
- [Git worktree official documentation](https://git-scm.com/docs/git-worktree) — --porcelain format, prune behavior
- [Atlassian JIRA Cloud Rate Limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/) — rate limit systems
- [JIRA Cloud REST API deprecation: username to accountId](https://developer.atlassian.com/cloud/jira/platform/deprecation-notice-user-privacy-api-migration-guide/) — JQL email removal

### Secondary (MEDIUM confidence)
- [npmtrends: commander vs oclif vs yargs](https://npmtrends.com/commander-vs-oclif-vs-yargs) — download comparison
- [jira.js GitHub README](https://github.com/MrRefactoring/jira.js) — Version3Client API, Basic Auth
- [gwq](https://github.com/d-kuro/gwq), [wtp](https://github.com/satococoa/wtp), [worktrunk](https://worktrunk.dev/), [jira-cli](https://github.com/ankitpokhrel/jira-cli) — competitor feature analysis
- [nodejs-cli-apps-best-practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) — CLI patterns
- [agenttools/worktree](https://github.com/agenttools/worktree) — real-world TypeScript worktree CLI structure
- [slugify npm package](https://www.npmjs.com/package/slugify) — Unicode slug generation
- [Optimizing JIRA /search/jql Pagination](https://community.atlassian.com/forums/Jira-questions/Optimizing-Data-Retrieval-with-rest-api-3-search-jql-Pagination/qaq-p/2957628) — nextPageToken cursor (single community source, needs validation)

### Tertiary (LOW confidence)
- [TypeScript CLI in 2026 article](https://hackers.pub/@hongminhee/2026/typescript-cli-2026) — Optique emergence noted; Commander.js remains standard choice

---
*Research completed: 2026-04-02*
*Ready for roadmap: yes*
