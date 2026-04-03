---
phase: quick
plan: 260403-dvk
type: execute
wave: 1
depends_on: []
files_modified:
  - src/commands/switch.ts
  - src/commands/setup.ts
  - src/commands/create.ts
  - src/commands/list.ts
  - src/commands/remove.ts
  - src/commands/pick.ts
  - src/index.ts
  - src/commands/switch.test.ts
  - src/commands/setup.test.ts
  - src/commands/create.test.ts
  - src/commands/list.test.ts
  - src/commands/remove.test.ts
  - src/commands/pick.test.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "mafcli switch (TTY) prints hint to stderr about 'mafcli setup'"
    - "mafcli switch temp file is written with mode 0o600"
    - "mafcli setup prints installation instructions to stderr (stdout stays clean for >>)"
    - "mafcli create shows branch name and worktree path preview before creating"
    - "mafcli list shows ✓ (green) for clean and ✗ (red) for dirty, not the words"
    - "mafcli remove --force on dirty worktree shows confirm prompt; --yes skips it"
    - "mafcli pick shows '50 tickets' note when exactly 50 results returned"
    - "mafcli create --help mentions both JIRA and manual modes"
    - "All vitest tests pass"
  artifacts:
    - path: "src/commands/switch.ts"
      provides: "TTY hint on stderr + file mode 0o600"
    - path: "src/commands/setup.ts"
      provides: "Installation instructions to stderr before stdout function"
    - path: "src/commands/create.ts"
      provides: "Preview line before worktree creation"
    - path: "src/commands/list.ts"
      provides: "✓/✗ symbols instead of clean/dirty text"
    - path: "src/commands/remove.ts"
      provides: "Dirty confirmation prompt + --yes flag"
    - path: "src/commands/pick.ts"
      provides: "50-result note after spinner"
    - path: "src/index.ts"
      provides: "Updated program description with examples"
  key_links:
    - from: "src/commands/remove.ts"
      to: "@clack/prompts confirm"
      via: "p.confirm() call gated on isDirty && opts.force && !opts.yes"
      pattern: "p\\.confirm"
---

<objective>
UX improvements batch across 7 command files: better feedback, safer defaults, cleaner output.

Purpose: Reduce friction and improve discoverability for daily CLI use.
Output: Updated command files with improved output + passing tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Output and display improvements (switch, setup, create, list, pick, index)</name>
  <files>
    src/commands/switch.ts,
    src/commands/setup.ts,
    src/commands/create.ts,
    src/commands/list.ts,
    src/commands/pick.ts,
    src/index.ts
  </files>
  <action>
Apply 6 independent output/display changes across 6 files:

**switch.ts** — two changes:
1. After `fs.writeFileSync(switchFilePath(), targetPath)`, add:
   ```ts
   if (process.stdout.isTTY) {
     process.stderr.write("Tip: run 'mafcli setup' and add the shell function to ~/.zshrc for cd support\n");
   }
   ```
2. Pass `{ mode: 0o600 }` as third arg to `fs.writeFileSync`:
   ```ts
   fs.writeFileSync(switchFilePath(), targetPath, { mode: 0o600 });
   ```

**setup.ts** — before `process.stdout.write(SHELL_WRAPPER)`, add:
```ts
process.stderr.write('Add the following to ~/.zshrc (or ~/.bashrc), then run: source ~/.zshrc\n');
```
This keeps stdout clean so `mafcli setup >> ~/.zshrc` captures only the function.

**create.ts** — after computing `worktreePath` and `branch` (in both the JIRA path and the manual path), print a preview line before the spinner starts:
```ts
process.stderr.write(`Creating: ${branch}  →  ${worktreePath}\n`);
```
Add this line immediately before each `spinner.start(...)` call in both code paths (JIRA path: after `const branch = \`${type}/${ticketSlug}\``, manual path: after `const branch = \`${type}/${cleanSlug}\``).

**list.ts** — change the `dirtyLabel` line (line ~99):
```ts
const dirtyLabel = isDirty ? chalk.red('✗  ') : chalk.green('✓  ');
```
Use 2 spaces after symbol to keep column width at 5 chars total (matching the original 'dirty  '/'clean  ' 7-char columns is not critical — use 3 chars padded to match spacing). Keep the padEnd(8) on the `'status'` header since it still aligns. Actually: replace `dirtyLabel` assignment only — do not change header or separator width since ✓/✗ render as 1 char. Pad to 7: `chalk.red('✗      ')` and `chalk.green('✓      ')` (6 trailing spaces to match 'dirty  ' width). Test visually and adjust — the key requirement is symbols replace words.

