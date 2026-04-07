# Phase 5: Simplify JIRA connection — OAuth or browser-based auth without manual API token - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Simplify the JIRA Cloud authentication setup by replacing the manual API token entry with a browser-guided flow. The CLI opens the Atlassian API token management page in the user's browser, so the user can create/copy a token and paste it back. This removes the need to know the token URL or navigate to it manually.

</domain>

<decisions>
## Implementation Decisions

### Auth Strategy
- **D-01:** Use browser-guided token copy approach — CLI opens the Atlassian API token page in the default browser, user creates/copies token there, pastes it back into the CLI prompt
- **D-02:** No OAuth 2.0 or Atlassian CLI login — API token with Basic Auth remains the auth mechanism, just with a smoother setup UX
- **D-03:** User always provides JIRA instance URL manually (no auto-detection from git remote)
- **D-04:** User always provides email manually (no auto-fill from git config)

### Setup UX Flow
- **D-05:** Auto-open browser to Atlassian API token page after collecting URL + email; if browser open fails (SSH, headless), fall back to printing the URL with instructions
- **D-06:** Validate credentials immediately after setup with a test JIRA API call (already existing behavior — preserve it)

### Backward Compatibility
- **D-07:** Clean break — users must re-run `treeji configure` after upgrade. No migration of existing config.
- **D-08:** Keep TREEJI_JIRA_TOKEN env var fallback for CI/headless environments

### Token Refresh
- **D-09:** On 401 auth failure, show clear message directing user to run `treeji configure` again. No inline re-auth flow.

### Claude's Discretion
- Browser-open library choice (e.g., `open` npm package or Node.js built-in)
- Exact wording of instructions shown when browser can't open
- Whether to show a spinner while waiting for user to paste token

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Auth Implementation
- `src/lib/config.ts` — Conf-based config storage (host, email)
- `src/lib/keychain.ts` — @napi-rs/keyring token storage + TREEJI_JIRA_TOKEN env var fallback
- `src/lib/jira.ts` — Version3Client creation with Basic Auth
- `src/commands/configure.ts` — Current configure command with interactive prompts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/keychain.ts`: setToken/getToken/deleteToken — keeps working, just needs to be called after browser-guided flow
- `src/lib/config.ts`: loadConfig/saveConfig — keeps working as-is
- `src/lib/jira.ts`: createJiraClient + validateJiraCredentials — reuse for post-setup validation
- `@clack/prompts` already in use for interactive CLI prompts

### Established Patterns
- Configure command uses @clack/prompts (intro, text, password, spinner, outro)
- Token stored via keychain.ts setToken(), never in config file
- Validation via validateJiraCredentials() in jira.ts

### Integration Points
- `src/commands/configure.ts` — main file to modify (add browser-open step between email collection and token paste)
- `src/lib/jira.ts` — add 401 detection with re-configure prompt in error handling

</code_context>

<specifics>
## Specific Ideas

- The Atlassian API token management URL is: `https://id.atlassian.com/manage-profile/security/api-tokens`
- This URL is the same for all Atlassian Cloud instances — it doesn't depend on the JIRA host URL
- The flow should be: ask URL → ask email → open browser to token page → ask user to paste token → validate → save

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-simplify-jira-connection-oauth-or-browser-based-auth-without-manual-api-token*
*Context gathered: 2026-04-07*
