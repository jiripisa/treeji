# Feature Research

**Domain:** Git worktree management CLI with JIRA Cloud integration
**Researched:** 2026-04-02
**Confidence:** HIGH (ecosystem well-established, multiple tools to analyze)

## Feature Landscape

### Table Stakes (Users Expect These)

Features a worktree management CLI must have. Missing these makes the tool feel like a thin wrapper around `git worktree` with no added value.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create worktree from ticket ID | Core value prop — type ticket, get worktree | MEDIUM | JIRA REST API v3, branch naming slug generation |
| List all worktrees with status | You need to see what you have before switching | LOW | `git worktree list` + dirty/ahead/behind detection |
| Switch (cd) to a worktree | Without this, you're back to manually `cd ../PROJ-123/` | LOW | CLI can't change parent shell — requires shell function wrapper |
| Delete worktree + branch | Every create needs a corresponding clean delete | LOW | `git worktree remove` + `git branch -d` |
| JIRA credential configuration | Without this, nothing works | LOW | Config file (~/.config/mafcli or ~/.mafclirc), URL + email + API token |
| Branch naming from ticket slug | Prevents manual copy-paste of ticket summaries | LOW | Slugify ticket summary, prepend type prefix |

### Differentiators (Competitive Advantage)

Features that distinguish mafcli from running `git worktree add` manually or using a generic worktree tool.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Interactive ticket picker (list assigned tickets) | Select from your own backlog without leaving terminal — zero lookup | MEDIUM | JIRA REST API `assignee = currentUser()`, interactive list with fzf or inquirer |
| Show JIRA ticket status on worktree list | Instantly see if ticket is In Progress, Done, Blocked without opening browser | MEDIUM | Correlate worktree ↔ ticket via branch name, single batch API call |
| Ticket summary in branch/directory name | Self-documenting branches that humans can read at a glance | LOW | Slug generation from JIRA summary (lowercase, hyphenate, truncate) |
| Worktree health indicators | See dirty/ahead/behind state across all worktrees at a glance (like `git status` for all) | MEDIUM | Requires iterating worktrees, running git status in each |
| Branch type prompt at creation | Enforces `feature/`, `bugfix/`, `chore/` convention without config | LOW | Interactive prompt or positional arg at create time |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| TUI / interactive full-screen interface | "Look how nice lazygit is" | Out of scope per PROJECT.md; adds significant complexity with no value for a personal single-dev tool | Good default output formatting + fzf for selection |
| Automatic branch type detection from JIRA issue type | Seems smart — Bug → bugfix/, Story → feature/ | JIRA issue types vary wildly per project; mapping is brittle and unexpected | Ask the user once at creation time, it takes 2 seconds |
| Automatic worktree deletion on PR merge / ticket close | Satisfying to see cleanup happen automatically | Requires polling or webhook infrastructure; can delete things mid-use unexpectedly | Show "ticket is Done" warning in list, let user delete manually |
| Multi-project JIRA support in one command | Typing `ALPHA-123` vs `BETA-456` | Per PROJECT.md, out of scope; config is per-repo | Single default project per git repo config |
| GitHub/GitLab PR creation integration | Natural workflow extension | Scope creep into git hosting layer; different auth, different APIs | Out of scope v1; existing `gh` / `glab` CLIs do this well |
| `.env` / config file copy between worktrees | Worktree setup automation | Users have different setups; automating wrongly breaks things | Document pattern; let wtp-style hooks handle this if needed |

## Feature Dependencies

```
JIRA credential config
    └──required by──> Create worktree from ticket ID
    └──required by──> List assigned tickets (picker)
    └──required by──> JIRA status in worktree list

Create worktree from ticket ID
    └──required by──> Delete worktree (knows ticket-to-path mapping)

Shell function setup
    └──required by──> Switch/cd to worktree (parent shell dir change)

List worktrees with status
    └──enhances──> Switch/cd (user knows where to go)
    └──enhances──> Delete (user picks what to remove)
```

### Dependency Notes

- **JIRA config required by all JIRA features:** Without stored credentials (URL, email, API token), every JIRA API call fails. Config must be the first thing set up — either via `mafcli config` or prompted on first use.
- **Shell function required by cd/switch:** Node.js CLI processes are children of the shell and cannot change the parent shell's working directory. The tool must print the path and the shell function must wrap it with `cd "$(mafcli path <worktree>)"`. This is the universal pattern across gwq, wtp, and worktrunk.
- **List enhances switch and delete:** Knowing the exact worktree name/path is required for switch and delete; list makes this discoverable without remembering ticket IDs.

## MVP Definition

### Launch With (v1)