**pick.ts** — after `spinner.stop(...)` (line ~21) and inside the success branch, add:
```ts
if (issues.length === 50) {
  process.stderr.write('Showing first 50 tickets (most recently updated)\n');
}
```
Place this immediately after `spinner.stop(...)`, before the empty state check.

**index.ts** — update program description and create command:
1. Change `.description('Git worktree manager with JIRA integration')` to:
   `.description('Git worktree manager with JIRA integration\n\nExamples:\n  mafcli create PROJ-123 feature   # create worktree from JIRA ticket\n  mafcli pick                       # interactively pick assigned ticket\n  mafcli switch                     # switch between worktrees\n  mafcli list                       # show all worktrees')`

The create command description update is done in create.ts: change `.description('Create a worktree with branch {type}/{slug}')` to:
   `.description('Create a worktree — JIRA key (PROJ-123) or manual slug, branch {type}/{slug}')`
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/commands/switch.test.ts src/commands/setup.test.ts src/commands/create.test.ts src/commands/list.test.ts src/commands/pick.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    All 5 test files pass (tests may still assert old text — those will be fixed in Task 3).
    Files modified compile without TypeScript errors: npx tsc --noEmit exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 2: remove.ts dirty confirmation prompt and --yes flag</name>
  <files>src/commands/remove.ts</files>
  <action>
Add `--yes` option and a confirmation prompt when `--force` is used on a dirty worktree.

1. Add `--yes` option to the command:
   ```ts
   .option('--force', 'Delete even if worktree has uncommitted changes')
   .option('--yes', 'Skip confirmation prompts (for scripts)')
   ```
   Update the action signature to include `yes` in opts: `opts: { force?: boolean; yes?: boolean }`.

2. Change the dirty-worktree block. Currently (lines 32-35):
   ```ts
   if (isDirty && !opts.force) {
     p.cancel(`Worktree '${name}' has uncommitted changes. Use --force to delete anyway.`);
     process.exit(1);
   }
   ```
   Replace with:
   ```ts
   if (isDirty && !opts.force) {
     p.cancel(`Worktree '${name}' has uncommitted changes. Use --force to delete anyway.`);
     process.exit(1);
   }
   if (isDirty && opts.force && !opts.yes) {
     const confirmed = await p.confirm({
       message: `Remove dirty worktree '${name}'? (y/N)`,
       initialValue: false,
     });
     if (p.isCancel(confirmed) || !confirmed) {
       p.cancel('Aborted.');
       process.exit(1);
     }
   }
   ```
   Place the new block immediately after the existing dirty-block exit. Clean worktrees proceed without any prompt.

3. Import `confirm` and `isCancel` from `@clack/prompts` at the top of the file (add to existing `import * as p from '@clack/prompts'` — since the namespace import is used, `p.confirm` and `p.isCancel` work automatically, no import change needed).
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/commands/remove.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    Existing remove tests still pass (clean delete, dirty-block, force-dirty, not-found, branch-delete-failure).
    New behavior: --force on dirty prompts; --force --yes skips prompt (tested in Task 3).
  </done>
</task>

<task type="auto">
  <name>Task 3: Update test assertions for all changed behaviors</name>
  <files>
    src/commands/switch.test.ts,
    src/commands/setup.test.ts,
    src/commands/create.test.ts,
    src/commands/list.test.ts,
    src/commands/remove.test.ts,
    src/commands/pick.test.ts
  </files>
  <action>
Update test files to match the new output and add new behavior tests.

**switch.test.ts:**
- Add new test in "direct name arg" describe: `TTY HINT: when process.stdout.isTTY is true, writes hint to stderr after writing temp file`.
  Mock `process.stdout.isTTY` to `true`, run `switch my-feat`, verify `stderrSpy` was called with a string containing `'mafcli setup'`.
- Add test: `FILE MODE: temp file is written with mode 0o600`. Spy on `fs.writeFileSync` and assert it was called with `{ mode: 0o600 }` as third arg.
- Add test: `NO TTY HINT: when process.stdout.isTTY is false/undefined, no hint written`. Set `process.stdout.isTTY` to `false`, verify stderrSpy not called (or not called with 'setup').

