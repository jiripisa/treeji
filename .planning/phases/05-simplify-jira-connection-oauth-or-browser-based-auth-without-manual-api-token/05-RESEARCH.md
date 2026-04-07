# Phase 5: Simplify JIRA Connection — Browser-Guided Token Setup - Research

**Researched:** 2026-04-07
**Domain:** Node.js CLI UX, browser-open packages, @clack/prompts patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Browser-guided token copy approach — CLI opens the Atlassian API token page in the default browser, user creates/copies token there, pastes it back into the CLI prompt
- **D-02:** No OAuth 2.0 or Atlassian CLI login — API token with Basic Auth remains the auth mechanism, just with a smoother setup UX
- **D-03:** User always provides JIRA instance URL manually (no auto-detection from git remote)
- **D-04:** User always provides email manually (no auto-fill from git config)
- **D-05:** Auto-open browser to Atlassian API token page after collecting URL + email; if browser open fails (SSH, headless), fall back to printing the URL with instructions
- **D-06:** Validate credentials immediately after setup with a test JIRA API call (already existing behavior — preserve it)
- **D-07:** Clean break — users must re-run `treeji configure` after upgrade. No migration of existing config.
- **D-08:** Keep TREEJI_JIRA_TOKEN env var fallback for CI/headless environments
- **D-09:** On 401 auth failure, show clear message directing user to run `treeji configure` again. No inline re-auth flow.

### Claude's Discretion

- Browser-open library choice (e.g., `open` npm package or Node.js built-in)
- Exact wording of instructions shown when browser can't open
- Whether to show a spinner while waiting for user to paste token

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

This phase improves the `treeji configure` command UX by automatically opening the Atlassian API token management page in the user's browser after collecting URL and email. The user creates/copies a token there and pastes it back. The underlying auth mechanism (API token + Basic Auth) does not change — only the setup flow improves.

The scope is narrow: one file changes (`src/commands/configure.ts`) plus one new library dependency (`open`). A second change to `src/lib/jira.ts` adds 401 detection pointing users to re-run configure. Existing tests for configure.ts need updates to mock the new `open` call; new test cases cover the headless fallback path.

**Primary recommendation:** Use the `open` npm package (v11, ESM-native, Node.js 20+). Wrap the `open()` call in try/catch; on failure, print the URL manually. This satisfies D-05 cleanly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| open | 11.0.0 | Open URL in default system browser | Sindre Sorhus project; ESM-only (matches project `type: module`); uses `spawn` not `exec` (safe); cross-platform (macOS open, Windows start, Linux xdg-open); Node.js >=20 (matches project engines) |

### No New Supporting Libraries Needed

All other required code uses existing dependencies already in `package.json`:
- `@clack/prompts` — prompts, spinner, note (already installed, `^1.2.0`)
- `@napi-rs/keyring` — token storage (already installed)
- `src/lib/jira-validate.ts` — post-setup validation (already exists)
- `src/lib/config.ts` and `src/lib/keychain.ts` — config/token storage (already exists)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `open` npm package | `child_process.spawn` with platform switch | Manual platform detection (darwin/linux/win32) is ~15 lines of error-prone code; `open` handles WSL, macOS edge cases, xdg-open fallback sequence for free. Use `open`. |
| `open` npm package | Node.js `url.pathToFileURL` + `import('child_process')` | Same manual work as above. No benefit. |

**Installation:**
```bash
npm install open
```

**Version verification:** `npm view open version` returned `11.0.0` (verified 2026-04-07).

---

## Architecture Patterns

### Files to Change

```
src/
├── commands/
│   └── configure.ts      ← MODIFY: insert browser-open step between email prompt and token prompt
│                            add 401-handling message in validation result
└── lib/
    └── jira.ts           ← MODIFY: detect 401 in createJiraClient or callers, emit message
                              directing user to treeji configure
```

No new files. No new directories.

### Pattern 1: Browser-Open with Graceful Fallback (D-05)

**What:** Try `open(url)` in try/catch. If it throws (SSH, headless, xdg-open unavailable), print the URL as plain text with instructions.

**When to use:** Always — the try/catch handles both cases transparently.

```typescript
// Source: open package README + project convention (configure.ts)
import open from 'open';

const TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

async function openBrowserOrPrint(url: string): Promise<boolean> {
  try {
    await open(url);
    return true; // browser opened
  } catch {
    return false; // headless/SSH — caller prints fallback
  }
}
```

Caller in `configure.ts` (after email prompt, before token prompt):

```typescript
const opened = await openBrowserOrPrint(TOKEN_URL);
if (opened) {
  p.note(
    'Opening your browser to the Atlassian API token page.\nCreate a token there, then come back and paste it below.',
    'Browser opened'
  );
} else {
  p.note(
    `Open this URL in your browser:\n${TOKEN_URL}\n\nCreate a token there, then paste it below.`,
    'Manual step required'
  );
}
```

