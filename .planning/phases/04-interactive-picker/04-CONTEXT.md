# Phase 4: Interactive Picker - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

New `mafcli pick` command — interactive JIRA ticket selection from assigned open issues, then creates worktree from the selected ticket. Reuses JIRA client wrapper and create flow from Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Picker UX
- **D-01:** Each picker row shows: `PROJ-123  Oprava přihlašování  [In Progress]` — ticket key, summary, and colored status.
- **D-02:** After selecting a ticket, prompt for branch type (feature, bugfix, chore, etc.) via @clack/prompts `text()` or `select()`.
- **D-03:** Spinner shown while loading tickets from JIRA. @clack/prompts `spinner()` pattern from previous commands.
- **D-04:** Selection produces the same worktree outcome as `mafcli create <TICKET-ID> <type>` — reuse the existing JIRA create flow.

### JQL filtering
- **D-05:** Default JQL: `assignee = currentUser() AND statusCategory != Done` — only assigned open tickets.
- **D-06:** Results ordered by updated date (most recently updated first).

### Claude's Discretion
- How many tickets to display (all results or paginated/limited)
- What to show when no assigned tickets found (empty state message)
- Whether to add `--project` flag for filtering by JIRA project
- How to handle the `currentUser()` JQL with Basic Auth (may need `accountId` resolution)
- Error handling when JIRA is unreachable (cancel with message)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing codebase — reuse these
- `src/lib/jira.ts` — `fetchIssue()`, `fetchIssueStatuses()`, `createJiraClient()`, `withRetry()` — extend with `fetchAssignedIssues()`
- `src/commands/create.ts` — JIRA create path (lines 13-41) — reuse logic after ticket selection
- `src/lib/config.ts` — `loadConfig()` for credentials
- `src/lib/keychain.ts` — `getToken()` for API token

### Research
- `.planning/research/PITFALLS.md` — `currentUser()` JQL with Basic Auth, JIRA Cloud rate limits
- `.planning/research/FEATURES.md` — Interactive picker feature analysis

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/jira.ts`: JIRA client factory + retry wrapper — add `fetchAssignedIssues()` here
- `src/commands/create.ts`: JIRA create path — extract into shared function or call programmatically
- @clack/prompts `select()` — used in Phase 1 configure, proven pattern

### Established Patterns
- `registerXCommand(program)` for Commander.js commands
- `p.spinner()` around async JIRA calls
- `vi.mock()` for mocking lib modules in tests
- ESM with `.js` import extensions

### Integration Points
- `src/index.ts`: Wire `registerPickCommand(program)`
- `src/lib/jira.ts`: Add `fetchAssignedIssues()` function
- New: `src/commands/pick.ts`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — follow established patterns. The pick command is essentially a UI wrapper around existing JIRA + create functionality.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-interactive-picker*
*Context gathered: 2026-04-02*
