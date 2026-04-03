# Phase 2: Git Worktree Core - Research

**Researched:** 2026-04-02
**Domain:** Git worktree CRUD operations, slug generation, shell cd wrapper, terminal table output
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `mafcli list` displays a colored table with aligned columns.
- **D-02:** Columns: branch name, dirty/clean status (colored), ahead/behind remote count, relative age of last commit, and absolute path to worktree directory.
- **D-03:** Dirty status shown in red, clean in green. Ahead/behind shown as `↑N ↓M` or similar compact format.
- **D-04:** `mafcli setup` prints the shell wrapper function to stdout — user copies it to .zshrc manually. Does NOT auto-append.
- **D-05:** Wrapper function named `mafcd`. Usage: `mafcd <worktree-name>` changes directory to the worktree in parent shell.
- **D-06:** Wrapper uses sentinel output pattern — `mafcli switch <name>` prints the path, `mafcd` captures it and runs `cd`.
- **D-07:** `mafcli create <slug> <type>` — manually specified slug and branch type (feature, bugfix, chore, etc.).
- **D-08:** Creates branch `{type}/{slug}` and worktree directory `../{slug}/`.
- **D-09:** Phase 3 will extend create to accept a JIRA ticket ID and auto-fetch the slug. The create command should be designed to support both paths.
- **D-10:** If worktree has uncommitted changes (dirty), show warning and refuse to delete unless `--force` flag is passed.
- **D-11:** Clean worktrees delete immediately without confirmation. Runs `git worktree remove` + `git worktree prune` + deletes the branch.

### Claude's Discretion

- Exact table formatting library (cli-table3, chalk, or manual ANSI)
- How to detect dirty/clean status and ahead/behind counts (git porcelain commands)
- Slug validation rules (allowed characters, max length)
- How `mafcli switch` outputs the path for the shell wrapper to consume
- Test strategy for git worktree commands (temp repos in tests)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WT-02 | User can list all worktrees with git status (dirty/clean, ahead/behind remote) | `git worktree list --porcelain` + `git -C <path> status --porcelain=v1 --branch` + `git -C <path> rev-list --count --left-right HEAD...@{upstream}` |
| WT-03 | User can switch (cd) into an existing worktree via shell wrapper function | Sentinel output pattern (`__MAFCLI_CD__:/path`); zsh/bash function installed via `mafcli setup` |
| WT-04 | User can delete a worktree — removes directory, branch, and runs `git worktree prune` | `git worktree remove <path>` + `git branch -d <branch>` + `git worktree prune`; dirty-check via `git -C <path> status --porcelain=v1` |
| CLI-01 | Shell wrapper function installable via `mafcli setup` — enables `cd` into worktrees from `switch` command | `mafcli setup` prints function body to stdout; user adds to `.zshrc`; `mafcd` wraps `mafcli switch` and reads sentinel |
| CLI-03 | Branch naming follows `{type}/{TICKET-slug}` format, type entered manually by user at creation time | `mafcli create <slug> <type>` builds `{type}/{slug}` branch name; validated before git call |
| CLI-04 | Worktree directories created alongside main repo as `../{TICKET-slug}/` | `git rev-parse --show-toplevel` to get repo root; worktree path = `path.resolve(repoRoot, '..', slug)` |
| CLI-05 | Slug generation handles Czech diacritics, emoji, and special characters correctly (using slugify library) | `slugify` 1.6.9 with `{ lower: true, strict: true }` — verified: Czech chars transliterated, emoji stripped, special chars removed |
</phase_requirements>

---

## Summary

Phase 2 implements the core worktree CRUD commands offline — no JIRA API calls. The technical domain covers four areas: (1) git subprocess calls using execa with the porcelain format for stable parsing, (2) terminal table rendering with chalk for color, (3) the shell `cd` sentinel protocol that enables `mafcd` to change directories in the parent shell, and (4) slug generation using the `slugify` library to sanitize user-provided slugs and future JIRA issue titles.

All architectural decisions are locked by CONTEXT.md. The primary new infrastructure is `src/lib/git.ts` (execa adapter for all git subprocess calls), `src/lib/slug.ts` (slugify wrapper), and five new command files. The existing patterns from Phase 1 (`registerXCommand(program)` in `src/commands/`, lib modules that export plain functions, vitest with `vi.mock()`) apply directly here.

