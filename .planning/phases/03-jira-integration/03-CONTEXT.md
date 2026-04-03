# Phase 3: JIRA Integration - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire JIRA Cloud API into the existing create and list commands. `create` accepts a JIRA ticket ID and auto-fetches the name. `list` shows JIRA ticket status in a new column. Includes a shared JIRA client wrapper with retry/backoff. No new commands — extends existing ones.

</domain>

<decisions>
## Implementation Decisions

### Create with JIRA ID
- **D-01:** `create` auto-detects JIRA ticket ID vs manual slug using regex `[A-Z]+-\d+`. If the first argument matches, treat as JIRA ticket — fetch summary from API. If not, treat as manual slug (existing Phase 2 behavior preserved).
- **D-02:** Branch/slug from JIRA ticket uses format `{TICKET-KEY}-{slugified-summary}`, e.g. `PROJ-123-oprava-prihlasovani`. Ticket ID prefix guarantees uniqueness.
- **D-03:** Full branch name becomes `{type}/{TICKET-KEY}-{slugified-summary}`, e.g. `feature/PROJ-123-oprava-prihlasovani`. Worktree directory: `../{TICKET-KEY}-{slugified-summary}/`.

### List + ticket status
- **D-04:** New color-coded "Status" column in list table. Colors: To Do (grey), In Progress (yellow), Done (green).
- **D-05:** JIRA status fetched via single batched JQL query for all worktrees that have ticket IDs in their branch names (not N+1 individual requests).
- **D-06:** When JIRA is unreachable or worktree has no ticket ID: status column stays empty, warning note `⚠ JIRA unreachable` printed below the table. No crash, no inline error per row.

### Claude's Discretion
- JIRA client wrapper design — shared `Version3Client` factory, retry with exponential backoff, rate limit handling
- How to extract ticket ID from branch name for `list` (regex parse from existing worktree branch names)
- Batch JQL query construction (e.g., `issue in (PROJ-123, PROJ-456)`)
- JIRA API timeout configuration
- How to handle `currentUser()` JQL for listing assigned tickets (JIRA-03 — needed for Phase 4 but the client wrapper should support it)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing codebase — extend these files
- `src/commands/create.ts` — Current `<slug> <type>` command, add JIRA detection branch
- `src/commands/list.ts` — Current 5-column table, add Status column + JIRA fetch
- `src/lib/jira-validate.ts` — Existing `Version3Client` usage pattern to follow
- `src/lib/config.ts` — `loadConfig()` for host/email
- `src/lib/keychain.ts` — `getToken()` for API token
- `src/lib/slug.ts` — `toSlug()` for slug generation from JIRA summary

### Research
- `.planning/research/STACK.md` — jira.js 5.2.x, Version3Client API
- `.planning/research/PITFALLS.md` — JIRA Cloud rate limits (3 independent systems), `currentUser()` JQL vs email, batch JQL strategy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/jira-validate.ts`: `Version3Client` instantiation pattern — reuse for JIRA client factory
- `src/lib/slug.ts`: `toSlug()` — use to slugify JIRA ticket summaries
- `src/lib/config.ts` + `src/lib/keychain.ts`: credential loading chain — JIRA client needs `loadConfig()` + `getToken()`

### Established Patterns
- Commander.js command registration via `registerXCommand(program)`
- @clack/prompts spinners for async operations
- `vi.mock()` pattern for mocking lib modules in tests
- ESM with `.js` import extensions

### Integration Points
- `src/commands/create.ts`: Modify action handler to detect JIRA ID and branch into JIRA fetch path
- `src/commands/list.ts`: Add JIRA status column after existing columns, inject JIRA fetch before table render
- New: `src/lib/jira.ts` — shared JIRA client wrapper (factory, fetch issue, fetch batch statuses, retry logic)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — follow established patterns from Phase 1/2 and jira.js documentation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-jira-integration*
*Context gathered: 2026-04-02*
