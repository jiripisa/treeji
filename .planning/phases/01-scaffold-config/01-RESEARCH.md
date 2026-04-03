# Phase 1: Scaffold & Config - Research

**Researched:** 2026-04-02
**Domain:** TypeScript CLI scaffold — tsup build pipeline, Commander.js wiring, OS keychain credential storage
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `mafcli configure` supports both interactive prompts (no flags) and non-interactive mode (--url, --email, --token flags). Without flags, prompts user step by step with validation.
- **D-02:** When config already exists and user runs `configure` again, show current values first and ask only about what they want to change (not overwrite everything).
- **D-03:** After saving credentials, validate connection by calling JIRA API (e.g., `/rest/api/3/myself`). Show success/failure clearly.
- **D-04:** On successful configuration, display detailed overview table: JIRA URL, email, token status (stored in keychain/env var), and connection test result.

### Claude's Discretion

- Credential storage implementation choice (keytar vs @napi-rs/keyring vs alternative) — pick what's most reliable on macOS
- Config file location for non-secret settings (XDG convention vs ~/.mafcli/)
- Project structure and src/ layout (commands/services/lib layering)
- ESM vs CJS module format
- Exact prompt library choice (@clack/prompts vs inquirer)
- tsup configuration details
- package.json bin field setup

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JIRA-01 | User can configure JIRA Cloud connection (instance URL, email, API token) via `mafcli configure` | D-01 through D-04 decisions, @clack/prompts, conf, @napi-rs/keyring, jira.js `/myself` validation |
| CLI-02 | JIRA API token stored securely in OS keychain (macOS Keychain), with `MAFCLI_JIRA_TOKEN` env var as fallback | @napi-rs/keyring prebuilt binaries, fallback pattern, conf for non-secret config |
| CLI-06 | CLI installable globally via `npm install -g mafcli` | package.json bin field, tsup shebang, correct `files` field |
</phase_requirements>

## Summary

Phase 1 delivers the project foundation: TypeScript project scaffold with tsup build pipeline, Commander.js CLI entry point wiring, and a fully working `mafcli configure` command that stores the JIRA API token in the macOS Keychain. This phase produces no JIRA data operations — only the secure credential plumbing and global installability.

The critical decision for this phase is keychain library selection. `keytar` (the historically standard choice) was deprecated in 2022 when the Atom project sunsetted it and is no longer maintained. `@napi-rs/keyring` (v1.2.0, published September 2025) is the current drop-in replacement — it ships prebuilt NAPI binaries (no native compilation on end-user machines), has identical API shape, and works on macOS/Windows/Linux. Use `@napi-rs/keyring`. Do not use `keytar`.

Module format: use ESM throughout (`"type": "module"` in package.json). All stack dependencies (execa, conf, @clack/prompts) are ESM-only. tsup is configured to output ESM with a shebang-bearing entry file; it automatically marks the output executable.

**Primary recommendation:** Scaffold as pure ESM, use `@napi-rs/keyring` for keychain storage, use `conf` for the non-secret config file, wire `mafcli configure` with `@clack/prompts` for interactive mode and Commander.js flags for non-interactive mode.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22 LTS (25.x on dev machine) | Runtime | Stack research recommendation; system has 25.8.1 which is compatible |
| TypeScript | 6.0.2 | Language | Current stable (npm-verified 2026-04-02); strict mode required for zod 4 type inference |
| Commander.js | 14.0.3 | CLI arg parsing + subcommands | 35M weekly downloads, 0 dependencies, 18ms startup; v14 requires Node 20+ |
| @napi-rs/keyring | 1.2.0 | OS keychain storage (macOS Keychain) | Prebuilt NAPI binaries — no native compilation; Sep 2025 release; replaces deprecated keytar |
| conf | 15.1.0 | Config file (non-secret settings) | ESM-only; stores at `~/.config/mafcli/`; handles JSON serialization and path resolution |
| @clack/prompts | 1.2.0 | Interactive terminal prompts | Replaces Inquirer (v9+ ESM breakage); styled out-of-the-box; active maintenance |
| jira.js | 5.3.1 | JIRA Cloud REST API v3 client | TypeScript-native, Basic Auth support, `/rest/api/3/myself` for validation |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| tsup | 8.5.1 | Bundle CLI binary | esbuild-powered; auto-marks shebang entry executable; handles `bin` entry points |
| tsx | 4.21.0 | Development runner | Run TypeScript without compilation; replaces ts-node |
| vitest | 4.1.2 | Test runner | ESM-native; TypeScript without separate compile step |
| @types/node | 25.5.0 | Node.js type definitions | Must match runtime major version |