### Pattern 2: Revised Configure Flow Order

**Current order:** URL → email → token paste → validate → save

**New order (D-05 compliant):** URL → email → open browser → show instructions → token paste → validate → save

The `open()` call is fire-and-forget (no `wait: true`) — the browser opens and control returns immediately to the CLI prompt.

### Pattern 3: 401 Error Message (D-09)

**What:** When any JIRA API call fails with 401/auth error, surface a clear re-configure message. Do NOT inline a re-auth flow.

**Where:** The error propagates from `createJiraClient()` as a thrown `Error`. Commands that call JIRA functions already have try/catch (see `create.ts`, `pick.ts` — they call `p.cancel(err.message)`). The existing pattern works: update the error message in `jira.ts` to include "Run `treeji configure` again" when 401 is detected.

```typescript
// In jira.ts createJiraClient() or in withRetry() 401 detection:
const is401 = msg.includes('401') || msg.toLowerCase().includes('unauthorized');
if (is401) throw new Error('JIRA authentication failed (401). Run `treeji configure` again.');
```

Note: withRetry already detects 429 via string matching. Same pattern applies for 401 — jira.js does not expose structured status codes on errors (confirmed in Phase 3 decisions).

### Anti-Patterns to Avoid

- **Do not use `wait: true` with open():** The `open` package README warns that when a browser is already running, `wait: true` resolves immediately because the OS passes the URL to the existing browser process. The CLI would appear to freeze with no timeout.
- **Do not attempt to detect headless before calling open():** Detecting SSH_CLIENT, DISPLAY, etc. is fragile and platform-specific. The try/catch on `open()` itself is the right approach — if it fails, show the URL.
- **Do not add the browser-open step in non-interactive mode (--url --email --token flags):** When all three flags are provided, the user is running non-interactively (CI/scripting). Skip the browser-open step in that path entirely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform browser open | Platform switch `darwin/linux/win32` spawn calls | `open` npm package | Handles WSL, xdg-open fallback chain, macOS app focus, Windows start, 10+ edge cases |
| Headless detection | Check SSH_CLIENT, DISPLAY, isatty() | try/catch on `open()` | The package itself determines whether the open is possible; catch covers all failure modes |

---

## Common Pitfalls

### Pitfall 1: open() Resolves Immediately (No TTY Wait)

**What goes wrong:** Developer assumes `await open(url)` means "wait until user closes browser" or "blocks until token is pasted." It does not — it returns as soon as the OS hands the URL to the browser (or xdg-open exits).

**Why it happens:** The default `wait: false` option returns a child process immediately. Even with `wait: true`, browsers with existing windows resolve immediately.

**How to avoid:** After calling `open()`, immediately show the `p.note()` with instructions, then call `p.password()` for the token. The prompt itself is the wait mechanism.

**Warning signs:** If you see `await open(url, { wait: true })` in the code, it will appear to hang or resolve instantly depending on browser state.

### Pitfall 2: Mocking `open` in Tests

**What goes wrong:** Tests that `import configure.ts` also import `open`, which tries to spawn a real browser process during test runs.

**Why it happens:** ESM static imports execute at module load time.

**How to avoid:** Add `vi.mock('open')` at the top of `configure.test.ts` — same pattern already used for `@clack/prompts`, `../lib/config.js`, and `../lib/keychain.js`. The mock should be a function that returns a resolved Promise (or a rejected one for headless fallback tests).

```typescript
// In configure.test.ts
const mockOpen = vi.fn();
vi.mock('open', () => ({ default: (...args: unknown[]) => mockOpen(...args) }));
```

Note: `open` exports a default export, so the mock factory returns `{ default: fn }`.

### Pitfall 3: Non-Interactive Mode Gets Browser-Open Injected

**What goes wrong:** When `--url`, `--email`, and `--token` are all passed (non-interactive path, currently `isNonInteractive` branch in configure.ts), the browser-open step fires even though no human is present.

**Why it happens:** Inserting the `open()` call outside the `else` block.

**How to avoid:** The browser-open call belongs inside the `else` (interactive) branch only, between the email prompt and the token prompt. The `isNonInteractive` path stays unchanged.

### Pitfall 4: Token URL Hardcoded vs. Derived from JIRA Host

**What goes wrong:** Developer uses `${host}/manage-profile/security/api-tokens` assuming the token page is on the JIRA instance.

**Why it happens:** The JIRA instance URL (`https://myorg.atlassian.net`) looks like it might host user settings.

**How to avoid:** The Atlassian API token page is always at `https://id.atlassian.com/manage-profile/security/api-tokens` — it is a global Atlassian identity URL, not instance-specific. This is confirmed in CONTEXT.md specifics.

---

## Code Examples

### Complete Revised Interactive Flow (configure.ts)

