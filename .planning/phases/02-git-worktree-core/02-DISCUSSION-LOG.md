# Phase 2: Git Worktree Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 02-git-worktree-core
**Areas discussed:** List output format, Shell wrapper design, Create command (offline), Remove safety

---

## List Output Format

### Q1: Output format for `mafcli list`?

| Option | Description | Selected |
|--------|-------------|----------|
| Tabulka s barvami | Aligned columns, colors for dirty/clean | ✓ |
| Kompaktní řádky | Each worktree on one line, key info inline | |
| You decide | Claude's discretion | |

**User's choice:** Colored table with aligned columns

### Q2: What info to display in list?

| Option | Description | Selected |
|--------|-------------|----------|
| Branch + dirty + ahead/behind | Branch name, dirty/clean, commit counts | |
| + path | Above + absolute path | |
| + relative age | All above + last commit age | ✓ |

**User's choice:** Full info including relative age of last commit

---

## Shell Wrapper Design

### Q3: How should `mafcli setup` work?

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic append | Auto-add to .zshrc | |
| Show and let copy | Print wrapper, user adds manually | ✓ |
| Both | Show + ask if auto-append | |

**User's choice:** Print wrapper function, user copies to .zshrc

### Q4: Wrapper function name?

| Option | Description | Selected |
|--------|-------------|----------|
| mafcd | `mafcd PROJ-123` — clearly separate from mafcli | ✓ |
| mafcli cd | Subcommand — won't work (subprocess can't cd) | |
| You decide | Claude's discretion | |

**User's choice:** mafcd

---

## Create Command (Offline)

### Q5: How should create work without JIRA?

| Option | Description | Selected |
|--------|-------------|----------|
| create <slug> <type> | Manual slug and type input | ✓ |
| Skip create in Phase 2 | Create only with JIRA in Phase 3 | |
| You decide | Claude's discretion | |

**User's choice:** `mafcli create <slug> <type>` with manual input

---

## Remove Safety

### Q6: How to protect against accidental deletion?

| Option | Description | Selected |
|--------|-------------|----------|
| Warn dirty + --force | Warning on dirty worktree, requires --force | ✓ |
| Always confirm | Always ask "Are you sure?" | |
| You decide | Claude's discretion | |

**User's choice:** Warn on dirty + require --force, clean deletes immediately

## Claude's Discretion

- Table formatting library choice
- Git porcelain command selection
- Slug validation rules
- Switch/mafcd sentinel output pattern
- Test strategy for git operations

## Deferred Ideas

None
