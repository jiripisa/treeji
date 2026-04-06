# treeji

Git worktree manager with JIRA Cloud integration. Create worktrees from JIRA tickets, switch between them, and see ticket status — all from the terminal.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/jiripisa/treeji/main/install.sh | bash
```

Then add the shell wrapper (enables `treeji switch` to cd):

```bash
treeji setup >> ~/.zshrc && source ~/.zshrc
```

## Setup

```bash
treeji configure
```

You'll need your JIRA Cloud URL, email, and [API token](https://id.atlassian.com/manage-profile/security/api-tokens).

## Usage

```bash
# See everything at a glance — worktrees, branches, JIRA tickets
treeji status

# Pick a ticket interactively from your assigned JIRA issues
treeji pick

# Create worktree from a JIRA ticket
treeji create PROJ-123 feature

# Create worktree with manual slug (no JIRA)
treeji create my-task bugfix

# List all worktrees with status
treeji list

# Switch to a worktree (interactive picker)
treeji switch

# Switch to a worktree by name
treeji switch PROJ-123-fix-login

# Remove a worktree (interactive safe picker)
treeji remove
```

## `pick` vs `create`

Both create the same result — a branch `{type}/{slug}` and worktree `../{slug}/`. The difference is how you get to the ticket:

- **`treeji pick`** — don't know the ticket ID? Browse your assigned JIRA tickets and select one
- **`treeji create PROJ-123 feature`** — know the ticket ID? Pass it directly
- **`treeji create my-task bugfix`** — no JIRA? Use a manual slug

## Commands

| Command | What it does |
|---------|-------------|
| `status` | Unified dashboard: worktrees + branches + JIRA tickets grouped by connection state (`--full` for detail, `--all` for closed tickets) |
| `pick` | Browse assigned open JIRA tickets, select one, choose branch type → worktree created |
| `create` | Create worktree from JIRA ticket ID or manual slug. Reuses existing branch if one exists |
| `list` | Colored table: name, ✓/✗ status with ahead/behind, branch, age, clickable JIRA ticket link and status |
| `switch` | Interactive worktree picker or direct name lookup, cd into selected worktree |
| `remove` | Interactive safe picker (only deletable worktrees) or direct name. Warns on unmerged branches |
| `configure` | Set up JIRA Cloud connection (token stored in OS keychain) |
| `setup` | Print shell wrapper for cd support |

## Requirements

- Node.js 22+
- Git 2.5+ (worktree support)
- JIRA Cloud with API token