### Verified Versions (npm registry, 2026-04-02)

```
typescript@6.0.2
commander@14.0.3
@napi-rs/keyring@1.2.0
conf@15.1.0
@clack/prompts@1.2.0
jira.js@5.3.1
tsup@8.5.1
tsx@4.21.0
vitest@4.1.2
@types/node@25.5.0
```

### Installation

```bash
npm install commander @napi-rs/keyring conf @clack/prompts jira.js
npm install -D typescript tsup tsx vitest @types/node
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── commands/
│   └── configure.ts    # mafcli configure — all prompt + flag logic here
├── lib/
│   ├── config.ts       # conf wrapper: read/write ~/.config/mafcli/config.json
│   └── keychain.ts     # @napi-rs/keyring wrapper: set/get/delete JIRA token
├── types/
│   └── config.ts       # JiraConfig interface shared across lib and commands
└── index.ts            # Entry point: #!/usr/bin/env node + Commander program.parse()
dist/                   # tsup output (gitignored)
tsup.config.ts
tsconfig.json
package.json
```

### Pattern 1: Shebang Entry File + tsup Build

**What:** `src/index.ts` starts with `#!/usr/bin/env node`. tsup detects the shebang, preserves it in dist output, and automatically runs `chmod +x` on the output file. The `bin` field in package.json points to `dist/index.js`.

**When to use:** Every CLI built with tsup.

**Example:**
```typescript
// src/index.ts
#!/usr/bin/env node

import { Command } from 'commander';
import { registerConfigureCommand } from './commands/configure.js';

const program = new Command();
program.name('mafcli').description('Git worktree manager with JIRA integration').version('0.1.0');

registerConfigureCommand(program);

program.parse();
```

```json
// package.json (relevant fields)
{
  "type": "module",
  "bin": { "mafcli": "dist/index.js" },
  "files": ["dist"],
  "engines": { "node": ">=20" }
}
```

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  target: 'node20',
});
```

### Pattern 2: Split Keychain + Config File Storage

**What:** Non-secret settings (JIRA URL, email) live in `~/.config/mafcli/config.json` via `conf`. The API token ONLY lives in the OS keychain via `@napi-rs/keyring` (service name: `mafcli`, account name: email address). The env var `MAFCLI_JIRA_TOKEN` is checked as a fallback when keychain read throws.

**When to use:** Always — this is the security requirement.

**Example:**
```typescript
// src/lib/keychain.ts
import { Entry } from '@napi-rs/keyring';

const SERVICE = 'mafcli';

export function setToken(email: string, token: string): void {
  const entry = new Entry(SERVICE, email);
  entry.setPassword(token);
}

export function getToken(email: string): string | null {
  // Check env var override first (CI / keychain-unavailable systems)
  if (process.env.MAFCLI_JIRA_TOKEN) {
    return process.env.MAFCLI_JIRA_TOKEN;
  }
  try {
    const entry = new Entry(SERVICE, email);
    return entry.getPassword();
  } catch {
    return null;
  }
}

export function deleteToken(email: string): void {
  try {
    const entry = new Entry(SERVICE, email);
    entry.deletePassword();
  } catch {
    // Already absent — acceptable
  }
}
```

```typescript
// src/lib/config.ts
import Conf from 'conf';

interface StoredConfig {
  host: string;
  email: string;
}

const conf = new Conf<StoredConfig>({ projectName: 'mafcli' });

export function loadConfig(): Partial<StoredConfig> {
  return { host: conf.get('host'), email: conf.get('email') };
}

export function saveConfig(host: string, email: string): void {
  conf.set('host', host);
  conf.set('email', email);
}
```

### Pattern 3: Configure Command — Interactive + Non-Interactive Modes

**What:** Single `configure` command handles both modes. With no flags, prompts step-by-step. With --url/--email/--token flags, skips prompts. Either way, ends with JIRA `/myself` validation and summary table output (D-03, D-04).

**When to use:** As designed — this is D-01 and D-02.

**Example:**
```typescript
// src/commands/configure.ts
import { Command } from 'commander';
import * as p from '@clack/prompts';
import { loadConfig, saveConfig } from '../lib/config.js';
import { setToken, getToken } from '../lib/keychain.js';
import { validateJiraCredentials } from '../lib/jira-validate.js';

