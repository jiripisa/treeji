# Pitfalls Research

**Domain:** CLI worktree management tool with JIRA Cloud integration (TypeScript/Node.js)
**Researched:** 2026-04-02
**Confidence:** HIGH (git worktree mechanics), MEDIUM (JIRA API specifics), HIGH (Node.js CLI patterns)

## Critical Pitfalls

### Pitfall 1: "Switch to Worktree" Cannot Change the Parent Shell's Directory

**What goes wrong:**
A CLI subprocess cannot change the working directory of the parent shell. When a user runs `mafcli switch PROJ-123`, the Node.js process changes its working directory internally, then exits — the user's shell remains in the original directory. The feature appears to work but does nothing useful.

**Why it happens:**
Every child process has its own copy of the environment. `chdir()` inside a subprocess only affects that subprocess. The shell's `$PWD` is untouched. This is a fundamental POSIX constraint, not a Node.js bug.

**How to avoid:**
Implement shell function integration as a first-class feature. The binary outputs the target path using a sentinel prefix (e.g., `__MAFCLI_CD__:/path/to/worktree`) and a shell wrapper function installed via `mafcli setup` intercepts it, strips the sentinel, and runs the shell's built-in `cd`. This is the established pattern used by `wtp`, `cafreeman/worktree`, and `claude-worktree`. The wrapper is a shell function in `.zshrc`/`.bashrc` that calls the binary, reads the sentinel output line, and calls `cd` on the extracted path.

**Warning signs:**
- Planning `switch` command without a shell integration design document
- Calling `process.chdir()` and expecting it to propagate to the user's shell
- No `mafcli setup` / shell init command in the design

**Phase to address:**
Phase 1 (core worktree operations). Shell integration must be designed before the `switch` command is implemented, not added later. Retrofitting it after user-facing commands exist is a disruptive interface change.

---

### Pitfall 2: Manual Directory Deletion Leaves Stale Git Metadata

**What goes wrong:**
User runs `rm -rf ../PROJ-123/` instead of `mafcli delete PROJ-123`. Git still holds metadata in `.git/worktrees/<n>/`. The branch appears "locked" to a missing worktree. `git worktree list` shows the dead worktree as "prunable." Attempting to re-create a worktree on the same branch fails with "already checked out."

**Why it happens:**
Git tracks linked worktrees in `.git/worktrees/`. It does not auto-clean when the directory disappears. CLI tools that only remove the filesystem directory without calling `git worktree remove` leave this metadata behind.

**How to avoid:**
Always use `git worktree remove <path>` (which also deletes the directory). If the directory is already gone, run `git worktree prune` to clean up stale entries. In `mafcli delete`, call `git worktree remove` first, falling back to `git worktree prune` if the directory is already absent. Both cases should succeed silently.

**Warning signs:**
- `delete` implementation uses only `fs.rmSync` or shell `rm -rf` without calling git
- No `git worktree prune` call in the delete flow
- No handling of the "directory already gone" error case

**Phase to address:**
Phase 1 (delete command implementation). Add `git worktree prune` as a post-delete cleanup step unconditionally — it is idempotent and cheap.

---

### Pitfall 3: JIRA Issue Summary to Branch Name Slug Produces Unusable or Colliding Names

**What goes wrong:**
JIRA summaries are up to 255 characters, contain Unicode, punctuation, emoji, and language-specific characters (Czech in this project, but also Japanese, Arabic, etc. for teammates). A naive `.toLowerCase().replace(/\s+/g, '-')` leaves slashes, dots, colons, and accented characters in the branch name. Git accepts some of these silently but remote pushes fail. Very long summaries create unmanageable branch names. Two different summaries can produce the same slug, causing branch collisions.

**Why it happens:**
Developers test slug generation with simple English summaries. Edge cases such as "Fix: user's `login` endpoint (PROJ-123)" or Czech diacritics like "Oprava přihlášení" only surface with real ticket data.

**How to avoid:**
Use a battle-tested slugify library (e.g., `slugify` with `strict: true` and `lower: true`). The pipeline should be: Unicode normalize (NFD) then transliterate to ASCII then lowercase then replace non-alphanumeric characters with `-` then collapse multiple `-` then truncate to ~50 characters then strip leading/trailing `-`. Always prefix with the ticket ID: `feature/PROJ-123-fix-user-login-endpoint` — the ticket ID guarantees uniqueness regardless of summary slug collisions.

**Warning signs:**
- Custom regex-based slug generation without a dedicated library
- No truncation on slug length
- Branch name does not include the ticket ID as a collision-proof prefix

**Phase to address:**
Phase 1 (worktree creation). Slug generation is a small utility function but must handle the full Unicode edge case set from day one. Write unit tests covering Czech diacritics, emoji, all-special-character titles, and 255-character summaries.

