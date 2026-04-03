<!-- GSD:project-start source:PROJECT.md -->
## Project

**mafcli**

CLI nástroj pro správu git worktrees s integrací na JIRA Cloud. Umožňuje vytvářet worktrees automaticky z JIRA ticketů (zadáním čísla nebo výběrem z přiřazených), přepínat mezi nimi, zobrazovat jejich stav a mazat je. Osobní nástroj pro jednoho vývojáře.

**Core Value:** Rychlé vytvoření worktree z JIRA ticketu jedním příkazem — bez ručního kopírování názvů, zakládání branchí a navigace po souborovém systému.

### Constraints

- **Runtime**: Node.js — TypeScript CLI (přirozená volba pro JIRA API integraci, JSON parsing, rychlý vývoj)
- **Auth**: JIRA Cloud REST API v3 s Basic Auth (email + API token)
- **Git**: Vyžaduje git s podporou worktrees (2.5+)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Runtime | Current LTS (active until April 2026, maintenance until April 2027); Node.js 24 became new LTS in Oct 2025 — either works, 22 is safer for stability |
| TypeScript | 5.8+ | Language | Current stable; 5.8 adds `--module nodenext` fixes for Node.js 22 ESM/CJS behavior; required for type-safe JIRA API responses |
| Commander.js | 14.x | CLI argument parsing | 35M weekly downloads, 180KB with 0 dependencies, 18ms startup overhead. Lightweight and standard for personal tools. v14 requires Node.js 20+ |
| jira.js | 5.2.x | JIRA Cloud REST API v3 | Only TypeScript-native JIRA client with ~100% API v3 coverage; supports Basic Auth (email + API token) which is exactly what mafcli needs; maintained actively |
| execa | 9.6.x | Git subprocess execution | Clean async subprocess execution for `git worktree` commands; better than raw `child_process` — template string syntax, no shell injection risk, ESM-only |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @clack/prompts | 1.1.x | Interactive prompts | Ticket selection from JIRA list — replaces Inquirer.js; ships beautiful styled prompts out of the box, no config needed |
| conf | 15.1.x | Config persistence | Storing JIRA credentials (URL, email, API token) in `~/.config/mafcli/`; handles JSON serialization and OS-appropriate paths |
| zod | 4.x | Schema validation | Validating JIRA API responses and config file structure; 14x faster than v3, 4.3.6 is current stable |
| chalk | 5.x | Terminal colors | Status output coloring (dirty/clean worktrees, ticket status); pure ESM, actively maintained |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| tsup | Bundle and compile | Zero-config TypeScript bundler powered by esbuild; outputs both CJS and ESM; version 8.5.1 is current. Handles `bin` entry points for CLI |
| tsx | Development runner | Run TypeScript directly without compilation step during development (`tsx src/index.ts`); faster iteration than `ts-node` |
| vitest | Testing | ESM-native test runner; works with TypeScript without separate compilation step |
## Installation
# Core
# Interactive + UX
# Validation
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Commander.js 14 | Oclif | When building a multi-command plugin-extensible CLI distributed to teams; overkill for personal tools (12MB install, 70-100ms startup vs 180KB, 18ms) |
| Commander.js 14 | Yargs | When you need middleware pipeline or complex coerce logic; heavier (850KB, 7 deps) |
| Commander.js 14 | Optique | When type-safety of parsed args is critical and you want parser composition; newer, smaller ecosystem, fewer Stack Overflow answers |
| execa | child_process directly | When you need raw process control or are already committed to sync/blocking flow — use `spawnSync` if async is unacceptable |
| execa | simple-git | simple-git has NO native worktree API methods (confirmed by reviewing the type definitions); would require calling `.raw(['worktree', 'add', ...])` anyway — same as execa but with larger dependency |
| jira.js | Atlassian REST API directly (fetch/axios) | When you want zero dependencies and only need 2-3 endpoints; valid for a simple tool but jira.js gives you typed responses for free |
| @clack/prompts | Inquirer.js | Inquirer v9+ moved to ESM-only with fragmented `@inquirer/prompts` namespace; plugin compatibility broke; @clack/prompts is cleaner and actively developed |
| conf | cosmiconfig | cosmiconfig is for per-project config files (`.toolrc.json`); conf stores user-level persistent config in OS-appropriate directories — correct choice for credentials |
| zod 4 | zod 3 | Zod 3 remains valid but 4 is the current stable release; 14x perf improvement on string parsing matters for validating API responses |
| tsup | tsc directly | tsc handles single-target output; tsup produces proper CLI binary with shebang, supports dual ESM/CJS, and is faster via esbuild |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| ts-node | Slow startup, poor ESM support, effectively replaced by tsx in development contexts | tsx for dev, tsup for production build |
| simple-git | No worktree API (confirmed); would call `.raw()` methods, defeating the purpose; execa + direct git commands is more transparent | execa with explicit `git worktree` subcommands |
| node-jira-client / jira-connector | Unmaintained or JavaScript-only without TypeScript definitions; older API coverage | jira.js (MrRefactoring) — actively maintained, typed |
| Inquirer.js | v9+ breaking ESM migration shattered plugin ecosystem; `@inquirer/prompts` has unfamiliar module structure; extra setup for what @clack/prompts does out of the box | @clack/prompts |
| vorpal | Abandoned, no TypeScript types, last release 2016 | Commander.js |
| dotenv for credentials | Credentials stored in `.env` files in project root risk accidental git commit; wrong scoping for a global personal tool | conf (stores in `~/.config/mafcli/`) |
## Stack Patterns by Variant
- Use execa to call `git worktree add`, `git worktree list --porcelain`, `git worktree remove`
- Parse porcelain output with regex — predictable, machine-readable format
- Do not abstract through simple-git since it lacks the API
- Use `Version3Client` from jira.js with Basic Auth
- Credentials stored via conf, loaded at startup
- Validate API responses with zod schemas for type safety beyond what jira.js provides
- Use `@clack/prompts` `select()` for choosing from assigned issues
- Use `text()` for branch type input
- Use `spinner()` around JIRA API calls and git operations
- Use Commander.js `.command('config')` subcommand
- Store with conf in `~/.config/mafcli/config.json`
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| commander@14 | Node.js >=20 | Requires Node 20+; commander@13 supports Node 18+ if needed |
| execa@9 | Node.js >=18, TypeScript >=5.1.6 | ESM-only; `--module nodenext` in tsconfig required |
| jira.js@5 | Node.js >=20 | ESM/CJS dual package; uses native fetch (Node 18+) |
| @clack/prompts@1 | Node.js >=18 | ESM package |
| conf@15 | Node.js >=18 | ESM-only; stores config in `os.homedir()/.config/[name]/` |
| zod@4 | TypeScript >=5.0 | Requires `strict: true` in tsconfig for full type inference |
| tsup@8 | Node.js >=18 | esbuild-powered; handles ESM output with shebang for bin entries |
## Sources
- [npmtrends: commander vs oclif vs yargs](https://npmtrends.com/commander-vs-oclif-vs-yargs) — download comparison, confirmed commander dominance (MEDIUM confidence, WebSearch)
- [jira.js npm page](https://www.npmjs.com/package/jira.js) — version 5.2.2 confirmed, Node.js 20+ requirement (MEDIUM confidence, WebSearch)
- [jira.js GitHub README](https://github.com/MrRefactoring/jira.js) — Version3Client API, Basic Auth support (MEDIUM confidence, WebSearch)
- [simple-git type definitions](https://github.com/steveukx/git-js/blob/main/simple-git/typings/simple-git.d.ts) — confirmed no worktree methods in API (HIGH confidence, WebFetch)
- [execa npm page](https://www.npmjs.com/package/execa) — version 9.6.1 confirmed (MEDIUM confidence, WebSearch)
- [commander release notes](https://github.com/tj/commander.js/releases) — version 14.0.3 confirmed, Node.js 20+ requirement (MEDIUM confidence, WebSearch)
- [@clack/prompts npm](https://www.npmjs.com/package/@clack/prompts) — version 1.1.0 confirmed (MEDIUM confidence, WebSearch)
- [tsup npm](https://www.npmjs.com/package/tsup) — version 8.5.1 confirmed (MEDIUM confidence, WebSearch)
- [conf GitHub](https://github.com/sindresorhus/conf) — version 15.1.0 confirmed, ESM-only (MEDIUM confidence, WebSearch)
- [Zod releases](https://github.com/colinhacks/zod/releases) — version 4.3.6 confirmed (MEDIUM confidence, WebSearch)
- [TypeScript 5.8 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/) — Node.js 22 compatibility notes (HIGH confidence, official docs)
- [TypeScript CLI in 2026 article](https://hackers.pub/@hongminhee/2026/typescript-cli-2026) — Optique emergence noted but ecosystem still small; Commander.js remains standard (LOW confidence, single source)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
