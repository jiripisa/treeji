# Phase 3: JIRA Integration - Research

**Researched:** 2026-04-02
**Domain:** jira.js Version3Client API, JIRA Cloud REST API v3, retry/backoff patterns in TypeScript
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `create` auto-detects JIRA ticket ID vs manual slug using regex `[A-Z]+-\d+`. If the first argument matches, treat as JIRA ticket — fetch summary from API. If not, treat as manual slug (existing Phase 2 behavior preserved).
- **D-02:** Branch/slug from JIRA ticket uses format `{TICKET-KEY}-{slugified-summary}`, e.g. `PROJ-123-oprava-prihlasovani`. Ticket ID prefix guarantees uniqueness.
- **D-03:** Full branch name becomes `{type}/{TICKET-KEY}-{slugified-summary}`, e.g. `feature/PROJ-123-oprava-prihlasovani`. Worktree directory: `../{TICKET-KEY}-{slugified-summary}/`.
- **D-04:** New color-coded "Status" column in list table. Colors: To Do (grey), In Progress (yellow), Done (green).
- **D-05:** JIRA status fetched via single batched JQL query for all worktrees that have ticket IDs in their branch names (not N+1 individual requests).
- **D-06:** When JIRA is unreachable or worktree has no ticket ID: status column stays empty, warning note `⚠ JIRA unreachable` printed below the table. No crash, no inline error per row.

### Claude's Discretion

- JIRA client wrapper design — shared `Version3Client` factory, retry with exponential backoff, rate limit handling
- How to extract ticket ID from branch name for `list` (regex parse from existing worktree branch names)
- Batch JQL query construction (e.g., `issue in (PROJ-123, PROJ-456)`)
- JIRA API timeout configuration
- How to handle `currentUser()` JQL for listing assigned tickets (JIRA-03 — needed for Phase 4 but the client wrapper should support it)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WT-01 | User can create a worktree from a JIRA ticket ID — CLI fetches ticket name, creates branch (`{type}/{TICKET-slug}`) and worktree directory (`../{TICKET-slug}/`) | `client.issues.getIssue({ issueIdOrKey, fields: ['summary', 'status', 'issuetype'] })` + `toSlug()` already present in codebase |
| WT-06 | User can see JIRA ticket status (To Do, In Progress, Done) alongside each worktree in the list view | Batched `client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost()` with `issue in (KEY-1, KEY-2, ...)` JQL |
| JIRA-02 | User can fetch ticket details by ID (summary, status, issue type) | `client.issues.getIssue()` with `fields` param — confirmed in jira.js 5.3.1 source |
| JIRA-03 | User can list their assigned JIRA tickets (via `currentUser()` JQL) | Client wrapper must expose `searchByJql()` method; Phase 4 feature but wrapper design must support it |
| JIRA-04 | JIRA ticket status displayed in worktree list view with batch JQL query (not N+1) | `issue in (KEY-1, KEY-2, ...)` JQL via `searchForIssuesUsingJqlEnhancedSearchPost()` — POST avoids URL length limits |
| JIRA-05 | JIRA API calls handle rate limits gracefully (retry with backoff) | HTTP 429 detection + `Retry-After` header parsing + exponential backoff — no helper library available in existing deps; implement in wrapper |
</phase_requirements>

---

## Summary

Phase 3 wires the JIRA Cloud REST API v3 into the two existing commands: `create` and `list`. The work has three distinct axes: (1) a new `src/lib/jira.ts` client wrapper that encapsulates `Version3Client` construction, retry logic, and credential loading; (2) extending `create.ts` with a JIRA-detection branch; and (3) extending `list.ts` with a batched status column.