Minimum viable product — enough to replace the manual `git worktree add -b feature/PROJ-123-my-ticket ../PROJ-123-my-ticket` workflow entirely.

- [ ] `mafcli config set` — Store JIRA URL, email, API token in config file (first-run setup)
- [ ] `mafcli create <TICKET-ID> [type]` — Fetch ticket from JIRA, create branch + worktree, print path
- [ ] `mafcli list` — Show all worktrees with branch name, dirty indicator, ahead/behind, JIRA status
- [ ] `mafcli pick` — Interactive list of assigned JIRA tickets, select to create worktree
- [ ] `mafcli remove <worktree>` — Delete worktree and its branch safely
- [ ] Shell function snippet — `mafcli cd` prints path for shell `cd` wrapper; documented in README

### Add After Validation (v1.x)

Features to add once the core flow is working and in daily use.

- [ ] `mafcli cd <worktree>` shell wrapper setup command — Automate shell function injection into `.zshrc` / `.bashrc` instead of requiring manual setup
- [ ] Fuzzy search in `mafcli pick` — Filter the assigned ticket list by typing
- [ ] `mafcli open <worktree>` — Open worktree in editor (code, cursor, etc.) with configurable editor command
- [ ] Warn on delete if worktree has uncommitted changes — Safety check before `git worktree remove`

### Future Consideration (v2+)

Features to defer until the tool is validated in daily use.

- [ ] JIRA ticket status transitions from CLI (move to In Progress on create) — Useful but not core to worktree management
- [ ] Commit message prefill with ticket ID — Requires git hooks; adds setup complexity
- [ ] `mafcli prune` — Bulk remove worktrees for closed/done JIRA tickets after confirmation
- [ ] Per-repo JIRA project configuration — For users who work across multiple repos with different projects

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| JIRA credential config | HIGH | LOW | P1 |
| Create worktree from ticket ID | HIGH | MEDIUM | P1 |
| List worktrees with status | HIGH | MEDIUM | P1 |
| Interactive ticket picker (`pick`) | HIGH | MEDIUM | P1 |
| Delete worktree + branch | HIGH | LOW | P1 |
| Shell function for cd | HIGH | LOW | P1 |
| JIRA status in list | MEDIUM | MEDIUM | P2 |
| Fuzzy search in picker | MEDIUM | LOW | P2 |
| Open in editor | LOW | LOW | P2 |
| Uncommitted changes warning on delete | MEDIUM | LOW | P2 |
| Ticket status transition on create | LOW | MEDIUM | P3 |
| Commit message prefill | LOW | HIGH | P3 |
| Bulk prune command | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | gwq | wtp | worktrunk | jira-cli | mafcli (planned) |
|---------|-----|-----|-----------|----------|------------------|
| Create worktree | Yes | Yes | Yes | No | Yes |
| List worktrees | Yes (with status) | Yes | Yes | No | Yes (with JIRA status) |
| Switch/cd | Yes (shell) | Yes (shell) | Yes (shell) | No | Yes (shell function) |
| Delete + branch | Yes | Yes | Yes | No | Yes |
| Interactive picker | Yes (fzf) | No | Yes | Yes (issues list) | Yes (assigned tickets) |
| JIRA integration | No | No | No | Yes (issues only) | Yes (full) |
| Ticket-to-worktree | No | No | No | No | Yes (core feature) |
| Post-create hooks | No | Yes | Yes | No | No (v1) |
| Fuzzy search | Yes | No | No | Yes | v1.x |
| Ticket status in list | No | No | No | No | Yes (differentiator) |
| Shell integration | Manual | Auto | Auto | N/A | Manual (v1), Auto (v1.x) |

## Sources

- [gwq — Git worktree manager with fuzzy finder](https://github.com/d-kuro/gwq)
- [wtp — Powerful Git worktree CLI tool](https://github.com/satococoa/wtp)
- [wtp DEV Community article](https://dev.to/satococoa/wtp-a-better-git-worktree-cli-tool-4i8l)
- [worktrunk — CLI for Git worktree management](https://worktrunk.dev/)
- [jira-cli — Feature-rich interactive Jira command line](https://github.com/ankitpokhrel/jira-cli)
- [git-jira — Git + JIRA integration](https://github.com/FroMage/git-jira)
- [Gira — Git, Jira & GitHub Issues CLI Tool](https://github.com/ealenn/gira)
- [Git Worktree Best Practices and Tools](https://gist.github.com/ChristopherA/4643b2f5e024578606b9cd5d2e6815cc)
- [git-worktree official documentation](https://git-scm.com/docs/git-worktree)
- [Atlassian: Reference work items in development spaces](https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/)

---
*Feature research for: CLI worktree management with JIRA Cloud integration*
*Researched: 2026-04-02*