The most critical implementation detail is the sentinel output protocol: `mafcli switch <name>` must print exactly one line with the prefix `__MAFCLI_CD__:` followed by the absolute path. The shell function (`mafcd`) strips the prefix and calls `cd`. Any other stdout output from the switch command must go to stderr, or the shell function will try to `cd` to a garbled path.

**Primary recommendation:** Build `src/lib/git.ts` first (all execa calls centralized), then `src/lib/slug.ts`, then commands in dependency order: `create` → `list` → `switch` → `remove` → `setup`. This matches the architecture research build order and makes each command independently testable.

---

## Standard Stack

### New Dependencies for Phase 2

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| execa | 9.6.1 | Git subprocess execution | ESM-native, no shell injection risk, clean async API; already in STACK.md |
| chalk | 5.6.2 | Terminal colors for list output | Pure ESM, zero deps; implements D-03 dirty=red/clean=green |
| slugify | 1.6.9 | Czech diacritics + emoji slug generation | Verified: `strict: true` removes emoji, transliterates `přihlášení` → `prihlaseni`; required by CLI-05 |

### Already Installed

| Library | Version | Purpose |
|---------|---------|---------|
| @clack/prompts | 1.2.0 | Spinner during git ops, prompts in create |
| commander | 14.0.3 | Command registration |
| conf | 15.1.0 | Config read (requireConfig pattern) |
| @napi-rs/keyring | 1.2.0 | Token retrieval (configure already uses it) |

### Alternatives Considered (Claude's Discretion Items)

| Problem | Instead of | Could Use | Tradeoff |
|---------|------------|-----------|----------|
| Table formatting | chalk + manual padding | cli-table3 0.6.5 | cli-table3 adds a dependency and handles alignment automatically; manual ANSI with `padEnd()` is simpler for 5 columns with no nesting. **Recommendation: chalk + manual `padEnd()` — fewer deps, sufficient for 5-column table.** |
| Dirty detection | `git status --porcelain=v1` | `git diff --quiet HEAD` | porcelain v1 captures both staged and untracked; `diff --quiet` misses untracked files. Use porcelain. |

**Installation:**
```bash
npm install execa chalk slugify
```

**Version verification (confirmed 2026-04-02):**
```bash
npm view execa version    # 9.6.1
npm view chalk version    # 5.6.2
npm view slugify version  # 1.6.9
```

---

## Architecture Patterns

### Recommended Project Structure (additions for Phase 2)

```
src/
├── commands/
│   ├── configure.ts      # EXISTING — Phase 1
│   ├── create.ts         # NEW — mafcli create <slug> <type>
│   ├── list.ts           # NEW — mafcli list
│   ├── switch.ts         # NEW — mafcli switch <name> (sentinel output)
│   ├── remove.ts         # NEW — mafcli remove <name> [--force]
│   └── setup.ts          # NEW — mafcli setup (prints shell wrapper to stdout)
├── lib/
│   ├── config.ts         # EXISTING
│   ├── keychain.ts       # EXISTING
│   ├── jira-validate.ts  # EXISTING
│   ├── git.ts            # NEW — all execa/git calls centralized here
│   └── slug.ts           # NEW — slugify wrapper with validation
├── types/
│   ├── config.ts         # EXISTING
│   └── worktree.ts       # NEW — WorktreeInfo interface
└── index.ts              # MODIFIED — register 5 new commands
```

### Pattern 1: Centralized Git Adapter (`src/lib/git.ts`)

**What:** All `execa('git', [...])` calls go here. Commands and services never call execa directly.
**When to use:** Always — one mock in tests covers all git calls.

