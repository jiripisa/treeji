---
phase: quick
plan: 260403-nip
type: execute
wave: 1
depends_on: []
files_modified:
  - src/commands/switch.ts
  - src/commands/switch.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "treeji switch exits 1 with stderr error when shell wrapper is not installed"
    - "treeji switch proceeds normally (picker / direct lookup / writes temp file) when wrapper IS installed"
    - "No TTY hint message is ever printed after a successful switch"
  artifacts:
    - path: "src/commands/switch.ts"
      provides: "Wrapper detection guard at top of action handler"
    - path: "src/commands/switch.test.ts"
      provides: "Tests for wrapper-absent and wrapper-present paths; TTY hint tests removed"
  key_links:
    - from: "switch.ts action handler"
      to: "~/.zshrc / ~/.bashrc"
      via: "fs.readFileSync + includes('treeji()')"
      pattern: "treeji\\(\\)"
---

<objective>
Guard `treeji switch` so it only works when the shell wrapper is installed.

Purpose: Without the wrapper the cd never happens — running switch silently writes a temp file the user can't act on, which is confusing. The gate surfaces the real problem (missing setup) immediately.
Output: switch.ts with wrapper check; switch.test.ts with updated tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/commands/setup.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add wrapper detection guard and remove TTY hint</name>
  <files>src/commands/switch.ts, src/commands/switch.test.ts</files>
  <behavior>
    - WRAPPER ABSENT: when neither ~/.zshrc nor ~/.bashrc contains a line with `treeji()`, action writes to stderr "treeji: shell wrapper not installed — run 'treeji setup' and add the function to ~/.zshrc\n" then exits 1. No picker, no temp file.
    - WRAPPER PRESENT (direct name): proceeds exactly as before — finds worktree, writes temp file, exits 0. No TTY hint.
    - WRAPPER PRESENT (interactive): proceeds exactly as before — shows select picker, writes temp file, exits 0. No TTY hint.
    - WRAPPER PRESENT but name not found: still exits 1 with the existing "no worktree named" message (unchanged).
    - TTY HINT: completely removed — neither the isTTY branch nor the stderr.write("Tip: ...") line remain.
  </behavior>
  <action>
**switch.ts changes:**

1. Add `os` import: `import os from 'node:os';`

2. At the top of the `.action(async (name) => {` body — before the `gitWorktreeList()` call — add:

```typescript
// Gate: shell wrapper must be installed for cd to work
const rcFiles = [
  path.join(os.homedir(), '.zshrc'),
  path.join(os.homedir(), '.bashrc'),
];
const wrapperInstalled = rcFiles.some((rc) => {
  try {
    return fs.readFileSync(rc, 'utf8').includes('treeji()');
  } catch {
    return false;
  }
});
if (!wrapperInstalled) {
  process.stderr.write(
    "treeji: shell wrapper not installed — run 'treeji setup' and add the function to ~/.zshrc\n"
  );
  process.exit(1);
}
```

3. Delete the TTY hint block (lines 63-65 in current file):
```typescript
// DELETE these three lines:
if (process.stdout.isTTY) {
  process.stderr.write("Tip: run 'treeji setup' and add the shell function to ~/.zshrc for cd support\n");
}
```

**switch.test.ts changes:**

Add `os` mock at top of file alongside the existing fs mock:

```typescript
import os from 'node:os';
vi.mock('node:os', () => ({
  default: { homedir: () => '/home/testuser' },
}));
```

Add `mockFsReadFileSync` alongside the existing mocks in both describe blocks — set it up in `beforeEach` as a spy on `fs.readFileSync`:

For **wrapper-absent tests** (new, add to both describe blocks):
- Mock `fs.readFileSync` to throw ENOENT for all rc files (simulates no .zshrc / .bashrc)
- Verify: action exits 1, stderr contains "shell wrapper not installed", temp file NOT created, `select()` NOT called (for interactive block)

For **wrapper-present tests** (update existing tests):
- Mock `fs.readFileSync` to return `'treeji() {\n  ...\n}\n'` for ~/.zshrc path, throw for ~/.bashrc
- All existing happy-path tests should pass unchanged once this mock is present in beforeEach

Remove the two TTY hint tests entirely:
- `'TTY HINT: when process.stdout.isTTY is true...'`
- `'NO TTY HINT: when process.stdout.isTTY is false...'`

The `fs.readFileSync` spy must be set up **before** `import('./switch.js')` is called (use `vi.spyOn(fs, 'readFileSync')` in beforeEach, restore in afterEach). Since `vi.resetModules()` is already called, the spy is fresh each test.

**Pattern for readFileSync mock in beforeEach (wrapper present):**
```typescript
vi.spyOn(fs, 'readFileSync').mockImplementation((filePath, ...args) => {
  if (typeof filePath === 'string' && filePath.endsWith('.zshrc')) {
    return 'treeji() {\n  echo hi\n}\n';
  }
  if (typeof filePath === 'string' && filePath.endsWith('.bashrc')) {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  }
  // For the actual temp file reads in the test assertions, call original
  return fs.readFileSync(filePath, ...args as [BufferEncoding]);
});
```

Wait — `fs.readFileSync` is also used to READ the temp file in test assertions (`fs.readFileSync(switchFilePath(), 'utf8')`). The spy must pass through calls to the temp file path. Use the conditional approach above where only rc file paths are intercepted.
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/commands/switch.test.ts 2>&1</automated>
  </verify>
  <done>
    - All switch tests pass (no failures)
    - Two TTY hint tests are gone
    - At least one new test per describe block covers the wrapper-absent exit-1 path
    - At least one new test per describe block covers the wrapper-present happy path
    - switch.ts has no isTTY branch and no "Tip: run 'treeji setup'" string
  </done>
</task>

</tasks>

<verification>
Run full test suite to confirm no regressions: `npx vitest run`
Confirm switch.ts contains `treeji()` string literal (for detection) and does NOT contain `isTTY`.
</verification>

<success_criteria>
- `treeji switch` (with no rc files present) exits 1 with a clear "shell wrapper not installed" error
- `treeji switch` (with rc file containing `treeji()`) proceeds to interactive picker or direct lookup
- Zero TTY hint messages anywhere in switch.ts
- `npx vitest run` passes
</success_criteria>

<output>
After completion, create `.planning/quick/260403-nip-switch-require-shell-wrapper/260403-nip-SUMMARY.md`
</output>
