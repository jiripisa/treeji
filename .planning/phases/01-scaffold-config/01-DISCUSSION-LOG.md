# Phase 1: Scaffold & Config - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 01-scaffold-config
**Areas discussed:** Configure flow

---

## Configure Flow

### Q1: How should `mafcli configure` work?

| Option | Description | Selected |
|--------|-------------|----------|
| Interactive prompts | CLI asks step by step: URL? Email? Token? — with validation | |
| Flags on command line | mafcli configure --url X --email Y --token Z — all at once | |
| Both | Without flags = interactive, with flags = non-interactive (useful for scripting) | ✓ |

**User's choice:** Both — interactive by default, flags for non-interactive/scripting use
**Notes:** None

### Q2: What happens when config already exists?

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite all | Simply overwrite old values with new ones | |
| Show current + ask | Display what's set, ask only about what to change | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Show current values, ask only about what user wants to change
**Notes:** None

### Q3: Should `configure` validate JIRA connection?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, test connection | After entering credentials, call JIRA API to confirm it works | ✓ |
| No, just save | Store credentials without verification — faster | |
| You decide | Claude's discretion | |

**User's choice:** Yes — validate by calling JIRA API after saving
**Notes:** None

### Q4: What should the output look like after successful config?

| Option | Description | Selected |
|--------|-------------|----------|
| Brief — just confirmation | "✓ Connected to JIRA (jira.company.com) as user@email.com" | |
| Detailed — settings overview | Table with URL, email, token status, connection test result | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Detailed overview table
**Notes:** None

## Claude's Discretion

- Credential storage implementation (keytar vs @napi-rs/keyring)
- Config file location (XDG vs ~/.mafcli/)
- Project structure (src/ layout)
- ESM vs CJS
- Prompt library choice
- tsup configuration

## Deferred Ideas

None — discussion stayed within phase scope