**setup.test.ts:**
- The existing `INSTALL INSTRUCTIONS` test checks output on stdout. Fix it: the instructions are now on stderr. Update the test to spy on `process.stderr.write` and assert it contains `.zshrc` or `.bashrc`, separate from the stdout spy.
- Add test: `STDERR INSTRUCTIONS: instructions written to stderr before stdout function`. Assert stderr contains `'source ~/.zshrc'` or `'Add the following'`.
- Add test: `STDOUT ONLY: stdout contains only the shell function, not the instruction text`. Assert stdout does NOT contain `'Add the following'`.

**create.test.ts:**
- Add test: `JIRA PREVIEW: prints branch and path to stderr before spinner starts for JIRA path`. Setup JIRA mock, run `create PROJ-123 feature`, spy on `process.stderr.write`, assert it was called with a string containing the branch name and worktree path before `mockSpinnerStart` was called.
- Add test: `MANUAL PREVIEW: prints branch and path to stderr before spinner starts for manual path`. Similar for manual slug path.

**list.test.ts:**
- In `1. CLEAN WORKTREE ROW` test: change `expect(output).not.toMatch(/dirty/)` to also assert `expect(output).toContain('✓')`.
- Remove the assertion `expect(output).not.toMatch(/dirty/)` only if it now conflicts — the text 'dirty' should no longer appear, so this assertion can remain valid. Add `expect(output).toContain('✓')`.
- In `2. DIRTY WORKTREE ROW` test: change `expect(output).toMatch(/dirty/)` to `expect(output).toContain('✗')`. Remove the `/dirty/` pattern match.

**remove.test.ts:**
- Add mock for `p.confirm` and `p.isCancel` in the existing `@clack/prompts` mock block:
  ```ts
  const mockConfirm = vi.fn();
  const mockIsCancel = vi.fn();
  vi.mock('@clack/prompts', () => ({
    cancel: (...args: unknown[]) => mockCancel(...args),
    note: (...args: unknown[]) => mockNote(...args),
    spinner: vi.fn(() => ({ start: mockSpinnerStart, stop: mockSpinnerStop })),
    confirm: (...args: unknown[]) => mockConfirm(...args),
    isCancel: (...args: unknown[]) => mockIsCancel(...args),
  }));
  ```
  Add `mockConfirm.mockClear()` and `mockIsCancel.mockClear()` to `beforeEach`.
- Update `FORCE DIRTY` test: add `mockConfirm.mockResolvedValue(true)` and `mockIsCancel.mockReturnValue(false)` in setup — the test currently passes `--force` on dirty; now confirm is shown and must be accepted.
- Add new test `FORCE DIRTY CONFIRM ABORT: --force on dirty shows confirm; user says no → exit(1), gitWorktreeRemove NOT called`. Set dirty=true, opts.force=true, mockConfirm returns false (or isCancel returns true).
- Add new test `FORCE DIRTY YES FLAG: --force --yes on dirty skips confirm and deletes`. Set dirty=true, `['remove', 'my-feat', '--force', '--yes']`. Assert mockConfirm NOT called, mockGitWorktreeRemove IS called.

**pick.test.ts:**
- Add test `50 TICKETS NOTE: when issues.length === 50, stderr note written`. Mock `fetchAssignedIssues` to return an array of 50 issues, spy on `process.stderr.write`, assert it was called with a string containing `'50 tickets'` or `'first 50'`.
- Add test `NOT 50 TICKETS: when issues.length !== 50 (e.g. 2), no note written`. Assert stderr NOT called with '50 tickets'.
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/commands/ 2>&1 | tail -30</automated>
  </verify>
  <done>
    All command test files pass with zero failures.
    New tests cover: TTY hint, file mode, setup stderr split, create preview, list symbols, remove confirm/--yes, pick 50-note.
  </done>
</task>

</tasks>

<verification>
Full test suite passes:

```bash
cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run 2>&1 | tail -20
```

TypeScript compiles clean:

```bash
cd /Users/jpisa/Development/Claude/mafin-cli && npx tsc --noEmit
```
</verification>

<success_criteria>
- `npx vitest run` exits 0 with all tests passing
- `npx tsc --noEmit` exits 0
- `mafcli list` output uses ✓/✗ symbols (visual check via build)
- `mafcli setup 2>/dev/null | head -1` shows the shell function line (not instructions)
- `mafcli setup 2>&1 >/dev/null | head -1` shows the install instructions
</success_criteria>

<output>
After completion, create `.planning/quick/260403-dvk-ux-improvements-batch/260403-dvk-SUMMARY.md`
</output>