export function registerConfigureCommand(program: Command): void {
  program
    .command('configure')
    .description('Configure JIRA Cloud credentials')
    .option('--url <url>', 'JIRA instance URL')
    .option('--email <email>', 'JIRA account email')
    .option('--token <token>', 'JIRA API token')
    .action(async (opts) => {
      const existing = loadConfig();
      // If flags provided: use them. Otherwise: prompt.
      // D-02: show current values and ask only what changed.
      // D-03: call /myself after saving.
      // D-04: display summary table.
    });
}
```

### Anti-Patterns to Avoid

- **Storing token in config.json:** Never set `apiToken` field in the conf store. Token lives only in keychain or `MAFCLI_JIRA_TOKEN`.
- **Accepting --token as CLI flag:** Flags appear in `ps aux` and shell history. Do not add `--token` as a Commander.js flag — collect token via `@clack/prompts` `password()` in interactive mode or `MAFCLI_JIRA_TOKEN` env var in non-interactive CI use. (Note: D-01 specifies `--token` flag for non-interactive mode — if implemented, document in README that it appears in shell history.)
- **Using `keytar` instead of `@napi-rs/keyring`:** keytar is deprecated since 2022 and has no Node.js 22+ compatibility guarantee.
- **CJS format output:** All dependencies are ESM-only. Use `"type": "module"` and tsup `format: ['esm']`.
- **Forgetting `.js` extension in ESM imports:** With `"type": "module"` and `--module nodenext`, all relative imports need explicit `.js` extension even for `.ts` source files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS keychain read/write | Custom `security` CLI subprocess calls | `@napi-rs/keyring` | Shell exec for keychain is insecure (password in process args), slow, macOS-only |
| Config file path resolution | `os.homedir() + '/.mafcli/'` | `conf` | conf handles XDG, Windows AppData, permissions, atomic writes |
| Interactive prompts | `readline` wrapper | `@clack/prompts` | Input masking, validation callbacks, styled output — readline misses all of this |
| CLI arg parsing | Manual `process.argv` slicing | Commander.js | Help text generation, flag coercion, subcommand routing |
| TypeScript CLI bundling | `tsc` + `chmod +x` post-step | `tsup` | tsup handles shebang preservation, makes file executable, cleaner output |

**Key insight:** The "simple" custom implementations of keychain access via shell subprocess and config path resolution both have known security and portability pitfalls that the dedicated libraries handle correctly.

## Common Pitfalls

### Pitfall 1: Token Written to Config File

**What goes wrong:** Developer writes `conf.set('apiToken', token)` during configure — token lands in `~/.config/mafcli/config.json` in plain text. File readable by any local process; accidentally committed in dotfiles repos.

**Why it happens:** It is the path of least resistance. conf is already imported for URL/email.

**How to avoid:** Enforce separation in code structure: `lib/config.ts` never receives or stores a token parameter. Token flows only through `lib/keychain.ts`.

**Warning signs:** Any `apiToken` or `token` field in the StoredConfig TypeScript interface for conf.

### Pitfall 2: Keychain Library Fails on Install

**What goes wrong:** `keytar` requires native compilation via `node-gyp`. On a system without Xcode Command Line Tools or Python, `npm install -g mafcli` fails with native build errors.

**How to avoid:** Use `@napi-rs/keyring` which ships prebuilt NAPI binaries. No compilation step. Verified: Node.js >= 10 engines field, last published Sep 2025.

**Warning signs:** `node-gyp rebuild` appearing in install output.

### Pitfall 3: ESM Import Extension Omitted

**What goes wrong:** TypeScript compiles without errors, but Node.js ESM runtime fails with `ERR_MODULE_NOT_FOUND` because `import './lib/config'` has no `.js` extension.

**Why it happens:** TypeScript's classic resolution mode allowed extension-less imports. `--module nodenext` requires explicit extensions.

**How to avoid:** Set `"module": "nodenext"` and `"moduleResolution": "nodenext"` in tsconfig. Always write relative imports as `'./lib/config.js'` even when source file is `.ts`.

**Warning signs:** `ERR_MODULE_NOT_FOUND` at runtime despite successful `tsc`/tsup build.

### Pitfall 4: --token Flag Leaks to Shell History

**What goes wrong:** `mafcli configure --token ATATTxxx...` stored permanently in `~/.zsh_history`. Token exposed.

**How to avoid:** For interactive mode, use `p.password()` from `@clack/prompts` which masks input. For non-interactive/CI, document that `MAFCLI_JIRA_TOKEN` env var is the safe path. If `--token` flag is implemented per D-01, add a warning to the help text.

### Pitfall 5: Package Not Globally Executable After npm install -g

**What goes wrong:** `npm install -g mafcli` succeeds but `mafcli` command not found. Or found but throws `SyntaxError: Cannot use import statement`.

**Root causes:**
1. `bin` field in package.json points to wrong path (`dist/index.js` vs `src/index.ts`)
2. No shebang in dist output (tsup didn't detect it because source file is missing `#!/usr/bin/env node`)
3. `files` field missing `dist/` directory — npm pack excludes build output