All required libraries are already installed (`jira.js@5.3.1`, `chalk`, `@clack/prompts`, `zod`). No new dependencies are needed for this phase. The installed version of jira.js (5.3.1, one patch above the originally researched 5.2.x) exposes `Version3Client.issues.getIssue()` for single-issue fetch and `Version3Client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost()` for batched JQL lookups. The legacy `searchForIssuesUsingJql()` is deprecated in favor of the enhanced endpoint — use the enhanced POST variant to avoid URL length limits on large worktree lists.

The retry/backoff implementation should live entirely inside `src/lib/jira.ts` so all callers get protection automatically. A simple three-attempt exponential backoff (400ms, 800ms, 1600ms) with `Retry-After` header respect is sufficient for a personal tool with low request volume.

**Primary recommendation:** Create `src/lib/jira.ts` first (Wave 1), then extend `create.ts` (Wave 2) and `list.ts` (Wave 3). Tests follow the established vi.mock() pattern — mock `src/lib/jira.ts` in command tests, unit-test retry logic in isolation.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Installed Version | Purpose | How Used in Phase 3 |
|---------|------------------|---------|---------------------|
| jira.js | 5.3.1 | JIRA Cloud REST API client | `Version3Client.issues.getIssue()`, `issueSearch.searchForIssuesUsingJqlEnhancedSearchPost()` |
| chalk | 5.x | Terminal colors | Status column color-coding (grey/yellow/green) |
| @clack/prompts | 1.2.0 | Spinner during API calls | `spinner()` around JIRA fetch in `create` and `list` |
| zod | 4.x | Schema validation | Validate API response shape for `summary`, `status.name` |

### No New Dependencies

Phase 3 requires zero new `npm install` calls. Every needed library exists in the current lockfile.

---

## Architecture Patterns

### Recommended Project Structure Addition

```
src/lib/
├── jira.ts          # NEW: shared JIRA client wrapper (factory, fetch, batch, retry)
├── jira-validate.ts # EXISTING: validateJiraCredentials — keep as-is
├── config.ts        # EXISTING: loadConfig() for host/email
├── keychain.ts      # EXISTING: getToken() for API token
└── slug.ts          # EXISTING: toSlug() — reused for JIRA summaries
```

### Pattern 1: JIRA Client Factory (singleton-per-call pattern)

**What:** `createJiraClient()` function that loads config + token on demand, returns a `Version3Client`. Throws a descriptive error if credentials are missing.

**When to use:** Every function in `jira.ts` calls this internally. No caller constructs a `Version3Client` directly.

```typescript
// src/lib/jira.ts
import { Version3Client } from 'jira.js';
import { loadConfig } from './config.js';
import { getToken } from './keychain.js';

function createJiraClient(): Version3Client {
  const config = loadConfig();
  if (!config.host || !config.email) {
    throw new Error('JIRA not configured. Run `mafcli configure` first.');
  }
  const token = getToken(config.email);
  if (!token) {
    throw new Error('JIRA API token not found. Run `mafcli configure` first.');
  }
  return new Version3Client({
    host: config.host,
    authentication: { basic: { email: config.email, apiToken: token } },
  });
}
```

### Pattern 2: Retry with Exponential Backoff

**What:** Wrap any JIRA API call in a `withRetry()` helper that catches HTTP 429 responses, reads `Retry-After`, and retries up to 3 times.

**When to use:** Used internally by all exported jira.ts functions. Not exposed to callers.

**CRITICAL:** jira.js throws errors with the response body included in the message string. On 429, the thrown error will contain "429" in the message. There is no guaranteed `.statusCode` property on jira.js thrown errors — parse the message string or use a try/catch that checks for "429" pattern.

```typescript
// Source: jira.js source inspection + Atlassian rate limit docs
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let delay = 400;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429') || msg.includes('Too Many Requests');
      if (!is429 || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('withRetry: unreachable');
}
```

### Pattern 3: Single-Issue Fetch (for `create`)

**What:** Fetch `summary`, `status.name`, and `issuetype.name` for one ticket key using `client.issues.getIssue()`.

