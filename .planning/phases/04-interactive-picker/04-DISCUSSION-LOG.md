# Phase 4: Interactive Picker - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-02
**Phase:** 04-interactive-picker
**Areas discussed:** Picker UX, JQL filtrování

---

## Picker UX

### Q1: Picker row format?

| Option | Description | Selected |
|--------|-------------|----------|
| KEY + summary + status | `PROJ-123  Oprava přihlašování  [In Progress]` | ✓ |
| KEY + summary | Without status | |
| You decide | Claude's discretion | |

### Q2: How to prompt for branch type?

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt after selection | First pick ticket, then ask for type | ✓ |
| Flag --type | `mafcli pick --type feature` — skip prompt | |
| Both | Default prompt, --type skips it | |

---

## JQL Filtering

### Q3: Which tickets to show?

| Option | Description | Selected |
|--------|-------------|----------|
| Assigned + open | `assignee = currentUser() AND statusCategory != Done` | ✓ |
| Assigned all | Including closed | |
| You decide | Claude's discretion | |

## Claude's Discretion

- Ticket count limits, empty state, --project flag, currentUser() handling, error UX

## Deferred Ideas

None