```typescript
// src/lib/git.ts
// Source: ARCHITECTURE.md git adapter pattern
import { execa } from 'execa';
import path from 'node:path';

export async function getGitRoot(): Promise<string> {
  const { stdout } = await execa('git', ['rev-parse', '--show-toplevel']);
  return stdout.trim();
}

export async function gitWorktreeList(): Promise<string> {
  const { stdout } = await execa('git', ['worktree', 'list', '--porcelain']);
  return stdout;
}

export async function gitWorktreeAdd(worktreePath: string, branch: string): Promise<void> {
  await execa('git', ['worktree', 'add', '-b', branch, worktreePath]);
}

export async function gitWorktreeRemove(worktreePath: string): Promise<void> {
  await execa('git', ['worktree', 'remove', worktreePath]);
}

export async function gitWorktreePrune(): Promise<void> {
  await execa('git', ['worktree', 'prune']);
}

export async function gitDeleteBranch(branch: string): Promise<void> {
  // -d (not -D) to refuse deletion if unmerged — caller already confirmed clean
  await execa('git', ['branch', '-d', branch]);
}

export async function gitStatusPorcelain(worktreePath: string): Promise<string> {
  const { stdout } = await execa('git', ['-C', worktreePath, 'status', '--porcelain=v1']);
  return stdout;
}

export async function gitAheadBehind(worktreePath: string): Promise<{ ahead: number; behind: number }> {
  try {
    const { stdout } = await execa('git', [
      '-C', worktreePath,
      'rev-list', '--count', '--left-right', 'HEAD...@{upstream}',
    ]);
    const [ahead, behind] = stdout.trim().split('\t').map(Number);
    return { ahead: ahead ?? 0, behind: behind ?? 0 };
  } catch {
    // No upstream set — not an error, just show 0/0
    return { ahead: 0, behind: 0 };
  }
}

export async function gitLastCommitRelativeDate(worktreePath: string): Promise<string> {
  const { stdout } = await execa('git', ['-C', worktreePath, 'log', '-1', '--format=%ar']);
  return stdout.trim() || 'no commits';
}
```

### Pattern 2: Porcelain Output Parsing

**What:** Parse `git worktree list --porcelain` output into typed `WorktreeInfo[]`.
**When to use:** Always — never parse non-porcelain git output.

Porcelain format (observed on this machine, 2026-04-02):
```
worktree /path/to/repo
HEAD 1a02458ce23a25e6d0919e4fcd13fe33b8719b1c
branch refs/heads/main

worktree /path/to/linked-worktree
HEAD abc123...
branch refs/heads/feature/PROJ-123-fix-login

```

Each worktree block is separated by a blank line. The main worktree is always first. A detached HEAD worktree shows `detached` instead of `branch refs/...`.

```typescript
// src/types/worktree.ts
export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string | null;  // null if detached HEAD
  isMain: boolean;        // true for the first entry (main worktree)
}

// Parsing logic (in lib/git.ts or a parseWorktrees helper):
export function parseWorktreeList(porcelain: string): WorktreeInfo[] {
  const blocks = porcelain.trim().split(/\n\n+/);
  return blocks.map((block, index) => {
    const lines = block.split('\n');
    const pathLine = lines.find(l => l.startsWith('worktree '));
    const headLine = lines.find(l => l.startsWith('HEAD '));
    const branchLine = lines.find(l => l.startsWith('branch '));
    return {
      path: pathLine?.slice('worktree '.length) ?? '',
      head: headLine?.slice('HEAD '.length) ?? '',
      branch: branchLine ? branchLine.slice('branch refs/heads/'.length) : null,
      isMain: index === 0,
    };
  });
}
```

### Pattern 3: Sentinel Output Protocol (D-06)

**What:** `mafcli switch <name>` must output exactly one machine-readable line to stdout for the shell wrapper to consume. All human-readable output goes to stderr.
**When to use:** Any command that must communicate a filesystem path back to the parent shell.

```typescript
// src/commands/switch.ts
// CRITICAL: stdout is reserved for the sentinel line only
// All user-facing output goes to process.stderr (or @clack/prompts which uses stderr)
export async function registerSwitchCommand(program: Command): void {
  program
    .command('switch <name>')
    .description('Print worktree path for shell cd wrapper (use mafcd instead)')
    .action(async (name: string) => {
      const worktrees = await listWorktrees();
      const target = worktrees.find(w => w.branch?.endsWith(`/${name}`) || path.basename(w.path) === name);
      if (!target) {
        process.stderr.write(`mafcli: no worktree named '${name}'\n`);
        process.exit(1);
      }
      // The ONLY stdout output — sentinel line for mafcd shell function
      process.stdout.write(`__MAFCLI_CD__:${target.path}\n`);
    });
}
```

Shell wrapper printed by `mafcli setup` (stdout, user copies to .zshrc):

