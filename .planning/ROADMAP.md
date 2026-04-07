# Roadmap: mafcli

## Overview

mafcli goes from nothing to a globally-installable TypeScript CLI that turns a JIRA ticket ID into a ready-to-use git worktree in one command. The build sequence is dependency-driven: secure credential storage first (everything needs it), then git worktree operations (testable offline), then JIRA integration wired into the worktree commands, then the interactive ticket picker layered on top.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Scaffold & Config** - TypeScript project setup, secure credential storage, and `mafcli configure`
- [ ] **Phase 2: Git Worktree Core** - Create, list, remove, and switch worktrees — no JIRA dependency
- [x] **Phase 3: JIRA Integration** - Wire JIRA API into create and list commands, add ticket status to list view (completed 2026-04-02)
- [x] **Phase 4: Interactive Picker** - `mafcli pick` command — select from assigned JIRA tickets to create worktree (completed 2026-04-02)

## Phase Details

### Phase 1: Scaffold & Config
**Goal**: Developer has a working project build pipeline and can configure JIRA credentials securely
**Depends on**: Nothing (first phase)
**Requirements**: JIRA-01, CLI-02, CLI-06
**Success Criteria** (what must be TRUE):
  1. `mafcli configure` stores JIRA URL, email, and API token — token lands in OS keychain (not config file)
  2. `MAFCLI_JIRA_TOKEN` env var works as fallback when keychain is unavailable
  3. `mafcli` is installable globally via `npm install -g mafcli` and produces a working binary
  4. `tsx` runs the project locally and `tsup` produces a valid CLI build with correct shebang
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold: package.json, tsconfig, tsup, vitest, entry point, shared types, test stubs
- [x] 01-02-PLAN.md — Configure command: keychain.ts, config.ts, jira-validate.ts, configure.ts, all tests green

### Phase 2: Git Worktree Core
**Goal**: User can create, list, remove, and navigate between worktrees using manual input (no JIRA calls)
**Depends on**: Phase 1
**Requirements**: WT-02, WT-03, WT-04, CLI-01, CLI-03, CLI-04, CLI-05
**Success Criteria** (what must be TRUE):
  1. `mafcli list` shows all worktrees with branch name, dirty/clean indicator, and ahead/behind remote count
  2. `mafcli remove <worktree>` deletes the directory, removes the branch, and runs `git worktree prune` — warns if working tree is dirty
  3. Shell wrapper installed via `mafcli setup` enables `mafcd <worktree>` to change directory in the parent shell
  4. Branch slug generation correctly handles Czech diacritics, emoji, and special characters (using slugify)
  5. Worktree directories are created alongside the main repo as `../{TICKET-slug}/`
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Foundation libs: WorktreeInfo type, git adapter (git.ts), slug generator (slug.ts) with unit tests
- [x] 02-02-PLAN.md — Create command: mafcli create <slug> <type> with slug sanitization and git-root path resolution
- [x] 02-03-PLAN.md — List command: mafcli list with colored table (branch, dirty/clean, ahead/behind, age, path)
- [x] 02-04-PLAN.md — Switch + Remove + Setup commands: sentinel output protocol, dirty-check guard, mafcd shell wrapper
- [x] 02-05-PLAN.md — Wire all commands into src/index.ts; full test suite + build smoke test

### Phase 3: JIRA Integration
**Goal**: User can create a worktree from a JIRA ticket ID (auto-fetched name and status) and see live JIRA ticket status in the list view
**Depends on**: Phase 2
**Requirements**: WT-01, WT-06, JIRA-02, JIRA-03, JIRA-04, JIRA-05
**Success Criteria** (what must be TRUE):
  1. `mafcli create PROJ-123 feature` fetches the ticket summary from JIRA, generates the branch name, and creates the worktree — no manual name input needed
  2. `mafcli list` shows JIRA ticket status (To Do / In Progress / Done) alongside each worktree, using a single batched JQL request (not one per worktree)
  3. JIRA API rate limit responses trigger retry with exponential backoff — the command completes rather than crashing
  4. `mafcli list` degrades gracefully when JIRA is unreachable — shows worktrees without ticket status rather than failing
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — JIRA client wrapper: src/lib/jira.ts with fetchIssue, fetchIssueStatuses, withRetry; full unit tests
- [x] 03-02-PLAN.md — Extend create command: JIRA ID auto-detection, branch slug from ticket summary
- [x] 03-03-PLAN.md — Extend list command: batched JIRA status column with graceful degradation

### Phase 4: Interactive Picker
**Goal**: User can browse their assigned JIRA tickets interactively and create a worktree from the selection in one step
**Depends on**: Phase 3
**Requirements**: WT-05
**Success Criteria** (what must be TRUE):
  1. `mafcli pick` displays a list of JIRA tickets assigned to the current user, prompts for branch type, and creates the worktree on selection
  2. Spinner feedback is shown while JIRA tickets are loading — the terminal does not appear frozen
  3. Selecting a ticket in `pick` produces the same worktree outcome as `mafcli create <TICKET-ID> <type>`
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — JIRA lib extension: fetchAssignedIssues() in jira.ts + unit tests; export colorStatus from list.ts
- [x] 04-02-PLAN.md — pick command: registerPickCommand, pick.test.ts (all WT-05 behaviors), wire into index.ts

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold & Config | 0/2 | Planning done | - |
| 2. Git Worktree Core | 4/5 | In Progress|  |
| 3. JIRA Integration | 3/3 | Complete   | 2026-04-02 |
| 4. Interactive Picker | 2/2 | Complete   | 2026-04-02 |

### Phase 04.1: Status dashboard — unified view of worktrees, branches, and JIRA tickets (INSERTED)

**Goal:** User can run `treeji status` and see a unified, grouped dashboard of all worktrees, local branches, and JIRA tickets — classified by their connection state and rendered in compact or full-table format
**Requirements**: TBD
**Depends on:** Phase 4
**Plans:** 2/2 plans complete

Plans:
- [x] 04.1-01-PLAN.md — Foundation: gitListBranches() in git.ts + fetchAssignedIssues includeAll param in jira.ts
- [x] 04.1-02-PLAN.md — Status command: status.ts orchestration, classify, render, register in index.ts

### Phase 5: Simplify JIRA connection — OAuth or browser-based auth without manual API token

**Goal:** User runs `treeji configure` and the browser opens to the Atlassian API token page automatically — no need to know or navigate to the token URL manually. Auth failures show clear re-configure guidance.
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Depends on:** Phase 4
**Plans:** 1 plan

Plans:
- [x] 05-01-PLAN.md — Browser-guided token setup in configure command + 401 detection in JIRA client