---

### Pitfall 4: Storing JIRA API Token in Plain-Text Config File

**What goes wrong:**
`~/.config/mafcli/config.json` contains `{ "apiToken": "ATATTxxx..." }` in plain text. The file is readable by all local processes by default. It gets accidentally committed to dotfiles repositories. It appears in shell history if passed as an argument.

**Why it happens:**
It is the simplest implementation. Many developer tools store credentials this way. The token feels "safe" because it lives on the local machine.

**How to avoid:**
Store the token in the OS keychain using `keytar` (macOS Keychain, Windows Credential Manager, Linux Secret Service via libsecret). Store only non-sensitive config (JIRA URL, email) in the plain-text file. Provide graceful degradation: if `keytar` native bindings fail to compile, warn the user and fall back to an environment variable (`MAFCLI_JIRA_TOKEN`). Never accept tokens as CLI arguments (they appear in `ps` output and shell history).

**Warning signs:**
- Config schema includes `apiToken` or `token` as a plain JSON field
- No dependency on `keytar` or equivalent in package.json
- Setup flow stores token directly into JSON

**Phase to address:**
Phase 1 (configuration setup). Security architecture must be decided before the first `config set` command is built. Migrating plain-text storage to keychain after distribution is painful for existing users.

---

### Pitfall 5: New Worktrees Have No node_modules

**What goes wrong:**
A new worktree is created from a branch that has different `package.json` dependencies than the current branch. The worktree directory at `../PROJ-123/` has no `node_modules` at all because worktrees created as sibling directories do not share `node_modules` with the main repo. Running the project inside the worktree fails immediately with "Cannot find module" errors.

**Why it happens:**
Developers assume worktrees share `node_modules` from the main repository. They do not. Each worktree's directory is a clean checkout with no build artifacts.

**How to avoid:**
After `git worktree add`, output a clear post-create hint: "Run `npm install` (or your package manager) inside the new worktree before starting work." Optionally offer to run `npm install` automatically if the user opts in via a config flag. Document this prominently in `mafcli help create`. Consider printing the exact path and an example command.

**Warning signs:**
- Create command flow exits immediately after `git worktree add` with no post-create output
- No mention of dependencies or setup in the create command's help text

**Phase to address:**
Phase 1 (create command UX). Post-create hints are trivial to add and prevent the most common first-time friction point.

---

### Pitfall 6: JIRA API Rate Limiting Causes Silent Failures or Crashes

**What goes wrong:**
Atlassian JIRA Cloud enforces three independent rate limiting systems: a per-hour points quota (65,000–500,000 points shared), per-second burst limits, and per-issue write limits. Hitting any returns HTTP 429. Without explicit handling, the CLI crashes with an unhelpful stack trace or silently returns empty results for the issue list.

**Why it happens:**
Personal CLI tools typically don't hit rate limits in normal solo use, so developers skip retry logic. However, a `list` command that fetches status for each worktree individually creates N sequential API calls, which quickly exhausts burst limits.

**How to avoid:**
Always check for HTTP 429 and respect the `Retry-After` response header. Use the `fields` query parameter to request only what is needed (`summary,status,key`) — each additional field adds to the points cost. For the `list` command, batch multiple issue lookups into a single JQL query (`issue in (KEY-1, KEY-2, ...)`) rather than one request per worktree. Log the `RateLimit-Reason` response header value when a 429 occurs to aid diagnosis.

**Warning signs:**
- HTTP responses only checked for 200 vs non-200 with no 429-specific branch
- Separate API call per worktree in the `list` command
- No retry logic in the JIRA client wrapper

**Phase to address:**
Phase 2 (JIRA integration). Build a thin JIRA client wrapper with rate-limit handling before any feature uses the API. All subsequent features use the wrapper, not raw fetch.

---

### Pitfall 7: "Assigned to Me" JQL Requires accountId, Not Email

**What goes wrong:**
JQL query `assignee = "user@company.com"` silently returns no results or throws a 400 error in JIRA Cloud v3. JIRA Cloud removed username and email from JQL in April 2019 for GDPR compliance. The `assignedToMe()` function exists but behavior with Basic Auth may vary.

**Why it happens:**
Developers copy JQL examples from JIRA Server documentation or pre-2019 articles. The username-to-accountId migration is not prominently flagged in most tutorials.

**How to avoid:**
Use `assignee = currentUser()` in JQL — this resolves correctly for Basic Auth API token requests. Alternatively, call `GET /rest/api/3/myself` first to retrieve the `accountId`, then use `assignee = "<accountId>"` in JQL. Never construct JQL with email address strings.