```typescript
// Source: configure.ts current pattern + open package README
import open from 'open';

const ATLASSIAN_TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

// Inside the interactive else branch, after emailResult, before tokenResult:

// Try to open browser — silently fall back if headless/SSH
let browserOpened = false;
try {
  await open(ATLASSIAN_TOKEN_URL);
  browserOpened = true;
} catch {
  browserOpened = false;
}

if (browserOpened) {
  p.note(
    `Opening browser to Atlassian API token page.\nCreate a new token, copy it, then paste it below.`,
    'Browser opened'
  );
} else {
  p.note(
    `Open this URL to create an API token:\n${ATLASSIAN_TOKEN_URL}\n\nCopy the token, then paste it below.`,
    'Open in your browser'
  );
}

const tokenResult = await p.password({
  message: 'Paste your JIRA API token',
  validate: (v) => (v && v.length > 0 ? undefined : 'Token cannot be empty'),
});
```

### 401 Detection in withRetry (jira.ts)

```typescript
// Extend existing withRetry 429 detection pattern:
const is401 = msg.includes('401') || msg.toLowerCase().includes('unauthorized');
if (is401) {
  throw new Error('JIRA authentication failed (401 Unauthorized). Run `treeji configure` again to update your API token.');
}
```

### Mock Pattern for configure.test.ts

```typescript
// Add to top of configure.test.ts, following existing vi.mock pattern:
const mockOpen = vi.fn().mockResolvedValue(undefined);
vi.mock('open', () => ({ default: (...args: unknown[]) => mockOpen(...args) }));
```

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.x |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run` |

Baseline: 399 tests passing, 2 failing in `switch.test.ts` (pre-existing, unrelated to this phase).

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Interactive flow opens browser after email prompt | unit | `npm test -- --run src/commands/configure.test.ts` | ✅ (needs new test case) |
| Browser-open failure falls back to printed URL | unit | `npm test -- --run src/commands/configure.test.ts` | ✅ (needs new test case) |
| Non-interactive mode (--url --email --token) does NOT open browser | unit | `npm test -- --run src/commands/configure.test.ts` | ✅ (existing test, verify still passes) |
| 401 error message contains "treeji configure" instruction | unit | `npm test -- --run src/lib/jira.test.ts` | ✅ (needs new test case) |
| TREEJI_JIRA_TOKEN env var still works (D-08) | unit | `npm test -- --run src/lib/keychain.test.ts` | ✅ (existing, verify still passes) |

### Sampling Rate

- **Per task commit:** `npm test -- --run src/commands/configure.test.ts`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green (minus pre-existing `switch.test.ts` failures) before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. No new test files needed; new test cases go into existing files (`configure.test.ts`, `jira.test.ts`).

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Manual URL navigation, copy-paste token | Browser auto-open to token page | This is what the phase adds |
| `open` v10 (CJS support) | `open` v11 (ESM-only) | v11 requires Node.js 20+; project already requires Node.js 20+ |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `open` npm package | Browser-open step | Not yet installed | 11.0.0 (on npm) | N/A — needs `npm install open` |
| macOS `open` binary | open package on macOS | ✓ | `/usr/bin/open` detected | — |
| `xdg-open` | open package on Linux | Not checked (macOS dev machine) | — | open package catches failure |

**Missing dependencies with no fallback:**
- `open` package must be `npm install open`-ed before implementation.

---

## Open Questions

1. **Should `open` be declared a dependency or devDependency?**
   - What we know: `open` is needed at runtime (not just build time) — it runs when the user runs `treeji configure`.
   - What's clear: It belongs in `dependencies`, not `devDependencies`.
   - Recommendation: `npm install open` (no `--save-dev`).

2. **Pre-existing switch.test.ts failures**
   - What we know: 2 tests in switch.test.ts were failing before this phase.
   - What's unclear: Whether these are environment-specific or reproducible.
   - Recommendation: Do not count these against this phase's success gate. Document as pre-existing.

---

## Sources

### Primary (HIGH confidence)

- `open` package — `npm view open --json` (2026-04-07): version 11.0.0, engines Node.js >=20, ESM `type: module`
- `open` GitHub source via WebFetch: confirmed try/catch pattern, no DISPLAY detection, throws on xdg-open failure
- `open` package README via `npm view open readme`: API confirmed (`open(url)`, no wait needed, spawn-based)
- Project source: `src/commands/configure.ts`, `src/lib/jira.ts`, `src/lib/keychain.ts`, `src/lib/jira-validate.ts` — all read directly

### Secondary (MEDIUM confidence)

- CONTEXT.md: Locked decisions D-01 through D-09 (authoritative for this phase)
- Package.json: Current project dependency versions, Node.js engine requirement (`>=20`)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `open` v11.0.0 verified on npm; ESM match confirmed; Node.js engine match confirmed
- Architecture: HIGH — configure.ts read directly; change scope is narrow and mechanical
- Pitfalls: HIGH — identified from direct source code review and open package README; not from unverified search results

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable domain — `open` package changes slowly)
