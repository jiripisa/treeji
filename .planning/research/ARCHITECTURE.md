# Architecture Research

**Domain:** TypeScript CLI tool with external API integration (git worktree + JIRA Cloud)
**Researched:** 2026-04-02
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  create  │  │   list   │  │  switch  │  │  delete  │   │
│  │ command  │  │ command  │  │ command  │  │ command  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │              │          │
│  ┌────▼─────────────▼─────────────▼──────────────▼─────┐   │
│  │              Commander.js program + @clack/prompts   │   │
│  └──────────────────────────┬──────────────────────────┘   │
└─────────────────────────────│───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                      Service Layer                           │
│  ┌──────────────────┐      ┌───────────────────────────┐    │
│  │  WorktreeService │      │       JiraService         │    │
│  │  (git operations)│      │  (ticket fetch, list)     │    │
│  └────────┬─────────┘      └─────────────┬─────────────┘   │
└───────────│────────────────────────────── │────────────────┘
            │                               │
┌───────────▼───────────┐  ┌───────────────▼─────────────────┐
│    Infrastructure     │  │          Infrastructure          │
│  ┌────────────────┐   │  │  ┌──────────────────────────┐   │
│  │  GitRunner     │   │  │  │   jira.js Version3Client  │  │
│  │ (execa wrapper)│   │  │  │   (Basic Auth HTTP)       │  │
│  └────────────────┘   │  │  └──────────────────────────┘   │
│  ┌────────────────┐   │  └─────────────────────────────────┘
│  │  ConfigStore   │   │
│  │ (~/.config/    │   │
│  │  mafcli/)      │   │
│  └────────────────┘   │
└───────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Commands (`src/commands/`) | Parse args, validate input, orchestrate services, render output | Commander.js command handlers, one file per command |
| WorktreeService | All git worktree operations: add, list, remove, branch name generation | Thin wrapper over GitRunner, pure business logic |
| JiraService | Fetch issue by ID, list assigned issues, format issue data | Wraps `jira.js` Version3Client |
| GitRunner | Execute raw git commands, parse output, handle git errors | `execa` wrapper — single place for all `git` subprocess calls |
| ConfigStore | Read/write persistent config (JIRA URL, credentials) | JSON file at XDG config path (`~/.config/mafcli/config.json`) |
| `@clack/prompts` | Interactive selection prompts (ticket list picker, branch type input) | Called from commands, not from services |

## Recommended Project Structure

```
src/
├── commands/           # One file per CLI command
│   ├── create.ts       # mafcli create — create worktree from JIRA ticket
│   ├── list.ts         # mafcli list — show all worktrees with status
│   ├── switch.ts       # mafcli switch — cd into worktree
│   ├── delete.ts       # mafcli delete — remove worktree + branch
│   └── configure.ts    # mafcli configure — set JIRA credentials
├── services/           # Business logic, no I/O concerns
│   ├── worktree.ts     # Worktree CRUD, branch naming, path resolution
│   └── jira.ts         # Issue fetching, JQL queries, data mapping
├── lib/                # Infrastructure adapters
│   ├── git.ts          # execa wrapper for git commands
│   └── config.ts       # Config file read/write (XDG path)
├── types/              # Shared TypeScript interfaces
│   ├── worktree.ts     # WorktreeInfo, WorktreeStatus
│   └── jira.ts         # JiraIssue, JiraConfig
└── index.ts            # Entry point — registers commands, calls program.parse()
```

### Structure Rationale

- **`commands/`:** Each command is an isolated handler. Commands own arg validation, prompt invocation, and console output. They do not call git or HTTP directly — that always goes through services.
- **`services/`:** Contains reusable business logic. Services know nothing about Commander.js or @clack/prompts. They are testable in isolation.
- **`lib/`:** Adapters for external I/O (shell, filesystem). Centralizing git calls here makes the rest of the codebase testable without spawning processes.
- **`types/`:** Shared interfaces prevent duplication between commands and services, and make the JIRA API response types explicit.

## Architectural Patterns

### Pattern 1: Command as Orchestrator

**What:** Each command file imports services and calls them in sequence. The command owns input (args, prompts) and output (console.log, spinner). Services own logic.
**When to use:** Always — this is the core separation in every well-structured CLI.
**Trade-offs:** Slightly more files than putting everything in one function, but dramatically easier to test and extend.

