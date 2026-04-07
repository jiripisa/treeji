# Phase 5: Simplify JIRA connection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 05-simplify-jira-connection-oauth-or-browser-based-auth-without-manual-api-token
**Areas discussed:** Auth strategy, Setup UX flow, Backward compat, Token refresh

---

## Auth Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| OAuth 2.0 (3LO) | Full Atlassian OAuth flow — browser opens, user authorizes, CLI receives tokens automatically. Most seamless but requires registering an Atlassian app. | |
| Browser-guided token copy | CLI opens the Atlassian API token page in browser, user creates token there and pastes it back. Simpler than current flow but still manual. | ✓ |
| Atlassian CLI login style | Open browser to a login page, CLI polls for completion. Similar to `gh auth login`. | |

**User's choice:** Browser-guided token copy
**Notes:** Simplest approach — no OAuth app registration needed, keeps Basic Auth mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Always ask URL | User provides JIRA instance URL manually | ✓ |
| Auto-detect + confirm | Try to detect from git config/remote | |
| You decide | Claude's discretion | |

**User's choice:** Always ask URL

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-fill from git | Pre-fill email from `git config user.email` | |
| Always ask | User types email manually | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Always ask

---

## Setup UX Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-open browser | CLI automatically opens the Atlassian API token page | |
| Show URL + instructions | CLI prints the URL, user opens browser manually | |
| Auto-open + fallback | Try to open browser; if fails, fall back to printing URL | ✓ |

**User's choice:** Auto-open + fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, validate immediately | Make a test API call right after token is entered | ✓ |
| Skip validation | Trust the input, validate on first real command | |
| You decide | Claude's discretion | |

**User's choice:** Yes, validate immediately (already existing behavior)

---

## Backward Compat

| Option | Description | Selected |
|--------|-------------|----------|
| Seamless migration | Existing config continues working | |
| One-time migration | Migrate on first run after upgrade | |
| Clean break | Users must re-run `treeji configure` | ✓ |

**User's choice:** Clean break

| Option | Description | Selected |
|--------|-------------|----------|
| Keep env var fallback | TREEJI_JIRA_TOKEN still works as override | ✓ |
| Remove env var | Only keychain | |
| You decide | Claude's discretion | |

**User's choice:** Keep env var fallback

---

## Token Refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt to re-configure | On 401, show message: run treeji configure | ✓ |
| Inline re-auth | On 401, immediately start configure flow | |
| You decide | Claude's discretion | |

**User's choice:** Prompt to re-configure

---

## Claude's Discretion

- Browser-open library choice
- Exact wording of fallback instructions
- Whether to show spinner while waiting for token paste

## Deferred Ideas

None