```bash
# mafcd — change directory to a mafcli worktree
# Install: add to ~/.zshrc (or ~/.bashrc)
mafcd() {
  local output
  output=$(mafcli switch "$1" 2>/dev/null)
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    mafcli switch "$1"  # Re-run to show stderr error to user
    return 1
  fi
  local target="${output#__MAFCLI_CD__:}"
  if [ -z "$target" ] || [ "$target" = "$output" ]; then
    echo "mafcd: unexpected output from mafcli switch" >&2
    return 1
  fi
  cd "$target"
}
```

### Pattern 4: Slug Generation (`src/lib/slug.ts`)

**What:** Slugify user-provided slugs and (future) JIRA summaries.
**When to use:** Any time a string becomes part of a branch name or directory name.

Verified behavior of `slugify` 1.6.9 with `{ lower: true, strict: true }`:
- `'Oprava přihlášení uživatele'` → `'oprava-prihlaseni-uzivatele'` (Czech transliteration works)
- `'🎉 Release day!'` → `'release-day'` (emoji stripped)
- `'Fix: user\'s \`login\` endpoint (PROJ-123)'` → `'fix-users-login-endpoint-proj-123'`
- `'!!!---???'` → `''` (all-special input returns empty string — must handle this edge case)
- Long strings are NOT automatically truncated — must truncate before or after

```typescript
// src/lib/slug.ts
import slugify from 'slugify';

export const SLUG_MAX_LENGTH = 50;

export function toSlug(input: string): string {
  const slug = slugify(input, { lower: true, strict: true });
  // strict: true uses [^a-zA-Z0-9] as the replacement target — very clean output
  return slug.slice(0, SLUG_MAX_LENGTH).replace(/-+$/, '');
}

export function validateSlug(slug: string): string | undefined {
  if (!slug) return 'Slug cannot be empty';
  if (!/^[a-z0-9]/.test(slug)) return 'Slug must start with a letter or number';
  if (slug.length > SLUG_MAX_LENGTH) return `Slug must be at most ${SLUG_MAX_LENGTH} characters`;
  return undefined; // valid
}
```

**Critical edge case:** `toSlug('!!!---???')` returns `''`. The create command MUST check for an empty result and show an error before attempting git operations.

### Pattern 5: Dirty-Check Before Delete (D-10)

```typescript
// src/commands/remove.ts
// D-10: refuse to delete dirty worktree unless --force
const statusOutput = await gitStatusPorcelain(target.path);
const isDirty = statusOutput.trim().length > 0;

if (isDirty && !opts.force) {
  p.cancel(`Worktree '${name}' has uncommitted changes. Use --force to delete anyway.`);
  process.exit(1);
}

// D-11: delete sequence
await gitWorktreeRemove(target.path);  // removes dir + git metadata
await gitDeleteBranch(target.branch!); // remove branch
await gitWorktreePrune();              // clean up any stale metadata
```

### Pattern 6: Ahead/Behind With No Upstream

