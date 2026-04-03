# Phase 4: Interactive Picker - Research

**Researched:** 2026-04-02
**Domain:** @clack/prompts interactive select, JIRA JQL search, TypeScript command composition
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Each picker row shows: `PROJ-123  Oprava přihlašování  [In Progress]` — ticket key, summary, and colored status.
- **D-02:** After selecting a ticket, prompt for branch type (feature, bugfix, chore, etc.) via @clack/prompts `text()` or `select()`.
- **D-03:** Spinner shown while loading tickets from JIRA. @clack/prompts `spinner()` pattern from previous commands.
- **D-04:** Selection produces the same worktree outcome as `mafcli create <TICKET-ID> <type>` — reuse the existing JIRA create flow.
- **D-05:** Default JQL: `assignee = currentUser() AND statusCategory != Done` — only assigned open tickets.
- **D-06:** Results ordered by updated date (most recently updated first).

### Claude's Discretion
- How many tickets to display (all results or paginated/limited)
- What to show when no assigned tickets found (empty state message)
- Whether to add `--project` flag for filtering by JIRA project
- How to handle the `currentUser()` JQL with Basic Auth (may need `accountId` resolution)
- Error handling when JIRA is unreachable (cancel with message)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WT-05 | User can interactively pick a JIRA ticket from their assigned issues and create a worktree from it | `fetchAssignedIssues()` + `p.select()` + reuse of create JIRA path in `create.ts` lines 15-41 |
</phase_requirements>

## Summary

Phase 4 implements `mafcli pick` — a single new command plus one new function in `src/lib/jira.ts`. The command fetches assigned open tickets via JIRA JQL, presents them in an interactive `@clack/prompts select()` list, prompts for a branch type, then reuses the exact same worktree creation path already proven in `create.ts`. No new dependencies are needed; every library required is already installed.

The key technical concerns are: (1) correctly building `fetchAssignedIssues()` using `searchForIssuesUsingJqlEnhancedSearchPost` (the POST variant, matching the pattern established in Phase 3), (2) constructing the JQL with `currentUser()` which works correctly with Basic Auth API tokens, and (3) deciding a sensible default page limit for display.

`@clack/prompts select()` accepts `{ value, label, hint? }` option objects where `value` can be any non-primitive type (the ticket data itself), which means the selected issue object is returned directly — no secondary lookup needed after selection. This is the cleanest design for this phase.

**Primary recommendation:** Implement `fetchAssignedIssues()` in `src/lib/jira.ts` using the established `withRetry` wrapper and `searchForIssuesUsingJqlEnhancedSearchPost`, then build `src/commands/pick.ts` following the exact same `registerXCommand(program)` + `p.spinner()` + `p.select()` pattern used in `configure.ts` and `create.ts`.

## Standard Stack

### Core (all already installed — zero new dependencies)

| Library | Installed Version | Purpose in this Phase | Why Standard |
|---------|------------------|----------------------|--------------|
| @clack/prompts | ^1.2.0 | `select()` for ticket list, `text()` for branch type, `spinner()` for loading | Already used in configure, create |
| jira.js | ^5.3.1 | `searchForIssuesUsingJqlEnhancedSearchPost` for JQL search | Already used in jira.ts |
| chalk | ^5.6.2 | Color ticket status in `label` strings | Already used in list.ts |
| commander | ^14.0.3 | `registerPickCommand(program)` registration | Already used in index.ts |

### No New Installs Required