**Warning signs:**
- JQL containing `assignee =` followed by an email address string
- No call to `/rest/api/3/myself` to resolve the current user's identity
- JQL examples sourced from non-Cloud (Server/Data Center) JIRA documentation

**Phase to address:**
Phase 2 (JIRA integration). Establish the `currentUser()` or `accountId` pattern in the first JQL query written. Verify against a real JIRA Cloud instance before building any UI around the results.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline shell string interpolation for git commands | Fast to write | Security risk if any user input reaches the command string; cryptic failures on non-zero exit | Never — use spawnSync with argument arrays |
| Hardcode JIRA base URL without validation | Simpler config | Fails cryptically when URL has trailing slash, wrong scheme, or is empty | Never |
| Single JIRA API call per worktree in `list` | Simple code | N+1 problem; 10 worktrees = 10 API calls; hits burst limits quickly | Never — batch with JQL `issue in (KEY-1, KEY-2, ...)` |
| Plain-text token in config file | Zero extra dependency | Security exposure, accidental commits in dotfiles repos | Never for tokens; acceptable for non-sensitive config like JIRA URL |
| No slug truncation | Simpler code | Branch names may exceed filesystem path length limits | Never |
| Skip `git worktree prune` in delete | Slightly faster delete | Accumulates stale `.git/worktrees/` entries; branch appears locked after re-creation | Never — it is idempotent and fast |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| JIRA REST API v3 | Requesting all fields (`fields=*all`) | Use `fields=summary,status,assignee,key` — minimizes points consumed per request |
| JIRA REST API v3 | Pagination with `startAt` offset | v3 `/search/jql` uses `nextPageToken` cursor — `startAt` is not available on this endpoint |
| JIRA REST API v3 | Using email in JQL `assignee =` clause | Use `currentUser()` function or resolve `accountId` from `/myself` endpoint first |
| JIRA Basic Auth | Sending raw email:token | Must Base64-encode `email:api_token` and set header `Authorization: Basic <encoded>` |
| `git worktree add` | Checking out a branch already checked out elsewhere | Git rejects this with a fatal error; intercept the known error pattern and show an actionable message |
| Git subprocess invocation | Passing JIRA ticket IDs directly via shell string | Use spawnSync with argument arrays (`['worktree', 'add', path, branch]`) to prevent shell injection |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Serial JIRA API calls per worktree in `list` | `list` takes 2–5 seconds for 10 worktrees | Batch: fetch all issue keys in one JQL query `issue in (A, B, C, ...)` | 5+ active worktrees |
| `git status` subprocess per worktree | `list` hangs noticeably on large repos | Use `git -C <path> status --short --branch` with a timeout; consider parallel execution | 10+ worktrees with large repos |
| No caching of JIRA issue data | Every `list` call fetches fresh data even mid-session | Cache issue titles and status in a local file with a short TTL (60s is sufficient — titles rarely change mid-session) | Multiple `list` calls per minute |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Plain-text API token in `~/.config/mafcli/config.json` | Token exposed to other local processes; accidental dotfiles commits | Use OS keychain via `keytar`; support `MAFCLI_JIRA_TOKEN` env var as fallback |
| Passing JIRA ticket ID via shell string interpolation | Shell injection if ticket ID is malformed or tampered | Validate ticket ID format with regex before use; use spawnSync with argument arrays |
| JIRA token accepted as CLI argument | Token visible in `ps aux` output and shell history | Never accept token via flag; use env var or keychain only |
| Logging full API response on error | Token and sensitive issue data persisted in log files | Log only HTTP status code and sanitized error message |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| `switch` command that does not actually change directory | Confusing: command reports success but nothing happens | Require shell function setup (`mafcli setup`) and fail gracefully with setup instructions if not installed |
| No JIRA connectivity check on first run | Cryptic 401 or network errors mid-workflow | On first use after config, validate connectivity with a lightweight `/myself` call and show a clear auth error if it fails |
| Raw git error messages passed through unchanged | "fatal: '/path/to/dir' is already checked out" leaves user confused | Intercept known git error patterns and rewrite into actionable messages explaining what the user should do |
| `list` command fetches data with no loading indicator | Appears frozen for 1–3 seconds during JIRA API calls | Show a spinner (e.g., `ora`) while fetching; interactive tools feel broken without any feedback |
| Worktree path relative to `$PWD` instead of git root | Running `mafcli create` from a non-root directory creates worktree in the wrong location | Always resolve the git root first (`git rev-parse --show-toplevel`) and create paths relative to that |

## "Looks Done But Isn't" Checklist