**API method:** `Version3Client.issues.getIssue({ issueIdOrKey, fields: ['summary', 'status', 'issuetype'] })`

```typescript
// Source: jira.js 5.3.1 src/version3/issues.ts line 684-717
export async function fetchIssue(ticketKey: string): Promise<{
  key: string;
  summary: string;
  statusName: string;
}> {
  const client = createJiraClient();
  const issue = await withRetry(() =>
    client.issues.getIssue({
      issueIdOrKey: ticketKey,
      fields: ['summary', 'status', 'issuetype'],
    }),
  );
  return {
    key: ticketKey,
    summary: issue.fields?.summary ?? ticketKey,
    statusName: (issue.fields?.status as { name?: string })?.name ?? '',
  };
}
```

### Pattern 4: Batched Status Fetch (for `list`)

**What:** Given an array of ticket keys extracted from branch names, fetch their statuses in a single JQL query.

**API method:** `Version3Client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost()` — POST variant avoids URL length limits for large key arrays. Returns `SearchAndReconcileResults` model with `.issues[]` array.

**CRITICAL:** `searchForIssuesUsingJql()` (the original GET endpoint at `/rest/api/3/search`) is deprecated as of jira.js 5.3.1 with a note that "Endpoint is currently being removed". Use `searchForIssuesUsingJqlEnhancedSearchPost()` at `/rest/api/3/search/jql` (POST).

```typescript
// Source: jira.js 5.3.1 src/version3/issueSearch.ts lines 437-460
export async function fetchIssueStatuses(
  ticketKeys: string[],
): Promise<Map<string, string>> {
  if (ticketKeys.length === 0) return new Map();
  const client = createJiraClient();
  const jql = `issue in (${ticketKeys.join(', ')})`;
  const result = await withRetry(() =>
    client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost({
      jql,
      fields: ['status'],
      maxResults: ticketKeys.length,
    }),
  );
  const map = new Map<string, string>();
  for (const issue of result.issues ?? []) {
    const key = issue.key ?? '';
    const statusName = (issue.fields?.status as { name?: string })?.name ?? '';
    if (key) map.set(key, statusName);
  }
  return map;
}
```

### Pattern 5: Ticket ID Extraction from Branch Name

**What:** Regex to extract JIRA ticket IDs from worktree branch names in `list`.

**Same regex as D-01:** `/[A-Z]+-\d+/` — matches the first occurrence in the branch name.

```typescript
// Used in list.ts to identify which worktrees have JIRA tickets
function extractTicketKey(branch: string | null | undefined): string | null {
  if (!branch) return null;
  const match = branch.match(/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}
```

### Pattern 6: Graceful Degradation in `list`

**What:** Wrap the batched JIRA fetch in a try/catch. On any error (network, auth, timeout), set `jiraStatuses` to an empty Map and set `jiraWarning = true`. After printing the table, print `⚠ JIRA unreachable` if the flag is set.

```typescript
// In list.ts action handler
let jiraStatuses = new Map<string, string>();
let jiraWarning = false;
if (ticketKeys.length > 0) {
  try {
    jiraStatuses = await fetchIssueStatuses(ticketKeys);
  } catch {
    jiraWarning = true;
  }
}
// ... render table ...
if (jiraWarning) {
  console.log(chalk.yellow('⚠ JIRA unreachable — ticket status unavailable'));
}
```

### Pattern 7: JIRA ID Detection in `create`

**What:** Check first argument against `/^[A-Z]+-\d+$/` before running existing slug path.

```typescript
// In create.ts action handler (replaces current top-of-action logic)
const JIRA_KEY_RE = /^[A-Z]+-\d+$/;
if (JIRA_KEY_RE.test(slug)) {
  // JIRA path: fetch summary, build slug, create worktree
  const spinner = p.spinner();
  spinner.start(`Fetching JIRA ticket ${slug}...`);
  const issue = await fetchIssue(slug);
  spinner.stop(`Ticket: ${issue.summary}`);
  const ticketSlug = `${slug}-${toSlug(issue.summary)}`;
  // ... use ticketSlug for branch and worktree path
} else {
  // Existing manual slug path (unchanged)
}
```

