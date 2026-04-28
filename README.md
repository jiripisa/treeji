# treeji

Git worktree manager with JIRA Cloud integration. Create worktrees from JIRA tickets, switch between them, and see ticket status — all from the terminal.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/jiripisa/treeji/main/install.sh | bash
```

Then add the shell wrapper (enables `treeji switch` to cd and zsh completions):

```bash
treeji setup-shell >> ~/.zshrc && source ~/.zshrc
```

## Setup

```bash
treeji configure
```

Enter your JIRA Cloud URL and email. The CLI opens the [Atlassian API token page](https://id.atlassian.com/manage-profile/security/api-tokens) in your browser — create a token, copy it, and paste it back. Credentials are validated immediately.

Token is stored in the OS keychain. For CI/headless environments, set the `TREEJI_JIRA_TOKEN` env var instead.

## Usage

```bash
# See everything at a glance — worktrees, branches, JIRA tickets
treeji status

# Pick a ticket interactively from your assigned JIRA issues
treeji pick

# Narrow the picker by case-insensitive substring on key or summary
# (also includes closed tickets so you can revisit an old one)
treeji pick login

# Create worktree from a JIRA ticket
treeji create PROJ-123

# Create worktree with explicit branch type
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

# Open current JIRA ticket in browser
treeji ticket
```

## `pick` vs `create`

Both create the same result — a branch `{type}/{slug}` and worktree `../{slug}/`. The difference is how you get to the ticket:

- **`treeji pick`** — don't know the ticket ID? Browse your assigned JIRA tickets and select one
- **`treeji pick <filter>`** — narrow the list by case-insensitive substring on ticket key or summary. With a filter, closed/Done tickets are also searchable, so you can resurrect an old one by name
- **`treeji create PROJ-123`** — know the ticket ID? Pass it directly (branch type selection is interactive)
- **`treeji create PROJ-123 feature`** — know the ticket ID and type? Pass both
- **`treeji create my-task bugfix`** — no JIRA? Use a manual slug

### Existing remote branches

If the branch the worktree would create already exists on `origin` (e.g. a teammate pushed it), `pick` and `create` detect it and ask whether to fetch and track `origin/<branch>` instead of branching from `HEAD`. Decline to keep the current behaviour (new branch from `HEAD`).

### Branch types

When creating a worktree, you choose from a predefined list:

| Type | Description |
|------|-------------|
| `feature` | New feature for the user |
| `fix` | Bug fix for the user |
| `refactor` | Refactoring production code |
| `docs` | Changes to documentation |
| `style` | Formatting, no production code change |
| `test` | Adding or refactoring tests |
| `chore` | Build tasks, dependency updates |
| *custom* | Type your own branch type |
| *none* | No branch type prefix |

## Commands

| Command | What it does |
|---------|-------------|
| `configure` | Set up JIRA Cloud connection — opens browser to token page, validates credentials, stores token in OS keychain |
| `status` | Unified dashboard: worktrees + branches + JIRA tickets grouped by connection state (`--full` for detail, `--all` for closed tickets) |
| `pick [filter]` | Browse assigned open JIRA tickets, select one, choose branch type → worktree created. Optional `[filter]` narrows by case-insensitive substring on key or summary and includes closed tickets |
| `create` | Create worktree from JIRA ticket ID or manual slug. Branch type is interactive or passed as argument. If the branch already exists on `origin`, you're asked whether to fetch and track it |
| `list` | Colored table: name, ✓/✗ status with ahead/behind, branch, age, clickable JIRA ticket link and status |
| `switch` | Interactive worktree picker or direct name lookup, cd into selected worktree |
| `remove [name]` | Interactive safe picker (only deletable worktrees) or direct name. Warns on unmerged branches. `--force` deletes even with uncommitted changes or unpushed commits, `--yes` skips confirmation prompts (for scripts) |
| `ticket` | Open current JIRA ticket in browser (extracts ticket key from branch name) |
| `setup-shell` | Print shell wrapper for cd support and zsh completions |

## Per-repo configuration

Create a `.treeji.yml` in your repo root to configure symlinks into new worktrees:

```yaml
symlinks:
  - .idea
  - http/http-client.private.env.json
```

After creating a worktree (`pick` or `create`), treeji will offer to symlink these from the main repo. You can deselect individual items in the prompt.

## Requirements

- Node.js 22+
- Git 2.5+ (worktree support)
- JIRA Cloud with API token