- [ ] **Shell integration for `switch`:** Demo works in dev because the shell wrapper is installed. Verify that running the binary directly (without wrapper) does not change the directory, and that the wrapper does change it in a fresh shell.
- [ ] **Token storage:** Saving config "works" in dev. Verify that `keytar` compiles and reads back correctly on a clean system. Test the fallback to `MAFCLI_JIRA_TOKEN` env var when keytar is unavailable.
- [ ] **Branch slug generation:** Test with Czech diacritics, emoji in summaries, titles starting with numbers, titles composed entirely of special characters, and 255-character summaries.
- [ ] **Worktree delete:** Verify the branch is also deleted on request (by default `git worktree remove` does not delete the branch — this must be a separate explicit step). Test re-creation of a worktree on the same ticket immediately after delete.
- [ ] **JIRA list command:** Verify it works when the user has 0 assigned tickets, 1 ticket, and 50+ tickets (pagination token behavior).
- [ ] **Offline behavior:** Verify the tool degrades gracefully when JIRA is unreachable — show a cached result or clear offline message, not a raw network stack trace.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Shell integration missing from design | HIGH | Requires redesigning the switch/navigate command interface; the sentinel output protocol change breaks existing shell wrappers |
| Plain-text token already distributed to users | LOW | Provide `mafcli config migrate` command that reads old token, stores in keychain, removes from JSON; safe to run multiple times |
| Stale worktree metadata after manual deletion | LOW | Run `git worktree prune` — removes `.git/worktrees/<n>/` entries for missing directories; branch becomes available again |
| Branch slug collisions from missing ticket ID prefix | MEDIUM | Renaming branches that users have pushed is disruptive; establish `PROJ-123-slug` convention in phase 1, before any branches are created |
| N+1 JIRA API calls baked into `list` command | MEDIUM | Refactor `list` to batch JQL lookup; requires changing the data-fetching layer but not the display layer; testable in isolation |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Shell integration for directory change | Phase 1: Core worktree commands | Run `mafcli switch` without wrapper installed; confirm `$PWD` unchanged; install wrapper and confirm it changes directory |
| Manual deletion / stale metadata | Phase 1: Delete command | Delete a worktree with the command; then `rm -rf` another; verify `list` handles both cleanly and `git worktree list` shows no stale entries |
| Branch slug edge cases | Phase 1: Create command | Unit tests for slug function with emoji, Czech/Unicode characters, 255-char summaries, special-character-only titles |
| Token plain-text storage | Phase 1: Config setup | Inspect `~/.config/mafcli/` after `mafcli config setup` — no token visible in any JSON or plain-text file |
| Missing node_modules hint | Phase 1: Create command UX | Verify post-create output includes setup reminder with exact command |
| Rate limiting | Phase 2: JIRA client wrapper | Mock HTTP 429 with `Retry-After` header; verify automatic retry and no crash |
| accountId / currentUser() JQL | Phase 2: JIRA integration | Test `list assigned` against real JIRA Cloud instance; verify correct issues returned |
| N+1 API calls in list | Phase 2: List command | Time `list` with 10 active worktrees; inspect network log to confirm single batched JQL request |

## Sources

- [Git worktree official documentation](https://git-scm.com/docs/git-worktree)
- [Atlassian JIRA Cloud Rate Limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/)
- [JIRA Cloud REST API deprecation: username to accountId](https://developer.atlassian.com/cloud/jira/platform/deprecation-notice-user-privacy-api-migration-guide/)
- [nodejs-cli-apps-best-practices](https://github.com/lirantal/nodejs-cli-apps-best-practices)
- [wtp: A Better Git Worktree CLI Tool](https://dev.to/satococoa/wtp-a-better-git-worktree-cli-tool-4i8l)
- [cross-keychain: Cross-platform secret storage for Node.js](https://github.com/magarcia/cross-keychain)
- [Git Worktree FAQ](https://www.gitworktree.org/faq)
- [Git Worktree Branch Locked: Linked Worktree Guide (2026)](https://devtoolbox.dedyn.io/blog/git-worktree-branch-locked-linked-worktree-remote-tracking-guide)
- [Atlassian: Evolving API rate limits](https://www.atlassian.com/blog/platform/evolving-api-rate-limits)
- [Optimizing JIRA /search/jql Pagination](https://community.atlassian.com/forums/Jira-questions/Optimizing-Data-Retrieval-with-rest-api-3-search-jql-Pagination/qaq-p/2957628)
- [alexandregv/worktree: shell function navigation pattern](https://pkg.go.dev/github.com/alexandregv/worktree)
- [slugify npm package](https://www.npmjs.com/package/slugify)

---
*Pitfalls research for: CLI worktree management + JIRA Cloud integration (mafcli)*
*Researched: 2026-04-02*