`git rev-list --count --left-right HEAD...@{upstream}` exits non-zero when no upstream is configured. This is normal for locally-created worktrees that have never been pushed. The git adapter must catch this error and return `{ ahead: 0, behind: 0 }` — do not surface it as an error in the list output. Display as `↑0 ↓0` or `-/-` (implementation choice per Claude's Discretion).

### Anti-Patterns to Avoid

- **Stdout contamination in switch command:** Any `console.log()` or `p.log.*()` call in the switch command path breaks the shell wrapper — the function will try to `cd` to the log message. Everything except the sentinel line MUST go to stderr.
- **Parsing non-porcelain git output:** `git worktree list` (without `--porcelain`) output format is not stable across git versions. Always use `--porcelain`.
- **Using `git worktree remove` with `--force` by default:** This bypasses the dirty check that the CLI should own. Let the CLI check dirty status and pass `--force` to `git worktree remove` only when the user passes `--force` to mafcli.
- **Creating worktree path relative to `$PWD`:** Users may run mafcli from a subdirectory. Always resolve path relative to `git rev-parse --show-toplevel`, then `path.resolve(gitRoot, '..', slug)`.
- **Calling `git branch -D` (force delete):** Use `-d` (lowercase) for clean branches. Only use `-D` when user passes `--force`, which implies they accept potential data loss.
- **Calling execa outside `src/lib/git.ts`:** All git subprocess calls must go through the lib adapter for testability.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Czech + emoji transliteration | Custom regex replace for diacritics | `slugify` with `strict: true` | Hand-rolled regex misses: ě→e, š→s, ž→z, č→c, ř→r, ý→y, á→a, í→i, ú→u, ů→u — and many more Unicode categories |
| Ahead/behind count | Parse `git log` output manually | `git rev-list --count --left-right HEAD...@{upstream}` | Porcelain command outputs `N\tM` — one parse, no regex |
| Terminal table alignment | Manual `String.padEnd()` loops | chalk + `padEnd()` with computed column widths | Column widths must be computed from data, not hardcoded — manual is fine but compute max width per column before rendering |
| Worktree dirty detection | `git diff` | `git -C <path> status --porcelain=v1` | `git diff` misses untracked files. Only porcelain status catches all dirty states (modified, staged, untracked, deleted) |
| Shell wrapper distribution | Node.js that writes to `.zshrc` | Print to stdout; user adds to `.zshrc` | Auto-modifying shell config is fragile, hard to undo, and confusing if the user already has a customized `.zshrc`. D-04 explicitly locks this. |

**Key insight:** The slug and git status problems look trivial but have significant Unicode and git-state edge cases. Use the libraries that handle them correctly.

---

## Common Pitfalls

### Pitfall 1: stdout Contamination Breaks Shell Wrapper

**What goes wrong:** Any `console.log`, `process.stdout.write`, or `@clack/prompts` output in the `switch` command causes the shell's `mafcd` function to try `cd` on the log message. The user sees: `cd: not a directory: mafcli: no worktree named 'foo'`.

**Why it happens:** The shell wrapper captures all of stdout and extracts the sentinel line. If there are two lines on stdout, the logic breaks.

**How to avoid:** In `switch.ts`, never use `console.log` or any `p.*` call. Write human-readable errors to `process.stderr`. The only stdout line is the sentinel.

**Warning signs:** Any `p.log.*()`, `p.note()`, or `console.log()` call in `src/commands/switch.ts`.

---

### Pitfall 2: Empty Slug from All-Special Input

**What goes wrong:** User runs `mafcli create '!!!-bug-!!!' feature`. After slugify, the slug becomes `''`. `git worktree add -b feature/ ../` fails with a fatal git error.

**Why it happens:** `slugify` with `strict: true` removes all non-alphanumeric characters. A string composed entirely of special characters produces an empty string.

**How to avoid:** After calling `toSlug()`, validate the result is non-empty before proceeding. Return an actionable error: "Slug '!!!' produces an empty result after sanitization. Use only letters, numbers, and hyphens."

---

### Pitfall 3: Worktree Path Created in Wrong Location

**What goes wrong:** User is in `src/` subdirectory and runs `mafcli create my-feature feature`. The worktree is created at `../my-feature/` relative to `src/`, which is inside the repo root — not alongside it.

**Why it happens:** Using `process.cwd()` instead of `git rev-parse --show-toplevel` to resolve the worktree path.

**How to avoid:** Always call `getGitRoot()` at the start of `create` and compute `path.resolve(gitRoot, '..', slug)`.

---

### Pitfall 4: List Command Shows 0/0 for Branches Without Remote as an Error

**What goes wrong:** New local branches (not yet pushed) cause `rev-list HEAD...@{upstream}` to exit non-zero. If not caught, `list` crashes or shows an error per worktree.

**Why it happens:** git returns exit code 128 when `@{upstream}` is not configured.

**How to avoid:** The `gitAheadBehind` function must catch all errors from this command and return `{ ahead: 0, behind: 0 }`. The list command treats a missing upstream as 0/0 (or renders `-/-` per implementation preference).

---

### Pitfall 5: Branch Delete After `git worktree remove` Can Fail

**What goes wrong:** After `git worktree remove <path>`, the branch still exists. `git branch -d <branch>` may fail with "error: branch not fully merged" if the branch has commits not in any other branch — even for a clean worktree (worktree is clean, but branch was never merged upstream).

**Why it happens:** "clean" (no uncommitted changes) does not mean "merged" (changes committed but not in main). `-d` enforces the merge check.

**How to avoid:** Two options: (1) use `-d` always and surface the merge-check error with an actionable message ("Branch has unmerged commits. Use `--force` to delete anyway."), or (2) always use `-D` with a `--force` flag from the CLI user. Option 1 is safer — users may not realize they have unmerged commits. The `--force` flag on `mafcli remove` should pass `-D` to `git branch`.

---

### Pitfall 6: Detached HEAD Worktrees Lack a Branch Name

**What goes wrong:** `git worktree list --porcelain` for a detached HEAD worktree shows `detached` on a line by itself (no `branch refs/...` line). Parsing code that always expects a `branch` line will crash or produce `undefined` branch names.

**Why it happens:** Worktrees created with `git worktree add <path> <commit-sha>` instead of a branch name are in detached HEAD state.

**How to avoid:** The `WorktreeInfo.branch` field must be `string | null`. Parsing must detect the absence of the `branch` line. The list display should show `(detached)` for such worktrees. The remove command must handle `null` branch (skip `git branch -d` step if branch is null).

---

## Code Examples

### Git Worktree Porcelain Format (observed, this machine)

```
worktree /Users/jpisa/Development/Claude/mafin-cli
HEAD 1a02458ce23a25e6d0919e4fcd13fe33b8719b1c
branch refs/heads/main

```

Blocks separated by blank lines. Fields: `worktree`, `HEAD`, `branch` (or `detached`). The main worktree is always first.

### Git Status Dirty Detection

```typescript
// Source: git-scm.com/docs/git-status, --porcelain=v1
// Any non-empty output means dirty
const status = await gitStatusPorcelain(worktreePath);
const isDirty = status.trim().length > 0;
```

### Git Ahead/Behind

```typescript
// Source: git-scm.com/docs/git-rev-list
// Output: "2\t1" means 2 ahead, 1 behind
// Exit non-zero when no upstream — must catch
const { stdout } = await execa('git', [
  '-C', worktreePath,
  'rev-list', '--count', '--left-right', 'HEAD...@{upstream}',
]);
const [ahead, behind] = stdout.trim().split('\t').map(Number);
```

### Worktree Path Resolution

```typescript
// Source: PITFALLS.md — always relative to git root, not cwd
import path from 'node:path';
const gitRoot = await getGitRoot(); // git rev-parse --show-toplevel
const worktreePath = path.resolve(gitRoot, '..', slug);
```

### List Table Rendering (chalk + manual alignment)

```typescript
import chalk from 'chalk';

function renderWorktreeTable(rows: WorktreeRow[]): void {
  // Compute column widths from data
  const branchWidth = Math.max(6, ...rows.map(r => r.branch.length));
  const pathWidth = Math.max(4, ...rows.map(r => r.path.length));

  // Header
  console.log(
    'BRANCH'.padEnd(branchWidth),
    'STATUS'.padEnd(8),
    'REMOTE'.padEnd(10),
    'AGE'.padEnd(12),
    'PATH'
  );

  for (const row of rows) {
    const statusStr = row.isDirty
      ? chalk.red('dirty')
      : chalk.green('clean');
    const remoteStr = `${chalk.cyan('↑')}${row.ahead} ${chalk.yellow('↓')}${row.behind}`;
    console.log(
      row.branch.padEnd(branchWidth),
      statusStr.padEnd(8),   // Note: chalk adds ANSI bytes, visual width still 5
      remoteStr.padEnd(10),
      row.lastCommit.padEnd(12),
      row.path,
    );
  }
}
```

Note: `padEnd` uses byte length, not visual width. ANSI escape codes from chalk inflate the string length. For proper alignment when mixing colored and uncolored cells, compute padding before applying chalk.

### Sentinel Pattern (switch command)

```typescript
// src/commands/switch.ts
// All human output → stderr. stdout → sentinel only.
process.stdout.write(`__MAFCLI_CD__:${target.path}\n`);
```

```bash
# Shell function printed by `mafcli setup`
mafcd() {
  local output
  output=$(mafcli switch "$1" 2>/dev/null)
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    mafcli switch "$1"  # re-run to surface stderr to user
    return 1
  fi
  local target="${output#__MAFCLI_CD__:}"
  cd "$target"
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `slugify` v1 simple mode | `slugify` v1 with `strict: true` | Always available | `strict: true` removes ALL non-alphanumeric chars; without it, colons and parentheses can remain in slugs |
| `git status --short` | `git status --porcelain=v1` | git 1.7.2+ | Porcelain v1 is stable across git versions; `--short` format is user-facing and can change |
| `git worktree list` (human) | `git worktree list --porcelain` | git 2.7+ | Porcelain is stable for machine parsing; human output changed between git versions |

**Deprecated/outdated:**
- `git status --short --branch` for scripting: Use `--porcelain=v1 --branch` — same data, stable format guarantee.
- Parsing `git branch -v` for ahead/behind: Use `rev-list --count --left-right` — direct and unambiguous.

---

## Open Questions

1. **ANSI padding for colored table cells**
   - What we know: `chalk` adds invisible bytes that inflate `String.length`, causing `padEnd()` to under-pad colored cells visually.
   - What's unclear: Whether the misalignment is noticeable with 5-column layout at typical terminal widths.
   - Recommendation: Compute padding width from the raw (un-chalked) string, then apply chalk after padding. E.g., `chalk.red('dirty'.padEnd(8))` not `chalk.red('dirty').padEnd(8)`.

2. **`git branch -d` vs `-D` for `--force` remove**
   - What we know: `-d` enforces merge check; `-D` forces deletion regardless. D-11 says "deletes the branch" without specifying behavior on unmerged branches.
   - What's unclear: User intent when `--force` is used — are they explicitly accepting potential branch loss?
   - Recommendation: With `--force`, use `git branch -D` (force). Without `--force`, use `git branch -d` and surface a clear error if the branch is unmerged.

3. **Relative date format for last commit**
   - What we know: `git log -1 --format=%ar` returns human-readable relative time ("2 hours ago", "3 days ago").
   - What's unclear: Whether this is sufficient or whether a fixed-width format is needed for table alignment.
   - Recommendation: Use `%ar` (relative, auto) — aligns reasonably with padEnd(12) for dates up to "2 months ago". Very old worktrees ("2 years ago") will overflow; this is acceptable for a personal tool.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | All commands | Yes | 2.x (inferred from working repo) | None — required |
| Node.js | Runtime | Yes | >= 20 (engines in package.json) | None |
| execa | src/lib/git.ts | Not installed | — | `npm install execa` (Wave 0) |
| chalk | src/commands/list.ts | Not installed | — | `npm install chalk` (Wave 0) |
| slugify | src/lib/slug.ts | Not installed | — | `npm install slugify` (Wave 0) |

**Missing dependencies with no fallback:**
- execa, chalk, slugify — all must be installed before implementation begins. Wave 0 task.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `vitest.config.ts` (exists: `environment: 'node'`) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WT-02 | `mafcli list` shows branch, dirty/clean, ahead/behind, age, path | unit | `npm test -- src/commands/list.test.ts` | No — Wave 0 |
| WT-02 | `parseWorktreeList` parses porcelain blocks correctly | unit | `npm test -- src/lib/git.test.ts` | No — Wave 0 |
| WT-02 | dirty detection returns true when status non-empty | unit | `npm test -- src/lib/git.test.ts` | No — Wave 0 |
| WT-02 | ahead/behind returns 0/0 when no upstream | unit | `npm test -- src/lib/git.test.ts` | No — Wave 0 |
| WT-03 | `mafcli switch` outputs exactly `__MAFCLI_CD__:<path>` on stdout | unit | `npm test -- src/commands/switch.test.ts` | No — Wave 0 |
| WT-03 | `mafcli switch` writes error to stderr on unknown worktree | unit | `npm test -- src/commands/switch.test.ts` | No — Wave 0 |
| WT-04 | `mafcli remove` refuses dirty worktree without `--force` | unit | `npm test -- src/commands/remove.test.ts` | No — Wave 0 |
| WT-04 | `mafcli remove` deletes worktree + branch + prune on clean | unit | `npm test -- src/commands/remove.test.ts` | No — Wave 0 |
| WT-04 | `mafcli remove --force` deletes dirty worktree | unit | `npm test -- src/commands/remove.test.ts` | No — Wave 0 |
| CLI-01 | `mafcli setup` prints valid shell function to stdout | unit | `npm test -- src/commands/setup.test.ts` | No — Wave 0 |
| CLI-01 | Shell wrapper output contains `__MAFCLI_CD__:` sentinel extraction | unit | `npm test -- src/commands/setup.test.ts` | No — Wave 0 |
| CLI-03 | create builds branch name as `{type}/{slug}` | unit | `npm test -- src/commands/create.test.ts` | No — Wave 0 |
| CLI-04 | create resolves worktree path as `../slug/` from git root | unit | `npm test -- src/commands/create.test.ts` | No — Wave 0 |
| CLI-05 | `toSlug` handles Czech diacritics correctly | unit | `npm test -- src/lib/slug.test.ts` | No — Wave 0 |
| CLI-05 | `toSlug` strips emoji correctly | unit | `npm test -- src/lib/slug.test.ts` | No — Wave 0 |
| CLI-05 | `toSlug` handles all-special-character input (returns empty) | unit | `npm test -- src/lib/slug.test.ts` | No — Wave 0 |
| CLI-05 | `toSlug` truncates at 50 characters | unit | `npm test -- src/lib/slug.test.ts` | No — Wave 0 |
| CLI-05 | `validateSlug` catches empty slug | unit | `npm test -- src/lib/slug.test.ts` | No — Wave 0 |

### Testing Strategy for Git Commands

Git subprocess calls are centralized in `src/lib/git.ts`. Tests mock that module — no real git repo needed.

Established pattern from Phase 1 (`configure.test.ts`):
```typescript
vi.mock('../lib/git.js', () => ({
  gitWorktreeList: vi.fn(),
  gitStatusPorcelain: vi.fn(),
  gitAheadBehind: vi.fn(),
  // ...
}));
```

For `parseWorktreeList` (pure function, no execa), test directly with fixture strings representing porcelain output.

For slug.ts, test directly — `slugify` does not need mocking, it is a pure computation.

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/git.test.ts` — covers WT-02 parsing and git status functions
- [ ] `src/lib/slug.test.ts` — covers CLI-05 edge cases
- [ ] `src/commands/create.test.ts` — covers CLI-03, CLI-04
- [ ] `src/commands/list.test.ts` — covers WT-02 display
- [ ] `src/commands/switch.test.ts` — covers WT-03 sentinel protocol
- [ ] `src/commands/remove.test.ts` — covers WT-04 dirty-check and deletion sequence
- [ ] `src/commands/setup.test.ts` — covers CLI-01 shell wrapper output

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Impact on Phase 2 |
|-----------|--------|-------------------|
| Start work through a GSD command (`/gsd:execute-phase`) | CLAUDE.md GSD Workflow Enforcement | No direct code impact — already in a GSD workflow |
| Node.js TypeScript CLI | CLAUDE.md Constraints | All code must be TypeScript with ESM |
| Git requires worktrees support (2.5+) | CLAUDE.md Constraints | `git worktree` subcommands are available |
| JIRA Cloud REST API v3 with Basic Auth | CLAUDE.md Constraints | Phase 2 has no JIRA calls — not applicable |
| `module: nodenext` in tsconfig | STATE.md accumulated decisions | All relative imports require `.js` extension (e.g., `'../lib/git.js'` not `'../lib/git'`) |
| Class-based `vi.mock()` for constructor mocks | STATE.md accumulated decisions | Does not apply to Phase 2 (no class constructors — all lib modules export plain functions) |
| `process.exit` mock must throw in tests | STATE.md accumulated decisions | Apply in remove.test.ts and switch.test.ts where commands call `process.exit(1)` |
| `@napi-rs/keyring` over keytar | STATE.md accumulated decisions | Not applicable in Phase 2 (no credential ops) |

---

## Sources

### Primary (HIGH confidence)

- Observed locally: `git worktree list --porcelain` output format — verified on this machine 2026-04-02
- Observed locally: `git -C <path> status --porcelain=v1` output — verified
- Observed locally: `git rev-list --count --left-right HEAD...@{upstream}` — verified (exits non-zero with no upstream)
- `.planning/research/STACK.md` — execa, chalk, slugify recommendations
- `.planning/research/ARCHITECTURE.md` — git adapter pattern, command-as-orchestrator
- `.planning/research/PITFALLS.md` — sentinel protocol, porcelain parsing, slug edge cases

### Secondary (MEDIUM confidence)

- npm registry: `slugify@1.6.9`, `chalk@5.6.2`, `execa@9.6.1` — version-checked 2026-04-02
- slugify verified in temp env: Czech transliteration, emoji strip, all-special → empty

### Tertiary (LOW confidence)

- ANSI padding interaction with chalk — based on known chalk behavior, not formally tested in this context

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified installed versions, existing stack research confirms choices
- Architecture: HIGH — follows established Phase 1 patterns, git porcelain format verified locally
- Pitfalls: HIGH — sentinel protocol, porcelain parsing, empty slug all verified by direct observation or testing

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable domain — git porcelain format and slugify behavior change infrequently)