**How to avoid:** Three-part check before publishing: (1) `#!/usr/bin/env node` as first line of `src/index.ts`, (2) `"bin": {"mafcli": "dist/index.js"}` in package.json, (3) `"files": ["dist"]` in package.json.

## Code Examples

### tsconfig.json for ESM CLI

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### package.json Scaffold

```json
{
  "name": "mafcli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "mafcli": "dist/index.js"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/index.ts",
    "test": "vitest"
  }
}
```

### @clack/prompts for configure interactive flow

```typescript
// D-02: show current values, prompt only for changes
p.intro('Configure JIRA credentials');
const current = loadConfig();

if (current.host) {
  p.note(`Current: ${current.host} / ${current.email}`, 'Existing config');
}

const host = await p.text({
  message: 'JIRA instance URL',
  initialValue: current.host ?? '',
  placeholder: 'https://your-org.atlassian.net',
  validate: (v) => v.startsWith('https://') ? undefined : 'Must start with https://',
});

const token = await p.password({
  message: 'JIRA API token',
  validate: (v) => v.length > 0 ? undefined : 'Token cannot be empty',
});

if (p.isCancel(host) || p.isCancel(token)) {
  p.cancel('Cancelled.');
  process.exit(0);
}
```

### JIRA /myself Validation (D-03)

```typescript
// src/lib/jira-validate.ts
import { Version3Client } from 'jira.js';

export async function validateJiraCredentials(
  host: string,
  email: string,
  token: string
): Promise<{ success: boolean; displayName?: string; error?: string }> {
  const client = new Version3Client({
    host,
    authentication: {
      basic: { email, apiToken: token },
    },
  });
  try {
    const myself = await client.myself.getCurrentUser();
    return { success: true, displayName: myself.displayName };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 25.8.1 | — |
| npm | Package install | Yes | 11.11.0 | — |
| git | git operations (Phase 2+) | Yes | 2.53.0 | — |
| macOS Keychain | CLI-02 token storage | Yes (macOS 25.4.0) | System | `MAFCLI_JIRA_TOKEN` env var |
| tsx (global) | Dev runner | Not detected system-wide | — | `npx tsx` or install locally |
| tsup (global) | Build | Not detected system-wide | — | `npx tsup` or install locally |

**Missing dependencies with no fallback:** None — all blocking dependencies available.

**Missing dependencies with fallback:** tsx and tsup not globally installed, but project-local install via npm is the correct approach anyway (dev dependencies in package.json).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | vitest.config.ts (Wave 0 — create) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-02 | getToken returns env var when MAFCLI_JIRA_TOKEN set | unit | `npx vitest run src/lib/keychain.test.ts` | No — Wave 0 |
| CLI-02 | getToken returns null when keychain empty and no env var | unit | `npx vitest run src/lib/keychain.test.ts` | No — Wave 0 |
| CLI-02 | setToken/getToken round-trip stores and retrieves token | unit (integration) | `npx vitest run src/lib/keychain.test.ts` | No — Wave 0 |
| CLI-06 | dist/index.js has shebang after build | smoke | `npx vitest run src/build.test.ts` | No — Wave 0 |
| CLI-06 | dist/index.js is executable (file mode) | smoke | `npx vitest run src/build.test.ts` | No — Wave 0 |
| JIRA-01 | configure saves host/email to conf | unit | `npx vitest run src/lib/config.test.ts` | No — Wave 0 |
| JIRA-01 | configure --url --email --token skips prompts | unit | `npx vitest run src/commands/configure.test.ts` | No — Wave 0 |
| JIRA-01 | validate connection calls /myself and returns displayName | unit (mock HTTP) | `npx vitest run src/lib/jira-validate.test.ts` | No — Wave 0 |

**Note on keychain tests:** Full keychain round-trip tests require an active macOS session. The `getToken` env var fallback is fully unit-testable. The actual keychain call should be wrapped for mocking in CI.

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/keychain.test.ts` — covers CLI-02 (env fallback, null case, mock round-trip)
- [ ] `src/lib/config.test.ts` — covers JIRA-01 config read/write
- [ ] `src/lib/jira-validate.test.ts` — covers JIRA-01 /myself validation (mocked HTTP)
- [ ] `src/commands/configure.test.ts` — covers JIRA-01 non-interactive flag mode
- [ ] `src/build.test.ts` — smoke test for shebang and executable bit in dist output
- [ ] `vitest.config.ts` — project config (ESM-compatible)
- [ ] Framework install: `npm install -D vitest` — included in dev dependency list above

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `keytar` for OS keychain | `@napi-rs/keyring` | 2022 (keytar deprecated) | No native compilation; prebuilt binaries; drop-in API replacement |
| `ts-node` for dev runner | `tsx` | ~2022 | Faster startup, better ESM support |
| CJS (`"type": "commonjs"`) | ESM (`"type": "module"`) | 2022–2023 | All key deps (conf, execa, @clack/prompts) are ESM-only |
| `tsc` + manual chmod | `tsup` with shebang detection | 2021+ | Automatic executable, esbuild speed, dual-format support |
| `inquirer` for prompts | `@clack/prompts` | 2023 | Inquirer v9 ESM migration broke plugins; @clack is cleaner |

