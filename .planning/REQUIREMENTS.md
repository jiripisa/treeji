# Requirements: mafcli

**Defined:** 2026-04-02
**Core Value:** Rychlé vytvoření worktree z JIRA ticketu jedním příkazem — bez ručního kopírování názvů, zakládání branchí a navigace po souborovém systému.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Worktree Management

- [x] **WT-01**: User can create a worktree from a JIRA ticket ID — CLI fetches ticket name, creates branch (`{type}/{TICKET-slug}`) and worktree directory (`../{TICKET-slug}/`)
- [x] **WT-02**: User can list all worktrees with git status (dirty/clean, ahead/behind remote)
- [x] **WT-03**: User can switch (cd) into an existing worktree via shell wrapper function
- [x] **WT-04**: User can delete a worktree — removes directory, branch, and runs `git worktree prune`
- [x] **WT-05**: User can interactively pick a JIRA ticket from their assigned issues and create a worktree from it
- [x] **WT-06**: User can see JIRA ticket status (To Do, In Progress, Done) alongside each worktree in the list view

### JIRA Integration

- [x] **JIRA-01**: User can configure JIRA Cloud connection (instance URL, email, API token) via `mafcli configure`
- [x] **JIRA-02**: User can fetch ticket details by ID (summary, status, issue type)
- [x] **JIRA-03**: User can list their assigned JIRA tickets (via `currentUser()` JQL)
- [x] **JIRA-04**: JIRA ticket status is displayed in worktree list view with batch JQL query (not N+1 individual requests)
- [x] **JIRA-05**: JIRA API calls handle rate limits gracefully (retry with backoff)

### CLI Infrastructure

- [x] **CLI-01**: Shell wrapper function installable via `mafcli setup` — enables `cd` into worktrees from `switch` command
- [x] **CLI-02**: JIRA API token stored securely in OS keychain (macOS Keychain), with env var `MAFCLI_JIRA_TOKEN` as fallback
- [x] **CLI-03**: Branch naming follows `{type}/{TICKET-slug}` format, type entered manually by user at creation time
- [x] **CLI-04**: Worktree directories created alongside main repo as `../{TICKET-slug}/`
- [x] **CLI-05**: Slug generation handles Czech diacritics, emoji, and special characters correctly (using slugify library)
- [x] **CLI-06**: CLI installable globally via `npm install -g mafcli`

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Automation

- **AUTO-01**: Automatic cleanup of worktrees for merged/closed JIRA tickets
- **AUTO-02**: Automatic branch type detection from JIRA issue type (Bug → bugfix/, Story → feature/)

### Multi-project

- **MULTI-01**: Support for multiple JIRA projects in one config
- **MULTI-02**: Custom branch naming templates via config

## Out of Scope

| Feature | Reason |
|---------|--------|
| GUI / TUI interactive interface | CLI only — personal tool, simplicity over polish |
| JIRA Server / Data Center | Only JIRA Cloud — personal tool, one backend sufficient |
| OAuth 2.0 authentication | API token (Basic Auth) sufficient for personal use |
| Git operations beyond worktrees | Not a general git tool — focused on worktree workflow |
| PR creation / CI integration | Out of scope for worktree management tool |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WT-01 | Phase 3 | Complete |
| WT-02 | Phase 2 | Complete |
| WT-03 | Phase 2 | Complete |
| WT-04 | Phase 2 | Complete |
| WT-05 | Phase 4 | Complete |
| WT-06 | Phase 3 | Complete |
| JIRA-01 | Phase 1 | Complete |
| JIRA-02 | Phase 3 | Complete |
| JIRA-03 | Phase 3 | Complete |
| JIRA-04 | Phase 3 | Complete |
| JIRA-05 | Phase 3 | Complete |
| CLI-01 | Phase 2 | Complete |
| CLI-02 | Phase 1 | Complete |
| CLI-03 | Phase 2 | Complete |
| CLI-04 | Phase 2 | Complete |
| CLI-05 | Phase 2 | Complete |
| CLI-06 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation*
