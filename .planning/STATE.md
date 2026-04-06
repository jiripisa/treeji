---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed quick task 260406-b1q: remove gitRoot CWD fix
last_updated: "2026-04-06T06:02:00Z"
last_activity: 2026-04-06
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-02)

**Core value:** Rychlé vytvoření worktree z JIRA ticketu jedním příkazem — bez ručního kopírování názvů, zakládání branchí a navigace po souborovém systému.
**Current focus:** Phase 04 — interactive-picker

## Current Position

Phase: 04
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-04-03 - Completed quick task 260403-c5y: switch command — interactive worktree picker

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-scaffold-config P01 | 4min | 2 tasks | 13 files |
| Phase 01-scaffold-config P02 | 5 | 2 tasks | 10 files |
| Phase 02-git-worktree-core P01 | 4min | 3 tasks | 7 files |
| Phase 02-git-worktree-core P03 | 3min | 1 tasks | 2 files |
| Phase 02-git-worktree-core P02 | 2min | 2 tasks | 2 files |
| Phase 02-git-worktree-core P04 | 4min | 2 tasks | 6 files |
| Phase 02-git-worktree-core P05 | 5min | 2 tasks | 3 files |
| Phase 03-jira-integration P01 | 3min | 2 tasks | 2 files |
| Phase 03-jira-integration P02 | 2min | 1 tasks | 2 files |
| Phase 03-jira-integration P03 | 3min | 1 tasks | 2 files |
| Phase 04-interactive-picker P01 | 2min | 2 tasks | 3 files |
| Phase 04-interactive-picker P02 | 2min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Use OS keychain (keytar or @napi-rs/keyring) for JIRA token — must be decided before first `config set` implementation
- Phase 2: Shell `cd` sentinel protocol (`__MAFCLI_CD__:/path`) must be established before `switch` command interface is published — retrofitting is a breaking change
- Phase 2: Slug generation must be unit-tested against Czech diacritics and emoji before any branch is created
- [Phase 01-scaffold-config]: Use @napi-rs/keyring over keytar — prebuilt NAPI binaries, no node-gyp, Sep 2025 release
- [Phase 01-scaffold-config]: module:nodenext in tsconfig — requires explicit .js extensions on relative imports
- [Phase 01-scaffold-config]: JiraConfig interface excludes token field — token only in keychain or MAFCLI_JIRA_TOKEN env var
- [Phase 01-scaffold-config]: Class-based vi.mock() required for constructor mocks — arrow function implementations cannot be called with new in vitest
- [Phase 01-scaffold-config]: process.exit mock must throw to prevent cancel-path continuation — no-op mock causes downstream TypeError in configure command tests
- [Phase 02-git-worktree-core]: slugify strict:true + trailing-hyphen trim handles all-special input returning empty string — correct behavior for branch name generation
- [Phase 02-git-worktree-core]: gitAheadBehind catch-all pattern: any execa error returns {ahead:0,behind:0} — branches without upstream are expected in worktree workflow
- [Phase 02-git-worktree-core]: parseWorktreeList splits on /\n\n+/ regex for robustness against multiple blank lines in git porcelain output
- [Phase 02-git-worktree-core]: No cli-table3 dependency — chalk + padEnd is sufficient for 5-column worktree table (D-03)
- [Phase 02-git-worktree-core]: mafcli list gathers per-worktree git status in parallel via Promise.all for performance
- [Phase 02-git-worktree-core]: create command: type arg used as-is in branch name — no sanitization (user's responsibility per CLI-03)
- [Phase 02-git-worktree-core]: process.exit mock requires Number() cast for TypeScript strict mode compatibility (string | number union)
- [Phase 02-git-worktree-core]: switch command: only stdout output is __MAFCLI_CD__:path sentinel — zero console.log or @clack/prompts in switch.ts
- [Phase 02-git-worktree-core]: remove command: delete order gitWorktreeRemove before gitDeleteBranch then gitWorktreePrune; -D flag with --force
- [Phase 03-jira-integration]: searchForIssuesUsingJqlEnhancedSearchPost (POST) used over deprecated GET variant — forward-compatible with Atlassian endpoint removal
- [Phase 03-jira-integration]: withRetry detects 429 via error message string — jira.js does not expose structured statusCode on errors
- [Phase 03-jira-integration]: Version3Client mock cleared per-describe-block via vi.mocked().mockClear() — prevents constructor call count leaking across test suites
- [Phase 03-jira-integration]: JIRA detection uses /^[A-Z]+-\d+$/ regex — ticket key never sanitized through toSlug(), only summary is slugified to preserve PROJ-123 intact in branch name
- [Phase 03-jira-integration]: Empty slug fallback: summarySlug ? `${key}-${summarySlug}` : key — falls back to ticket key alone when summary contains only special chars
- [Phase 03-jira-integration]: colorStatus maps 'in progress'/'progress' to yellow, 'done'/'closed'/'resolved' to green, all others to gray — per D-04
- [Phase 03-jira-integration]: fetchIssueStatuses called only when ticketKeys.length > 0 — empty array guard prevents unnecessary API calls — per D-05 and Pitfall 5
- [Phase 03-jira-integration]: JIRA warning printed after table rows as single ⚠ line — per D-06
- [Phase 04-interactive-picker]: fetchAssignedIssues JQL: 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC' — per D-05, D-06
- [Phase 04-interactive-picker]: colorStatus exported from list.ts (not duplicated in pick.ts) — single source of truth for status coloring
- [Phase 04-interactive-picker]: No second fetchIssue() call in pick — selected issue object already has key, summary, statusName
- [Phase 04-interactive-picker]: p.outro for empty state, p.cancel for errors — semantically correct per @clack/prompts design

### Pending Todos

None yet.

### Blockers/Concerns

- **Keytar vs @napi-rs/keyring:** keytar requires native compilation; @napi-rs/keyring uses prebuilt binaries. Evaluate in Phase 1 to avoid fragile npm install on clean systems.
- **JIRA pagination cursor:** Research notes `nextPageToken` (not `startAt`) for `/search/jql` — validate against Atlassian REST API docs before Phase 3 implementation.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260403-c5y | switch command — interactive worktree picker | 2026-04-03 | cc04ae3 | [260403-c5y-switch-command-interactive-worktree-pick](./quick/260403-c5y-switch-command-interactive-worktree-pick/) |
| 260403-csm | replace mafcd with mafcli() shell function | 2026-04-03 | 04254d2 | [260403-csm-replace-mafcd-with-mafcli-switch-shell-w](./quick/260403-csm-replace-mafcd-with-mafcli-switch-shell-w/) |
| 260403-dvk | UX improvements batch across 7 command files | 2026-04-03 | 4ad12ba | [260403-dvk-ux-improvements-batch](./quick/260403-dvk-ux-improvements-batch/) |
| 260403-nip | switch: require shell wrapper — guard + remove TTY hint | 2026-04-03 | f5d173a | [260403-nip-switch-require-shell-wrapper](./quick/260403-nip-switch-require-shell-wrapper/) |
| 260403-nwk | list: restructure columns to 7-column layout (name, branch, ticket, jira status) | 2026-04-03 | ce15da8 | [260403-nwk-list-restructure-columns](./quick/260403-nwk-list-restructure-columns/) |
| 260403-o4j | list: merge remote column into status column — 6-column layout | 2026-04-03 | d087f93 | [260403-o4j-merge-remote-into-status-column](./quick/260403-o4j-merge-remote-into-status-column/) |
| 260403-ocn | list: merge jira columns into single jira column with OSC 8 hyperlinks — 5-column layout | 2026-04-03 | 56e6551 | [260403-ocn-merge-jira-columns-with-hyperlink](./quick/260403-ocn-merge-jira-columns-with-hyperlink/) |
| 260406-8q2 | remove: interactive safe-picker (clean + branch-on-remote) | 2026-04-06 | be7b93a | [260406-8q2-remove-interactive-safe-picker](./quick/260406-8q2-remove-interactive-safe-picker/) |
| 260406-97m | remove: merge-check in interactive picker | 2026-04-06 | 68a908e | [260406-97m-remove-picker-merge-check](./quick/260406-97m-remove-picker-merge-check/) |
| 260406-9ea | remove: show blocked worktrees before interactive picker | 2026-04-06 | b2c00ab | [260406-9ea-remove-show-blocked-worktrees](./quick/260406-9ea-remove-show-blocked-worktrees/) |
| 260406-9nj | remove: empty local branch safe + blocked shows commit list | 2026-04-06 | 45f501d | [260406-9nj-remove-empty-local-branch-safe](./quick/260406-9nj-remove-empty-local-branch-safe/) |
| 260406-b1q | remove: gitRoot CWD fix — thread -C flag through remove flow | 2026-04-06 | 6530436 | [260406-b1q-remove-gitroot-cwd-fix](./quick/260406-b1q-remove-gitroot-cwd-fix/) |

## Session Continuity

Last session: 2026-04-06T05:01:15Z
Stopped at: Completed quick task 260406-9nj: remove — empty local branch safe + blocked shows commit list
Resume file: None