### Anti-Patterns to Avoid

- **Constructing `Version3Client` inside command files:** Always use the factory from `jira.ts`. Commands must not import `Version3Client` directly.
- **Using `searchForIssuesUsingJql()` (deprecated GET):** Use `searchForIssuesUsingJqlEnhancedSearchPost()` (POST variant) instead.
- **Per-worktree API calls in `list`:** Always batch with `issue in (KEY-1, KEY-2, ...)` JQL.
- **Crashing on JIRA errors in `list`:** Always degrade gracefully — show worktrees without status, warn below the table.
- **Passing raw ticket key to shell commands:** The ticket key only goes to JIRA API calls, not to any shell string; `execa` array args already protect git operations.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JIRA Cloud API v3 client | Custom fetch/axios wrapper | `jira.js Version3Client` (already installed) | Typed responses, handles auth headers, tested against real API |
| Czech diacritics slugification | Custom replace chain | `toSlug()` from `src/lib/slug.ts` (Phase 2, already tested) | Already handles Czech, emoji, edge cases, 50-char limit |
| Credential loading | Re-implement conf/keychain reads | `loadConfig()` + `getToken()` (existing) | Auth chain already established; any deviation breaks Phase 1 security model |
| Rate limit retry | Per-call retry inline in commands | `withRetry()` in `jira.ts` wrapper | Centralised — all future callers (Phase 4) inherit automatically |

---

## Common Pitfalls

### Pitfall 1: `searchForIssuesUsingJql()` is Deprecated and Being Removed

**What goes wrong:** Using `client.issueSearch.searchForIssuesUsingJql()` which maps to `GET /rest/api/3/search`. jira.js 5.3.1 marks this `@deprecated` with a changelog link noting the endpoint is "currently being removed."

**Why it happens:** It's the most prominently documented method in older jira.js tutorials.

**How to avoid:** Use `searchForIssuesUsingJqlEnhancedSearchPost()` at `POST /rest/api/3/search/jql`. The response type is `SearchAndReconcileResults` (not `SearchResults`) — access `.issues[]` for the array.

**Warning signs:** TypeScript shows a deprecation strikethrough on the method name.

### Pitfall 2: `issue.fields` is Typed as `unknown` or Loosely Typed

**What goes wrong:** `getIssue()` returns `Models.Issue` but `fields` within it is a generic object. Accessing `issue.fields.summary` without casting produces TypeScript errors or runtime `undefined`.

**Why it happens:** JIRA has custom fields that vary per instance; jira.js cannot type them statically.

**How to avoid:** Use explicit casts: `issue.fields?.summary as string | undefined`. For nested objects like status, cast explicitly: `(issue.fields?.status as { name?: string })?.name`. Alternatively validate with a minimal zod schema after fetch.

### Pitfall 3: `Retry-After` Header Not Accessible via jira.js Error Object

**What goes wrong:** Atlassian 429 responses include a `Retry-After` header with the wait time in seconds. jira.js throws an Error object but does not expose response headers in a documented property.

**Why it happens:** jira.js wraps HTTP errors in generic Error objects without structured metadata.

**How to avoid:** Parse the error message for "429" to detect rate limit. Use a fixed exponential backoff (400ms, 800ms, 1600ms) rather than relying on `Retry-After` — for a personal tool with low request volume this is sufficient. Log the raw error message to aid debugging.

### Pitfall 4: JIRA Ticket ID in Branch Name Uses Different Casing

**What goes wrong:** The regex `[A-Z]+-\d+` expects uppercase project keys. Some tools create branches with lowercase like `proj-123-feature`. The extraction regex in `list` would miss them.