**Example:**
```typescript
// src/commands/create.ts
export async function createCommand(ticketId: string | undefined) {
  const config = configStore.load();
  const jira = new JiraService(config);
  const git = new WorktreeService();

  // If no ticket ID given, let user pick from assigned issues
  const issue = ticketId
    ? await jira.getIssue(ticketId)
    : await pickFromAssigned(jira);    // uses @clack/prompts

  const branchType = await promptBranchType(); // uses @clack/prompts

  const { branchName, worktreePath } = git.buildPaths(issue, branchType);
  await git.create(branchName, worktreePath);

  p.outro(`Created worktree at ${worktreePath}`);
}
```

### Pattern 2: Thin Git Adapter

**What:** All `git` subprocess calls go through a single `lib/git.ts` module using `execa`. Services never call `execa` directly.
**When to use:** Any time you execute shell commands — centralizing this simplifies error handling and makes mocking possible in tests.
**Trade-offs:** One extra indirection, but git error messages are notoriously noisy; a single adapter handles stripping/wrapping them consistently.

**Example:**
```typescript
// src/lib/git.ts
import { execa } from 'execa';

export async function gitWorktreeAdd(path: string, branch: string) {
  const { stdout } = await execa('git', ['worktree', 'add', '-b', branch, path]);
  return stdout;
}

export async function gitWorktreeList(): Promise<string> {
  const { stdout } = await execa('git', ['worktree', 'list', '--porcelain']);
  return stdout;
}
```

### Pattern 3: Config-First Boot

**What:** On startup, commands that need JIRA credentials check that config exists and is valid before doing anything else. The `configure` command writes the config file. All other commands fail fast with a helpful error if config is missing.
**When to use:** Any personal CLI with API credentials — avoids confusing errors later in execution.
**Trade-offs:** Adds one guard check per command, but a helper `requireConfig()` utility keeps it to one line per command.

```typescript
// src/lib/config.ts
export function requireConfig(): JiraConfig {
  const cfg = loadConfig();
  if (!cfg?.host || !cfg?.email || !cfg?.apiToken) {
    console.error('Run `mafcli configure` first to set JIRA credentials.');
    process.exit(1);
  }
  return cfg;
}
```

## Data Flow

### Create Worktree Flow (primary use case)

```
User runs: mafcli create PROJ-123
     │
     ▼
create.ts command
  - calls requireConfig()            → reads ~/.config/mafcli/config.json
  - calls jira.getIssue('PROJ-123') → HTTP GET to Atlassian REST API v3
  - prompts user for branch type     → @clack/prompts select()
  - calls git.buildPaths()           → pure function: returns branchName + worktreePath
  - calls git.create()               → execa('git', ['worktree', 'add', '-b', branch, path])
  - prints success + directory path  → console output
```

### List Worktrees Flow

```
User runs: mafcli list
     │
     ▼
list.ts command
  - calls requireConfig()
  - calls git.listWorktrees()        → execa('git', ['worktree', 'list', '--porcelain'])
  - for each worktree with ticket ID:
      calls jira.getIssue(ticketId)  → HTTP GET (can be parallelized with Promise.all)
  - renders table                    → console.table or custom formatter
```

### Configuration Flow

```
User runs: mafcli configure
     │
     ▼
configure.ts command
  - @clack/prompts text() for JIRA URL, email, API token
  - calls configStore.save(config)   → writes ~/.config/mafcli/config.json
  - prints confirmation
```

### Key Data Flows

1. **JIRA → git path:** Issue summary is slugified (`PROJ-123-fix-login-bug`) to form both the branch name suffix and the worktree directory name.
2. **Config at boot:** Config is loaded once per command invocation from disk; no in-memory singleton needed for a short-lived CLI process.
3. **No bidirectional data:** Data flows one direction — JIRA issue details in, git worktree out. No writes back to JIRA in v1.

## Scaling Considerations

This is a personal single-developer tool. Scaling is not a concern. The relevant "scale" questions are:

| Concern | Approach |
|---------|----------|
| Many worktrees (20+) | `git worktree list` is fast; JIRA status fetch can be parallelized with `Promise.all` in `list` command |
| Slow JIRA API | Add simple in-process cache (Map keyed by issue ID) within a single command invocation — no disk cache needed |
| Multiple repos | Config is global per-user; worktree commands are always run from within a git repo (GitRunner detects CWD) |

## Anti-Patterns

### Anti-Pattern 1: Mixing Prompt Logic into Services