Zero new `npm install` calls needed for this phase.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── commands/
│   ├── pick.ts          # NEW: registerPickCommand — the full pick flow
│   └── pick.test.ts     # NEW: unit tests for pick command
├── lib/
│   └── jira.ts          # EXTEND: add fetchAssignedIssues() function
└── index.ts             # EXTEND: import and register registerPickCommand
```

### Pattern 1: fetchAssignedIssues() in jira.ts

**What:** New exported function in `src/lib/jira.ts` using the established `withRetry` + `createJiraClient()` pattern.

**When to use:** Called exactly once from the pick command, inside the spinner.

**JQL confirmed to work with Basic Auth API token:** `assignee = currentUser()` is resolved server-side against the authenticated user — no `accountId` pre-fetch needed. Verified pattern from Phase 3 research (PITFALLS.md Pitfall 7) and STATE.md decision log.

**statusCategory != Done** is the correct JQL operator for filtering — it matches all non-terminal statuses regardless of per-project status names.

**orderBy updated DESC** satisfies D-06 (most recently updated first).

**Example:**
```typescript
// Source: established jira.ts pattern + Phase 3 decisions
export async function fetchAssignedIssues(maxResults = 50): Promise<Array<{
  key: string;
  summary: string;
  statusName: string;
}>> {
  const client = createJiraClient();
  const jql = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';
  const result = await withRetry(() =>
    client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost({
      jql,
      fields: ['summary', 'status'],
      maxResults,
    }),
  );
  return (result.issues ?? []).map((issue) => ({
    key: issue.key ?? '',
    summary: (issue.fields?.summary as string | undefined) ?? '',
    statusName: (issue.fields?.status as { name?: string } | undefined)?.name ?? '',
  }));
}
```

### Pattern 2: @clack/prompts select() option shape

**What:** The `select()` function accepts `Option<Value>[]` where `Value` can be any type (including objects). For non-primitive values, `label` is required.

**Confirmed API (from node_modules type definition):**
```typescript
// Source: node_modules/@clack/prompts/dist/index.d.mts line 99
declare const select: <Value>(opts: SelectOptions<Value>) => Promise<Value | symbol>;

interface SelectOptions<Value> {
  message: string;
  options: Option<Value>[];    // label required when Value is non-primitive
  initialValue?: Value;
  maxItems?: number;
}
```

**Option shape for ticket data:**
```typescript
// The value IS the ticket object — no secondary lookup needed
const options = issues.map((issue) => ({
  value: issue,                            // full object returned on selection
  label: `${issue.key.padEnd(12)} ${issue.summary}`,
  hint: colorStatus(issue.statusName),     // status shown as hint on hover
}));
const selected = await p.select({ message: 'Select a ticket', options });
if (p.isCancel(selected)) { p.cancel('Cancelled.'); process.exit(0); }
// selected is now typed as { key, summary, statusName }
```

**D-01 row format:** `PROJ-123  Oprava přihlašování  [In Progress]` — implement via `label` (key + summary) and `hint` (colored status). The `hint` in @clack/prompts appears only on the currently highlighted row, which matches the "colored status" intent from D-01 without cluttering the list.

### Pattern 3: pick.ts command structure

**What:** Full pick command following `registerXCommand(program)` convention.

**Example:**
```typescript
// Source: established pattern from configure.ts and create.ts
import { Command } from 'commander';
import * as p from '@clack/prompts';
import { fetchAssignedIssues } from '../lib/jira.js';
import { fetchIssue } from '../lib/jira.js';
import { getGitRoot, gitWorktreeAdd } from '../lib/git.js';
import { toSlug } from '../lib/slug.js';
import chalk from 'chalk';
import path from 'node:path';