**Why it happens:** The `create` command in Phase 3 will always use the original ticket key (uppercase from JIRA), but manually-created branches may use lowercase.

**How to avoid:** Use case-insensitive flag in the extraction regex for `list`: `/([A-Za-Z]+-\d+)/i` — then uppercase the extracted key before using it in JQL. The JIRA API accepts both casings for issue keys.

### Pitfall 5: Empty `ticketKeys` Array Passed to JQL Query

**What goes wrong:** Constructing JQL `issue in ()` with an empty array produces a JQL parse error from the JIRA API.

**Why it happens:** `list` command iterates worktrees and some/all may have no recognizable ticket ID in their branch name.

**How to avoid:** Guard before calling `fetchIssueStatuses`: `if (ticketKeys.length === 0) return new Map()`. The `fetchIssueStatuses` function already handles this per Pattern 4 above.

### Pitfall 6: Slug from JIRA Summary Becomes Empty After `toSlug()`

**What goes wrong:** If the JIRA summary consists entirely of non-ASCII, special characters, or emoji, `toSlug()` returns `''`. The resulting worktree slug would be just `PROJ-123-` which fails `validateSlug()`.

**Why it happens:** `toSlug()` uses `strict: true` which strips all non-alphanumeric chars; some summaries reduce to empty.

**How to avoid:** After computing `toSlug(issue.summary)`, if the result is empty, fall back to just the ticket key as slug: `ticketSlug = slug` (i.e., `PROJ-123`). This is safe because the ticket key is already unique.

---

## Code Examples

### Full `src/lib/jira.ts` Skeleton

```typescript
// Source: jira.js 5.3.1 source inspection — Version3Client, issues.ts, issueSearch.ts
import { Version3Client } from 'jira.js';
import { loadConfig } from './config.js';
import { getToken } from './keychain.js';

function createJiraClient(): Version3Client {
  const config = loadConfig();
  if (!config.host || !config.email) {
    throw new Error('JIRA not configured. Run `mafcli configure` first.');
  }
  const token = getToken(config.email);
  if (!token) {
    throw new Error('JIRA API token not found. Run `mafcli configure` first.');
  }
  return new Version3Client({
    host: config.host,
    authentication: { basic: { email: config.email, apiToken: token } },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let delay = 400;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429') || msg.toLowerCase().includes('too many requests');
      if (!is429 || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('withRetry: unreachable');
}

export async function fetchIssue(ticketKey: string): Promise<{
  key: string;
  summary: string;
  statusName: string;
}> {
  const client = createJiraClient();
  const issue = await withRetry(() =>
    client.issues.getIssue({
      issueIdOrKey: ticketKey,
      fields: ['summary', 'status', 'issuetype'],
    }),
  );
  return {
    key: ticketKey,
    summary: (issue.fields?.summary as string | undefined) ?? ticketKey,
    statusName: (issue.fields?.status as { name?: string } | undefined)?.name ?? '',
  };
}

export async function fetchIssueStatuses(
  ticketKeys: string[],
): Promise<Map<string, string>> {
  if (ticketKeys.length === 0) return new Map();
  const client = createJiraClient();
  const jql = `issue in (${ticketKeys.join(', ')})`;
  const result = await withRetry(() =>
    client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost({
      jql,
      fields: ['status'],
      maxResults: ticketKeys.length,
    }),
  );
  const map = new Map<string, string>();
  for (const issue of result.issues ?? []) {
    const key = issue.key ?? '';
    const statusName = (issue.fields?.status as { name?: string } | undefined)?.name ?? '';
    if (key) map.set(key, statusName);
  }
  return map;
}
```

### Status Color Mapping for `list`

