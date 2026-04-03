# Phase 2: Git Worktree Core - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Git worktree CRUD operations (create, list, remove, switch) using manual input — no JIRA API calls. All commands work offline. Phase 3 wires JIRA into the create command.

</domain>

<decisions>
## Implementation Decisions

### List output format
- **D-01:** `mafcli list` displays a colored table with aligned columns.
- **D-02:** Columns: branch name, dirty/clean status (colored), ahead/behind remote count, relative age of last commit, and absolute path to worktree directory.
- **D-03:** Dirty status shown in red, clean in green. Ahead/behind shown as `↑N ↓M` or similar compact format.

### Shell wrapper design
- **D-04:** `mafcli setup` prints the shell wrapper function to stdout — user copies it to .zshrc manually. Does NOT auto-append.
- **D-05:** Wrapper function named `mafcd`. Usage: `mafcd <worktree-name>` changes directory to the worktree in parent shell.
- **D-06:** Wrapper uses sentinel output pattern — `mafcli switch <name>` prints the path, `mafcd` captures it and runs `cd`.

### Create command (offline)
- **D-07:** `mafcli create <slug> <type>` — manually specified slug and branch type (feature, bugfix, chore, etc.).
- **D-08:** Creates branch `{type}/{slug}` and worktree directory `../{slug}/`.
- **D-09:** Phase 3 will extend create to accept a JIRA ticket ID and auto-fetch the slug. The create command should be designed to support both paths.

### Remove safety
- **D-10:** If worktree has uncommitted changes (dirty), show warning and refuse to delete unless `--force` flag is passed.
- **D-11:** Clean worktrees delete immediately without confirmation. Runs `git worktree remove` + `git worktree prune` + deletes the branch.

### Claude's Discretion
- Exact table formatting library (cli-table3, chalk, or manual ANSI)
- How to detect dirty/clean status and ahead/behind counts (git porcelain commands)
- Slug validation rules (allowed characters, max length)
- How `mafcli switch` outputs the path for the shell wrapper to consume
- Test strategy for git worktree commands (temp repos in tests)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing codebase patterns
- `src/commands/configure.ts` — Established Commander.js command registration pattern
- `src/lib/keychain.ts` — Established lib module pattern (export functions, no classes)
- `src/index.ts` — CLI entry point where commands are wired

### Research
- `.planning/research/STACK.md` — execa for git subprocess calls, @clack/prompts for interactive prompts
- `.planning/research/ARCHITECTURE.md` — commands/services/lib layering, git adapter pattern
- `.planning/research/PITFALLS.md` — Shell cd constraint, slug generation edge cases, `git worktree list --porcelain` for stable parsing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/commands/configure.ts`: Commander.js command registration pattern with `registerConfigureCommand(program)`
- `src/lib/config.ts`: conf-based config read/write — can be extended for worktree metadata if needed
- `src/types/config.ts`: JiraConfig type — may need extension for worktree-related types

### Established Patterns
- ESM with `.js` extensions in imports
- Commander.js for command registration, @clack/prompts for interactive prompts
- vitest for testing with mock patterns established in configure.test.ts

### Integration Points
- `src/index.ts`: New commands (create, list, remove, switch, setup) register here via `registerXCommand(program)`
- New lib files: `src/lib/git.ts` (git adapter), `src/lib/slug.ts` (slug generation)
- New command files: `src/commands/create.ts`, `src/commands/list.ts`, `src/commands/remove.ts`, `src/commands/switch.ts`, `src/commands/setup.ts`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow established patterns from Phase 1.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-git-worktree-core*
*Context gathered: 2026-04-02*
