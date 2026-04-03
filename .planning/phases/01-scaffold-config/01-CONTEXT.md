# Phase 1: Scaffold & Config - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Working project build pipeline (TypeScript + tsup + Commander.js) and secure JIRA credential storage. Delivers `mafcli configure` command and global npm installability. No git or JIRA data operations — those are Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Configure flow
- **D-01:** `mafcli configure` supports both interactive prompts (no flags) and non-interactive mode (--url, --email, --token flags). Without flags, prompts user step by step with validation.
- **D-02:** When config already exists and user runs `configure` again, show current values first and ask only about what they want to change (not overwrite everything).
- **D-03:** After saving credentials, validate connection by calling JIRA API (e.g., `/rest/api/3/myself`). Show success/failure clearly.
- **D-04:** On successful configuration, display detailed overview table: JIRA URL, email, token status (stored in keychain/env var), and connection test result.

### Claude's Discretion
- Credential storage implementation choice (keytar vs @napi-rs/keyring vs alternative) — pick what's most reliable on macOS
- Config file location for non-secret settings (XDG convention vs ~/.mafcli/)
- Project structure and src/ layout (commands/services/lib layering)
- ESM vs CJS module format
- Exact prompt library choice (@clack/prompts vs inquirer)
- tsup configuration details
- package.json bin field setup

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in decisions above and in research files:

### Stack decisions
- `.planning/research/STACK.md` — Technology recommendations (Commander.js, jira.js, execa, conf, tsup)
- `.planning/research/ARCHITECTURE.md` — Component boundaries, commands/services/lib layering

### Security
- `.planning/research/PITFALLS.md` — Credential storage pitfalls, keychain considerations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project

### Established Patterns
- None — this phase establishes them

### Integration Points
- None — first phase

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Research recommended Commander.js + jira.js + tsup stack.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-scaffold-config*
*Context gathered: 2026-04-02*