```typescript
// Source: decisions D-04 — grey/yellow/green by status category name
function colorStatus(statusName: string): string {
  const lower = statusName.toLowerCase();
  if (lower === 'in progress' || lower.includes('progress')) {
    return chalk.yellow(statusName);
  }
  if (lower === 'done' || lower === 'closed' || lower === 'resolved') {
    return chalk.green(statusName);
  }
  // To Do, Backlog, Open, or empty — grey
  return chalk.gray(statusName || '');
}
```

### Ticket Key Extraction for `list`

```typescript
// Case-insensitive; uppercase result for JQL compatibility
function extractTicketKey(branch: string | null | undefined): string | null {
  if (!branch) return null;
  const match = branch.match(/([A-Za-z]+-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `GET /rest/api/3/search` (searchForIssuesUsingJql) | `POST /rest/api/3/search/jql` (searchForIssuesUsingJqlEnhancedSearchPost) | jira.js 5.3.1 marked old endpoint deprecated | Must use enhanced endpoint to be forward-compatible |
| `startAt` pagination | `nextPageToken` cursor | JIRA Cloud API change (confirmed in PITFALLS.md) | For Phase 3 batch fetch (< 50 keys), pagination is not needed; for Phase 4 assigned-issues list, use `nextPageToken` |

**Deprecated/outdated:**
- `searchForIssuesUsingJql()` GET method: deprecated in jira.js 5.3.1, endpoint being removed by Atlassian (use enhanced POST variant)
- `searchForIssuesUsingJqlPost()` POST method: also deprecated (same reason — use enhanced variant)

---

## Open Questions

1. **Exact error shape from jira.js on HTTP 429**
   - What we know: jira.js wraps HTTP errors in Error objects; the error message includes the HTTP status string
   - What's unclear: Whether jira.js 5.3.1 exposes a structured error class (e.g., `JiraError`) with a `statusCode` property
   - Recommendation: In Wave 1 implementation, log the full error object in tests and verify the 429 detection string. If a structured type exists, prefer it over string matching.

2. **JIRA status category names vs status names**
   - What we know: JIRA statuses have a `name` (e.g. "In Review") and a `statusCategory.name` (e.g. "In Progress"). D-04 specifies three categories (To Do, In Progress, Done).
   - What's unclear: Whether the status `name` directly equals "To Do" / "In Progress" / "Done" or whether we need `statusCategory.name` for reliable categorization.
   - Recommendation: Use `statusCategory.name` for the color mapping (request `fields: ['status']` — the status object includes `statusCategory` nested within it). Add `statusCategory` to the fields list: `fields: ['status']` — the status model includes `statusCategory.colorName` and `statusCategory.name` automatically.

---

## Environment Availability

All dependencies are already installed. No external services beyond JIRA Cloud (configured by user) are required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| jira.js | JIRA API calls | Yes | 5.3.1 | — |
| chalk | Status color output | Yes | 5.x | — |
| @clack/prompts | Spinners | Yes | 1.2.0 | — |
| zod | Optional response validation | Yes | 4.x | Skip — cast directly |
| Node.js | Runtime | Yes | 22 LTS | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) — `environment: 'node'` |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| JIRA-02 | `fetchIssue()` returns `{key, summary, statusName}` | unit | `npm test -- src/lib/jira.test.ts` | No — Wave 0 |
| JIRA-02 | `fetchIssue()` throws descriptive error when credentials missing | unit | `npm test -- src/lib/jira.test.ts` | No — Wave 0 |
| JIRA-04 | `fetchIssueStatuses([])` returns empty Map (guard) | unit | `npm test -- src/lib/jira.test.ts` | No — Wave 0 |
| JIRA-04 | `fetchIssueStatuses(['PROJ-1','PROJ-2'])` calls enhanced POST JQL | unit | `npm test -- src/lib/jira.test.ts` | No — Wave 0 |
| JIRA-05 | `withRetry()` retries on 429, throws after 3 attempts | unit | `npm test -- src/lib/jira.test.ts` | No — Wave 0 |
| WT-01 | `create PROJ-123 feature` calls `fetchIssue`, uses summary slug for branch | unit | `npm test -- src/commands/create.test.ts` | Yes — extend |
| WT-01 | `create my-manual-slug feature` preserves Phase 2 behavior (no JIRA call) | unit | `npm test -- src/commands/create.test.ts` | Yes — extend |
| WT-06 | `list` renders Status column with correct color for each status category | unit | `npm test -- src/commands/list.test.ts` | Yes — extend |
| WT-06 / D-06 | `list` shows `⚠ JIRA unreachable` when fetchIssueStatuses throws | unit | `npm test -- src/commands/list.test.ts` | Yes — extend |
| WT-06 / D-06 | `list` shows no status column when no worktree has ticket key | unit | `npm test -- src/commands/list.test.ts` | Yes — extend |

### Sampling Rate

- **Per task commit:** `npm test -- src/lib/jira.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/jira.test.ts` — covers JIRA-02, JIRA-04, JIRA-05 (all jira.ts unit tests)

*(Existing test infrastructure — `vitest.config.ts`, mock patterns — is fully established from Phases 1-2)*

---

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Enforcement |
|------------|--------|-------------|
| Use `Version3Client` from jira.js with Basic Auth | CLAUDE.md Stack Patterns | Wrapper must use `authentication: { basic: { email, apiToken } }` |
| Validate API responses with zod schemas | CLAUDE.md Stack Patterns | At minimum, cast `fields.summary` and `fields.status.name`; full zod schema optional |
| Do NOT use `simple-git` | CLAUDE.md What NOT to Use | Phase 3 has no new git operations; no risk |
| Use `@clack/prompts spinner()` around async ops | CLAUDE.md Stack Patterns | `create` must show spinner during JIRA fetch; `list` should show spinner before table renders |
| Token via keychain (`getToken()`) only | CLAUDE.md Constraints | JIRA client factory must call `getToken()` — never read token from config JSON |
| `--module nodenext` in tsconfig (ESM with `.js` extensions) | CLAUDE.md / Phase 1 decision | All imports in `jira.ts` must use `.js` extension on relative paths |
| `vi.mock()` pattern for constructor mocks | CLAUDE.md / Phase 1 decision | Tests for `jira.ts` must mock `Version3Client` using factory pattern, not class mock |

---

## Sources

### Primary (HIGH confidence — source code read directly)

- jira.js 5.3.1 installed at `node_modules/jira.js/src/version3/issues.ts` — confirmed `getIssue()` method signature (lines 684-717)
- jira.js 5.3.1 installed at `node_modules/jira.js/src/version3/issueSearch.ts` — confirmed `searchForIssuesUsingJqlEnhancedSearchPost()` (lines 437-460), confirmed deprecation warnings on `searchForIssuesUsingJql()` (lines 109, 132)
- jira.js 5.3.1 installed at `node_modules/jira.js/src/version3/client/version3Client.ts` — confirmed `client.issues` and `client.issueSearch` property names (lines 143-144)
- `src/lib/jira-validate.ts` — established `Version3Client` construction pattern in codebase
- `src/commands/create.ts`, `src/commands/list.ts` — existing command structure to extend
- `src/lib/slug.ts` — `toSlug()` available for JIRA summary slugification
- `src/lib/config.ts`, `src/lib/keychain.ts` — credential loading chain confirmed

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — JIRA rate limit mechanics, `currentUser()` JQL pattern, `nextPageToken` pagination — researched 2026-04-02
- `.planning/research/STACK.md` — jira.js 5.2.x recommendation (actual installed is 5.3.1, same major.minor API)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are installed and source-verified
- Architecture patterns: HIGH — patterns derived directly from installed source code and established codebase conventions
- jira.js API method names: HIGH — read directly from installed source files
- Retry/backoff error shape: MEDIUM — error message parsing is the reliable path, but exact error structure from jira.js on 429 is not formally documented

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable library, no anticipated API changes)