**What people do:** Call `@clack/prompts` inside `WorktreeService` or `JiraService` to ask for missing input.
**Why it's wrong:** Services become untestable, and the "interactive vs scripted" distinction breaks. A service called from a non-interactive context (future automation) would hang waiting for terminal input.
**Do this instead:** Commands own all prompts. Services accept resolved values as parameters.

### Anti-Pattern 2: Direct git Subprocess Calls Scattered Across Files

**What people do:** Call `execa('git', [...])` anywhere in the codebase — inside command files, inside services.
**Why it's wrong:** Git error handling logic duplicates, and there is no single place to add logging/debugging. Making tests possible requires mocking in many places.
**Do this instead:** All git calls go through `src/lib/git.ts`. One mock covers all tests.

### Anti-Pattern 3: Storing Credentials in Plain Process.env Without Explicit Config Command

**What people do:** Expect users to set env vars (`JIRA_TOKEN=...`) rather than providing a `configure` command.
**Why it's wrong:** For a personal tool, env vars create maintenance friction. The user must set them in shell profile and remember which vars to set.
**Do this instead:** Provide `mafcli configure` that writes to `~/.config/mafcli/config.json`. Env var override is still acceptable as a secondary path (useful for CI/testing), but config file is the primary UX.

### Anti-Pattern 4: Parsing git Worktree Output with Brittle String Matching

**What people do:** Parse `git worktree list` text output with `split('\n')` and fragile index-based access.
**Why it's wrong:** Output format varies with git version; `--porcelain` format is the stable, machine-readable format.
**Do this instead:** Always use `git worktree list --porcelain` for parsing. The porcelain format is documented and stable across git versions.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| JIRA Cloud REST API v3 | `jira.js` `Version3Client` with Basic Auth (email + API token) | Token stored in config file, never in code. JQL query: `assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC` for assigned issues |
| git | `execa` subprocess calls via `src/lib/git.ts` adapter | Requires git 2.5+. Always detect if CWD is inside a git repo before running worktree commands |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| commands → services | Direct function calls, typed interfaces | Commands import services; services never import commands |
| services → lib/git | Direct function calls | WorktreeService imports from `lib/git.ts` |
| services → lib/config | Direct function calls | JiraService receives config as constructor argument (not reads from disk itself) |
| commands → lib/config | Direct `requireConfig()` call at command start | Config loaded once, passed into services |
| commands → @clack/prompts | Direct calls in command handlers | No prompt logic inside services |

## Suggested Build Order

Based on component dependencies, build in this sequence:

1. **`lib/config.ts`** — No dependencies. Enables configuration storage from day one.
2. **`commands/configure.ts`** — Depends only on config. First command to implement; allows setting up credentials for testing everything else.
3. **`lib/git.ts`** — No external dependencies (only execa). Core infrastructure.
4. **`services/worktree.ts`** — Depends on `lib/git.ts`. Can be built and tested independently.
5. **`services/jira.ts`** — Depends on `lib/config.ts` and `jira.js`. Buildable once config works.
6. **`commands/create.ts`** — Depends on both services + prompts. Core feature.
7. **`commands/list.ts`** — Depends on both services.
8. **`commands/switch.ts`** — Depends on `services/worktree.ts`, minimal JIRA dependency.
9. **`commands/delete.ts`** — Depends on `services/worktree.ts`.

## Sources

- [jira.js TypeScript JIRA Cloud client](https://mrrefactoring.github.io/jira.js/) — official docs, authentication and issue fetch API
- [execa — process execution for Node.js](https://github.com/sindresorhus/execa) — git subprocess wrapper
- [Commander.js + TypeScript CLI guide](https://blog.logrocket.com/building-typescript-cli-node-js-commander/) — project structure patterns
- [@clack/prompts vs Inquirer comparison](https://dev.to/chengyixu/clackprompts-the-modern-alternative-to-inquirerjs-1ohb) — interactive prompt recommendation
- [agenttools/worktree — reference TypeScript worktree CLI](https://github.com/agenttools/worktree) — real-world structural reference
- [xdg-app-paths — XDG config directory](https://www.npmjs.com/package/xdg-app-paths/v/7.3.0) — config file storage convention
- [git worktree --porcelain docs](https://git-scm.com/docs/git-worktree) — stable machine-readable output format

---
*Architecture research for: TypeScript CLI with git worktree + JIRA Cloud integration (mafcli)*
*Researched: 2026-04-02*