export function registerPickCommand(program: Command): void {
  program
    .command('pick')
    .description('Interactively pick an assigned JIRA ticket and create a worktree')
    .action(async () => {
      // 1. Spinner + fetch
      const spinner = p.spinner();
      spinner.start('Loading assigned tickets...');
      let issues: Array<{ key: string; summary: string; statusName: string }>;
      try {
        issues = await fetchAssignedIssues();
        spinner.stop(`Found ${issues.length} ticket(s)`);
      } catch (err) {
        spinner.stop('Failed to load tickets');
        p.cancel(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      // 2. Empty state
      if (issues.length === 0) {
        p.outro('No assigned open tickets found.');
        return;
      }

      // 3. Select ticket
      const options = issues.map((issue) => ({
        value: issue,
        label: `${issue.key.padEnd(12)} ${issue.summary}`,
        hint: colorStatus(issue.statusName),
      }));
      const selected = await p.select({ message: 'Select a ticket', options });
      if (p.isCancel(selected)) { p.cancel('Cancelled.'); process.exit(0); }

      // 4. Prompt for branch type (D-02)
      const typeResult = await p.text({
        message: 'Branch type',
        placeholder: 'feature',
        validate: (v) => (v && v.length > 0 ? undefined : 'Branch type cannot be empty'),
      });
      if (p.isCancel(typeResult)) { p.cancel('Cancelled.'); process.exit(0); }
      const type = typeResult as string;

      // 5. Create worktree — reuse create.ts JIRA path logic (D-04)
      // ... same as create.ts lines 17-38
    });
}
```

### Pattern 4: Reusing the create JIRA path (D-04)

**What:** D-04 requires `pick` to produce the same worktree outcome as `mafcli create <TICKET-ID> <type>`.

**Options (Claude's Discretion):**

Option A — Extract shared helper from `create.ts`:
```typescript
// src/lib/worktree-from-ticket.ts
export async function createWorktreeFromTicket(ticketKey: string, type: string): Promise<void>
// pick.ts and create.ts both import this
```

Option B — Inline the same logic in `pick.ts` (copy the JIRA block from create.ts lines 16-40).

**Recommendation:** Option B (inline) for this phase. The logic is ~20 lines, Phase 4 is the last phase, and extracting a shared helper adds a new file + test surface without adding value for a single-developer tool. If a Phase 5 were planned, extraction would be warranted. The planner should decide based on their preference — both are valid.

### Anti-Patterns to Avoid

- **Calling `fetchIssue()` a second time after selection:** The ticket data is already in the selected object from `fetchAssignedIssues()`. No second JIRA call is needed for summary/status — only use `fetchIssue()` again if you need the `issuetype` field (not required here).
- **Using `assignee = "user@email.com"` in JQL:** Removed from JIRA Cloud in 2019 (GDPR). Use `currentUser()`.
- **Using deprecated GET search:** Always use `searchForIssuesUsingJqlEnhancedSearchPost` (POST). The GET variant is deprecated and will be removed per Phase 3 decisions.
- **Passing `maxResults` > 100 without pagination:** JIRA Cloud caps `maxResults` at 100 per request. For a personal tool, 50 is a reasonable default — more than enough for typical backlogs.
- **p.select() with string values for non-primitive data:** When `Value` is an object, `label` is required (TypeScript enforces this). Do not use `value: issue.key` and then look up the issue from the array — pass the full object as `value`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive list UI | Custom readline prompt | `p.select()` from @clack/prompts | Already installed, handles keyboard navigation, cancel symbol, maxItems scrolling |
| Spinner during async fetch | Custom stdout animation | `p.spinner()` | Already used in 3 commands, consistent UX |
| JIRA API retry on 429 | Custom retry loop | `withRetry()` in jira.ts | Already implemented and tested |
| Status color | Custom chalk logic | Reuse `colorStatus()` from list.ts | Already implements the D-03/D-04 color convention |
| Slug generation | Custom regex | `toSlug()` from slug.ts | Already handles Czech diacritics, emoji, truncation |

**Key insight:** This phase is almost entirely composition of existing pieces. The planner should focus on wiring, not building.

## Common Pitfalls

### Pitfall 1: currentUser() JQL behavior with Basic Auth

**What goes wrong:** Developer assumes `currentUser()` might not work with API token Basic Auth and adds a pre-fetch of `/rest/api/3/myself` to resolve `accountId` first.

**Why it happens:** Atlassian docs describe two patterns. The `accountId` approach is documented for OAuth flows.

**How to avoid:** `currentUser()` is resolved server-side based on the authenticated principal. With Basic Auth (email + API token), the server knows exactly who the caller is. The PITFALLS.md Pitfall 7 and STATE.md confirm this. D-05 already locks the JQL to `currentUser()` — no pre-fetch needed.

**Warning signs:** Adding a `fetchCurrentUser()` call before `fetchAssignedIssues()`.

### Pitfall 2: p.isCancel() check after every prompt

**What goes wrong:** The `select()` and `text()` calls return `symbol` when the user presses Ctrl+C. Without `isCancel()` check, the next line treats the symbol as the expected value and TypeScript narrows to `never`, causing a runtime error.

**How to avoid:** Always check `if (p.isCancel(result)) { p.cancel('Cancelled.'); process.exit(0); }` immediately after every `await p.select()` and `await p.text()` call. This is established pattern in configure.ts.

**Warning signs:** Missing `isCancel` import, or `isCancel` checks only on some prompts.

### Pitfall 3: Empty ticket list not handled

**What goes wrong:** `issues.length === 0` falls through to `p.select({ options: [] })` which renders an empty list and may behave unexpectedly.

**How to avoid:** Check `if (issues.length === 0)` before calling `p.select()` and output a clear message. Use `p.outro()` rather than `p.cancel()` since an empty list is not an error.

**Warning signs:** No empty state check between fetching issues and rendering the selector.

### Pitfall 4: Confusing maxResults with display limit

**What goes wrong:** Developer sets `maxResults: 100` expecting all tickets when the user has 120 — the last 20 are silently dropped.

**How to avoid:** For a personal tool with typical backlogs of 5-30 active tickets, `maxResults: 50` is sufficient and conservative. Document in a comment that this is a soft cap. If the response `total` > `maxResults`, the user should filter with `--project` or JQL instead of paginating (pagination adds complexity not justified by v1 scope).

**Warning signs:** No `maxResults` cap, or `maxResults: 1000` (well above JIRA's 100-per-request limit).

### Pitfall 5: Hint vs label for status display

**What goes wrong:** Developer puts status in the `label` string (e.g., `"PROJ-123  My ticket  [In Progress]"`). This works but the colored status markup causes padding misalignment because chalk escape codes add invisible characters to the length.

**How to avoid:** Put the ticket key + summary in `label` (plain text, safe to pad), and put the colored status in `hint`. The `hint` field in @clack/prompts renders on a separate indicator position and does not affect label alignment. This exactly satisfies D-01.

## Code Examples

### fetchAssignedIssues() — complete implementation

```typescript
// Source: jira.ts established pattern + Phase 3 decisions
// Add after fetchIssueStatuses() in src/lib/jira.ts

export async function fetchAssignedIssues(maxResults = 50): Promise<Array<{
  key: string;
  summary: string;
  statusName: string;
}>> {
  const client = createJiraClient();
  const jql =
    'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';
  const result = await withRetry(() =>
    client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost({
      jql,
      fields: ['summary', 'status'],
      maxResults,
    }),
  );
  return (result.issues ?? []).map((issue) => ({
    key: issue.key ?? '',
    summary: (issue.fields?.summary as string | undefined) ?? '',
    statusName: (issue.fields?.status as { name?: string } | undefined)?.name ?? '',
  }));
}
```

### @clack/prompts select() with object values

```typescript
// Source: node_modules/@clack/prompts/dist/index.d.mts
// Value is non-primitive → label is required; hint is optional

const selected = await p.select({
  message: 'Select a ticket',
  options: issues.map((issue) => ({
    value: issue,                               // full object — label required
    label: `${issue.key.padEnd(12)} ${issue.summary}`,
    hint: colorStatus(issue.statusName),        // visible only on highlighted row
  })),
  maxItems: 10,                                 // scroll if > 10 tickets
});
if (p.isCancel(selected)) {
  p.cancel('Cancelled.');
  process.exit(0);
}
// TypeScript: selected is { key: string; summary: string; statusName: string }
```

### Reusing colorStatus from list.ts

```typescript
// colorStatus is currently unexported in list.ts — pick.ts should either:
// Option A: duplicate the function (2-3 lines, acceptable for phase 4)
// Option B: export it from list.ts and import in pick.ts

// The function itself (from list.ts):
function colorStatus(statusName: string): string {
  const lower = statusName.toLowerCase();
  if (lower === 'in progress' || lower.includes('progress')) return chalk.yellow(statusName);
  if (lower === 'done' || lower === 'closed' || lower === 'resolved') return chalk.green(statusName);
  return chalk.gray(statusName || '');
}
// Recommendation: export from list.ts to avoid duplication. One-line change: export function colorStatus(...)
```

### Test mock pattern for fetchAssignedIssues

```typescript
// Source: established pattern from create.test.ts and jira.test.ts
const mockFetchAssignedIssues = vi.fn();

vi.mock('../lib/jira.js', () => ({
  fetchAssignedIssues: (...args: unknown[]) => mockFetchAssignedIssues(...args),
  fetchIssue: (...args: unknown[]) => mockFetchIssue(...args),
}));

// p.select mock (non-interactive test environment):
const mockSelect = vi.fn();
vi.mock('@clack/prompts', () => ({
  spinner: vi.fn(() => ({ start: mockSpinnerStart, stop: mockSpinnerStop })),
  select: (...args: unknown[]) => mockSelect(...args),
  text: (...args: unknown[]) => mockText(...args),
  isCancel: vi.fn(() => false),
  cancel: (...args: unknown[]) => mockCancel(...args),
  outro: (...args: unknown[]) => mockOutro(...args),
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JQL `assignee = "user@email.com"` | `assignee = currentUser()` | JIRA Cloud April 2019 | Email in JQL returns empty results silently |
| JIRA GET /search | POST `searchForIssuesUsingJqlEnhancedSearchPost` | Deprecated by Atlassian | GET variant scheduled for removal — POST is the forward-compatible path |
| Inquirer.js for interactive prompts | @clack/prompts | 2023 (Inquirer v9 ESM migration) | @clack/prompts is already installed; Inquirer ESM migration broke plugins |

## Open Questions

1. **colorStatus export**
   - What we know: `colorStatus` is a module-private function in `list.ts`. Pick needs the same logic.
   - What's unclear: Export from list.ts vs duplicate in pick.ts — both compile correctly.
   - Recommendation: Export from list.ts (`export function colorStatus(...)`) to keep the canonical definition in one place. Add to jira.ts lib if it seems more appropriate to the planner.

2. **maxResults default value**
   - What we know: JIRA caps at 100 per request. Typical active backlogs are 5-30 tickets.
   - What's unclear: Whether to expose this as a `--limit` flag.
   - Recommendation: Default 50, no flag for v1 (Claude's Discretion). The `--project` filter idea from discretion items is a better UX investment than a raw limit flag.

3. **branch type input: `text()` vs `select()`**
   - What we know: D-02 says "via @clack/prompts `text()` or `select()`".
   - What's unclear: Whether to offer fixed choices (feature/bugfix/chore) or free text.
   - Recommendation: `text()` with placeholder `feature` — consistent with the manual `create` command where type is a free-form argument. A `select()` with hardcoded choices would diverge from the create UX.

## Environment Availability

Step 2.6: SKIPPED — this phase adds no new external dependencies. All required libraries are already installed in node_modules.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `vitest.config.ts` (node environment, no globals) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WT-05 | `pick` shows assigned tickets and creates worktree on selection | integration (mocked) | `npm test -- src/commands/pick.test.ts` | Wave 0 |
| WT-05 | `fetchAssignedIssues()` calls correct JQL with `currentUser()` and POST endpoint | unit | `npm test -- src/lib/jira.test.ts` | Exists (extend) |
| WT-05 | Spinner shown while loading | unit | `npm test -- src/commands/pick.test.ts` | Wave 0 |
| WT-05 | Empty state message when no tickets | unit | `npm test -- src/commands/pick.test.ts` | Wave 0 |
| WT-05 | Cancelled selection exits cleanly | unit | `npm test -- src/commands/pick.test.ts` | Wave 0 |
| WT-05 | JIRA error shows cancel message | unit | `npm test -- src/commands/pick.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (currently 89 tests) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/commands/pick.test.ts` — covers all WT-05 behaviors above
- [ ] `src/lib/jira.ts` extension tests — add `fetchAssignedIssues` describe block to existing `src/lib/jira.test.ts`

*(No framework install needed — vitest already configured. No new conftest — existing mock patterns apply.)*

## Sources

### Primary (HIGH confidence)
- `node_modules/@clack/prompts/dist/index.d.mts` — `select()` signature, `Option<Value>` type, `SelectOptions` interface (read directly from installed package)
- `src/lib/jira.ts` — existing `createJiraClient()`, `withRetry()`, `searchForIssuesUsingJqlEnhancedSearchPost` pattern (read directly)
- `src/commands/create.ts` — JIRA path lines 15-40, established `p.spinner()` + `p.isCancel()` patterns (read directly)
- `.planning/research/PITFALLS.md` — Pitfall 7: `currentUser()` vs email in JQL (project research artifact)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 3 decision: POST endpoint used, `currentUser()` confirmed (project history)
- `src/commands/configure.ts` — `p.isCancel()` pattern after every prompt (verified from source)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, types read directly from node_modules
- Architecture: HIGH — patterns are directly read from existing working code
- Pitfalls: HIGH — confirmed from project research artifacts and code inspection
- @clack/prompts select() API: HIGH — read from installed type definitions, not training data

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable stack, monthly refresh sufficient)