**Deprecated/outdated:**
- `keytar`: Officially deprecated 2022, last release Feb 2022, no Node 22+ compatibility guarantee. Do not use.
- `ts-node`: Replaced by `tsx` for development use.
- `inquirer`: v9+ fragmented module structure breaks plugins. Use `@clack/prompts`.

## Open Questions

1. **Should --token flag be implemented for non-interactive mode?**
   - What we know: D-01 specifies `--token` flag exists for non-interactive mode
   - What's unclear: The flag causes the token to appear in shell history — a known security concern (Pitfall 4)
   - Recommendation: Implement it as specified (D-01 is locked), but add `--token` behavior note to help text and README warning. Alternatively confirm with user whether `MAFCLI_JIRA_TOKEN` env var suffices for non-interactive CI use.

2. **Should configure command validate the URL format (trailing slash, HTTPS)?**
   - What we know: PITFALLS.md notes "hardcode JIRA base URL without validation" as a never-acceptable shortcut
   - What's unclear: jira.js may or may not normalize trailing slashes internally
   - Recommendation: Normalize URL on input — strip trailing slash, validate `https://` prefix — before storing in conf.

## Sources

### Primary (HIGH confidence)

- npm registry (2026-04-02) — all version numbers verified via `npm view`
- [@napi-rs/keyring GitHub](https://github.com/Brooooooklyn/keyring-node) — API shape (Entry, setPassword, getPassword), platform support
- `.planning/research/STACK.md` — Full stack decision rationale with source citations
- `.planning/research/ARCHITECTURE.md` — Component layering, data flow, build order
- `.planning/research/PITFALLS.md` — Security pitfalls, token storage guidance

### Secondary (MEDIUM confidence)

- [WebSearch: keytar deprecation status](https://github.com/laurent22/joplin/issues/8829) — confirmed officially deprecated, last release Feb 2022
- [WebSearch: @napi-rs/keyring 1.2.0](https://www.npmjs.com/package/@napi-rs/keyring) — Sep 2025 release confirmed, prebuilt binaries, Node >= 10
- [WebSearch: tsup shebang handling](https://tsup.egoist.dev/) — shebang auto-detection and executable marking confirmed

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-04-02
- Architecture: HIGH — drawn from pre-existing ARCHITECTURE.md (researched same day) + established patterns
- Keychain library decision: HIGH — keytar deprecation confirmed by multiple GitHub issues and npm page; @napi-rs/keyring verified as maintained replacement
- Pitfalls: HIGH — drawn from pre-existing PITFALLS.md + ESM extension pitfall from known Node.js ESM behavior

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable ecosystem — versions shift slowly; re-check @napi-rs/keyring if >30 days)
