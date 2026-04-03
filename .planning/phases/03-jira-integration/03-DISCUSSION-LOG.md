# Phase 3: JIRA Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 03-jira-integration
**Areas discussed:** Create s JIRA ID, List + ticket status, JIRA client wrapper

---

## Create s JIRA ID

### Q1: How to detect JIRA ticket ID vs manual slug?

| Option | Description | Selected |
|--------|-------------|----------|
| Regex detection | If slug matches `[A-Z]+-\d+`, treat as JIRA ID and fetch name | ✓ |
| Separate command | New `mafcli jira-create`, keep original create unchanged | |
| You decide | Claude's discretion | |

**User's choice:** Regex detection — auto-detect JIRA ID format

### Q2: Branch/slug format from JIRA ticket?

| Option | Description | Selected |
|--------|-------------|----------|
| PROJ-123-oprava-prihlasovani | Ticket ID prefix + slugified name — guarantees uniqueness | ✓ |
| oprava-prihlasovani-uzivatele | Just slugified name — cleaner but collision risk | |
| You decide | Claude's discretion | |

**User's choice:** Ticket ID as prefix

---

## List + Ticket Status

### Q3: How to display JIRA status in list?

| Option | Description | Selected |
|--------|-------------|----------|
| New colored column | Status column: To Do (grey), In Progress (yellow), Done (green) | ✓ |
| Inline after branch | Status in brackets after branch name | |
| You decide | Claude's discretion | |

**User's choice:** New colored column

### Q4: Fallback when JIRA unreachable?

| Option | Description | Selected |
|--------|-------------|----------|
| Empty column | Status stays empty, no error | |
| Silent marker | Shows `—` or `offline` in grey | |
| Warning at end | Empty column + note below table `⚠ JIRA unreachable` | ✓ |

**User's choice:** Warning note below table

---

## JIRA Client Wrapper

**User's choice:** You decide — Claude has full discretion on retry, backoff, shared client, rate limiting design.

## Deferred Ideas

None
