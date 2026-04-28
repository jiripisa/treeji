---
phase: quick-260428-lau
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/git.ts
  - src/lib/git.test.ts
  - src/lib/branch-remote.ts
  - src/lib/branch-remote.test.ts
  - src/commands/create.ts
  - src/commands/create.test.ts
  - src/commands/pick.ts
  - src/commands/pick.test.ts
autonomous: true
requirements:
  - QUICK-260428-lau
must_haves:
  truths:
    - "When `pick` or `create` (JIRA or manual) needs a local branch that does not exist locally, the tool checks whether `origin/<branch>` exists on the remote (via `git ls-remote`)."
    - "When the remote branch exists, the user is asked via `@clack/prompts` confirm whether to fetch it and create the worktree tracking `origin/<branch>`."
    - "When the user confirms, the worktree is created with the local branch tracking `origin/<branch>` (verifiable via `git rev-parse --abbrev-ref <branch>@{upstream}`)."
    - "When the user declines, no remote branch exists, or the user cancels the prompt, the existing behavior is preserved (declines/no-remote → new local branch from HEAD; cancel → exit cleanly)."
    - "`src/lib/git.ts` stays free of `@clack/prompts` calls — UI logic lives in commands or a dedicated `branch-remote` helper."
  artifacts:
    - path: "src/lib/git.ts"
      provides: "gitRemoteBranchExists + extended gitWorktreeAdd with optional fromRemote flag"
      contains: "gitRemoteBranchExists"
    - path: "src/lib/branch-remote.ts"
      provides: "maybeAdoptRemoteBranch helper (prompt + decision); shared by create.ts and pick.ts"
      contains: "maybeAdoptRemoteBranch"
    - path: "src/lib/git.test.ts"
      provides: "Unit tests for gitRemoteBranchExists and the new gitWorktreeAdd branch (fromRemote=true)"
    - path: "src/lib/branch-remote.test.ts"
      provides: "Unit tests for maybeAdoptRemoteBranch covering confirm/decline/no-remote/cancel paths"
    - path: "src/commands/create.ts"
      provides: "JIRA + manual paths call maybeAdoptRemoteBranch before gitWorktreeAdd when local branch missing"
    - path: "src/commands/pick.ts"
      provides: "Calls maybeAdoptRemoteBranch before gitWorktreeAdd when local branch missing"
  key_links:
    - from: "src/commands/create.ts"
      to: "src/lib/branch-remote.ts::maybeAdoptRemoteBranch"
      via: "import + await before gitWorktreeAdd"
      pattern: "maybeAdoptRemoteBranch"
    - from: "src/commands/pick.ts"
      to: "src/lib/branch-remote.ts::maybeAdoptRemoteBranch"
      via: "import + await before gitWorktreeAdd"
      pattern: "maybeAdoptRemoteBranch"
    - from: "src/lib/branch-remote.ts"
      to: "src/lib/git.ts::gitBranchExists + gitRemoteBranchExists"
      via: "direct function calls (no prompts in git.ts)"
      pattern: "gitRemoteBranchExists|gitBranchExists"
    - from: "src/lib/git.ts::gitWorktreeAdd"
      to: "git CLI"
      via: "execa('git', ['fetch', 'origin', branch]) + execa('git', ['worktree', 'add', '--track', '-b', branch, path, `origin/${branch}`])"
      pattern: "fetch.*origin|--track"
---

<objective>
Adopt remote branches automatically when creating worktrees. When `pick` or `create` (JIRA or manual) needs to create a worktree for a branch that does not exist locally, check whether `origin/<branch>` exists on the remote. If it does, ask the user whether to fetch and adopt it; if yes, create the worktree as a local branch that tracks `origin/<branch>`. Decline / no remote / cancel all preserve the current "new local branch from HEAD" behavior (or exit, on cancel).

Purpose: Eliminate the friction of accidentally re-creating a fresh local branch when one already exists on `origin` — a common mistake when picking up an in-flight ticket from a teammate or another machine.

Output:
- New `gitRemoteBranchExists(branch)` in `src/lib/git.ts` (uses `git ls-remote --heads origin <branch>`, sees branches that have not been fetched yet).
- Extended `gitWorktreeAdd(path, branch, opts?: { fromRemote?: boolean })` — when `fromRemote=true`, fetches origin/branch and creates worktree with `--track -b`.
- New `src/lib/branch-remote.ts` with `maybeAdoptRemoteBranch(branch)` helper that owns the prompt + decision and returns a `{ adopt: boolean }` result (or exits on user cancel — matches existing cancel idiom in `pick.ts`).
- `create.ts` (JIRA path AND manual path) and `pick.ts` call the helper before `gitWorktreeAdd` and pass `fromRemote: true` when the user confirms.
- New + updated tests covering the new git lib functions, the prompt helper, and command-level orchestration for confirm / decline / no-remote / cancel branches.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@src/lib/git.ts
@src/lib/git.test.ts
@src/commands/create.ts
@src/commands/create.test.ts
@src/commands/pick.ts
@src/commands/pick.test.ts

<interfaces>
<!-- Existing contracts the executor will integrate with. Do not re-discover. -->

From src/lib/git.ts:
```typescript
export async function gitBranchExists(branch: string): Promise<boolean>;
export async function gitBranchExistsOnRemote(branch: string): Promise<boolean>; // checks LOCAL remote-tracking cache (git branch -r), keep as-is — used by remove
export async function gitWorktreeAdd(worktreePath: string, branch: string): Promise<{ existed: boolean }>;
```

From `@clack/prompts` (already used in commands):
```typescript
function confirm(opts: { message: string; initialValue?: boolean }): Promise<boolean | symbol>;
function isCancel(value: unknown): value is symbol;
function cancel(message?: string): void;
```

Existing cancel idiom (from pick.ts step 3):
```typescript
if (p.isCancel(selected)) {
  p.cancel('Cancelled.');
  process.exit(0);
  return;
}
```

Existing error idiom (from pick.ts / create.ts catch blocks):
```typescript
const message = err instanceof Error ? err.message : String(err);
p.cancel(message);
process.exit(1);
```

Existing test mock pattern for execa (from src/lib/git.test.ts):
```typescript
vi.mock('execa', () => ({ execa: vi.fn() }));
import { execa } from 'execa';
const mockExeca = vi.mocked(execa);
// In tests:
mockExeca.mockResolvedValueOnce({ stdout: '...' } as never);
mockExeca.mockRejectedValueOnce(new Error('...'));
```

Existing branch-name semantics:
- JIRA path in `create.ts` / `pick.ts`: branch = `{type}/{ticketSlug}` or just `{ticketSlug}` (when type is empty).
- Manual path in `create.ts`: branch = `{type}/{cleanSlug}` or just `{cleanSlug}`.
- The remote-adopt logic must use the EXACT same branch string (no extra transformation) — `origin/{branch}` is what we look for and track.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend git lib — add gitRemoteBranchExists, extend gitWorktreeAdd with fromRemote option</name>
  <files>src/lib/git.ts, src/lib/git.test.ts</files>
  <action>
1. In `src/lib/git.ts`, add a new function `gitRemoteBranchExists(branch: string): Promise<boolean>`:
   - Run `git ls-remote --heads origin <branch>` via execa.
   - Return `true` when stdout (trimmed) is non-empty.
   - Return `false` when execa throws OR stdout is empty/whitespace-only.
   - Rationale: `gitBranchExistsOnRemote` (already present, uses `git branch -r --list`) only sees branches already in the local remote-tracking cache; `git ls-remote` queries origin directly and sees branches that have never been fetched. We need the latter for the new flow. Keep both functions — `gitBranchExistsOnRemote` is still used by the `remove` command for "is this branch published anywhere" semantics.
2. Extend `gitWorktreeAdd` signature to accept an optional third options arg:
   ```typescript
   export async function gitWorktreeAdd(
     worktreePath: string,
     branch: string,
     opts?: { fromRemote?: boolean },
   ): Promise<{ existed: boolean }>
   ```
   Behavior:
   - If `opts?.fromRemote === true`:
     - Run `git fetch origin <branch>` first (so the local refs/remotes/origin/<branch> ref is up to date).
     - Then run `git worktree add --track -b <branch> <worktreePath> origin/<branch>`.
     - Return `{ existed: false }` (the local branch did not exist before this call — we just created it from origin; downstream "Using existing branch" stderr message should NOT fire, which matches user expectation that adopting a remote branch is a fresh creation locally).
   - Otherwise (default — preserves current behavior exactly):
     - `existed = await gitBranchExists(branch)`
     - If existed → `git worktree add <path> <branch>`
     - Else → `git worktree add -b <branch> <path>`
     - Return `{ existed }`
3. In `src/lib/git.test.ts`:
   - Import `gitRemoteBranchExists` and add a `describe('gitRemoteBranchExists', ...)` block with cases: stdout non-empty (sha + ref line) → `true`; stdout empty → `false`; stdout whitespace → `false`; execa throws → `false`. Verify the execa call is `git ls-remote --heads origin <branch>`.
   - Extend the existing `describe('gitWorktreeAdd', ...)` block with two new tests covering `fromRemote: true`:
     - "calls git fetch origin <branch> then worktree add --track -b" — assert the two execa calls in order and `{ existed: false }` returned.
     - Optionally: when `fromRemote: true` AND fetch fails — execa rejection on first call propagates (no swallow). Use `await expect(...).rejects.toThrow()`.
   - Existing two `gitWorktreeAdd` tests (no opts) must continue to pass unchanged.

Style notes:
- Use the same try/catch + `return false` pattern as `gitBranchExists` for `gitRemoteBranchExists` (no error message swallowing surprises — caller treats absence as "do nothing special").
- Do NOT add `@clack/prompts` import to `git.ts`. UI lives in commands / branch-remote helper.
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/lib/git.test.ts</automated>
  </verify>
  <done>
- `gitRemoteBranchExists` exported from `src/lib/git.ts` and verified by 4 unit tests (true / empty / whitespace / throw).
- `gitWorktreeAdd` accepts optional `{ fromRemote }` and is verified by both legacy tests (still pass) and at least one new test for `fromRemote: true`.
- All tests in `src/lib/git.test.ts` pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add branch-remote helper (prompt + decision) with tests</name>
  <files>src/lib/branch-remote.ts, src/lib/branch-remote.test.ts</files>
  <action>
1. Create `src/lib/branch-remote.ts` with:
   ```typescript
   import * as p from '@clack/prompts';
   import { gitBranchExists, gitRemoteBranchExists } from './git.js';

   /**
    * Decide whether to adopt a remote branch when creating a worktree.
    *
    * Returns { adopt: true } if the user confirmed fetching origin/<branch> and
    * tracking it. Returns { adopt: false } in all other cases (local branch already
    * exists, no remote branch, user declined the prompt). On user cancel of the
    * prompt, this function calls `p.cancel('Cancelled.')` and `process.exit(0)`
    * — matching the existing cancel idiom in `pick.ts` (no `return` from caller
    * needed; the process exits).
    */
   export async function maybeAdoptRemoteBranch(branch: string): Promise<{ adopt: boolean }> {
     // If local branch already exists, nothing to adopt — caller's standard path handles it.
     if (await gitBranchExists(branch)) return { adopt: false };

     // Local branch missing. Is it on origin?
     if (!(await gitRemoteBranchExists(branch))) return { adopt: false };

     // It exists on origin — ask the user.
     const answer = await p.confirm({
       message: `Branch '${branch}' exists on origin. Fetch it and track origin/${branch}?`,
       initialValue: true,
     });

     if (p.isCancel(answer)) {
       p.cancel('Cancelled.');
       process.exit(0);
     }

     return { adopt: answer === true };
   }
   ```
2. Create `src/lib/branch-remote.test.ts`:
   - Mock `./git.js` with `gitBranchExists` and `gitRemoteBranchExists` as `vi.fn()`s.
   - Mock `@clack/prompts` with `confirm`, `isCancel`, `cancel` as `vi.fn()`s.
   - Tests:
     1. "local branch already exists → returns { adopt: false }, prompt NOT shown" — `gitBranchExists` resolves true, assert `confirm` not called.
     2. "remote branch missing → returns { adopt: false }, prompt NOT shown" — `gitBranchExists` false, `gitRemoteBranchExists` false, assert `confirm` not called.
     3. "user confirms → returns { adopt: true }" — both git checks negative/positive in the right way (`gitBranchExists` false, `gitRemoteBranchExists` true), `confirm` resolves `true`.
     4. "user declines → returns { adopt: false }" — same setup, `confirm` resolves `false`.
     5. "user cancels prompt → calls p.cancel('Cancelled.') and process.exit(0)" — `confirm` resolves a cancel symbol, `isCancel` returns true for that symbol; spy on `process.exit` and assert it's called with `0`. Use the same `ExitError` throw pattern already used in `pick.test.ts` so the test's promise rejects predictably.
   - Verify the prompt message contains both `${branch}` and `origin/${branch}` strings (sanity check on wording).

Style notes:
- Keep the helper SMALL — this is the only file that knows about both prompts and git lib together.
- The helper takes a single `branch: string` parameter and uses it verbatim — no transformations. The caller (create.ts / pick.ts) computes the final branch name and passes it in.
- The helper is the SOLE owner of the prompt copy. Do not duplicate the message in commands.
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/lib/branch-remote.test.ts</automated>
  </verify>
  <done>
- `src/lib/branch-remote.ts` exports `maybeAdoptRemoteBranch(branch): Promise<{ adopt: boolean }>`.
- `src/lib/branch-remote.test.ts` covers all 5 cases above and passes.
- File contains no direct execa or git command — only imports from `./git.js` and `@clack/prompts`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire helper into create.ts (JIRA + manual paths) and pick.ts; update command tests</name>
  <files>src/commands/create.ts, src/commands/pick.ts, src/commands/create.test.ts, src/commands/pick.test.ts</files>
  <action>
1. In `src/commands/create.ts`:
   - Import `maybeAdoptRemoteBranch` from `../lib/branch-remote.js`.
   - In the JIRA path, between computing `branch` (line ~31) and the spinner call to `gitWorktreeAdd` (line ~36), call:
     ```typescript
     const { adopt } = await maybeAdoptRemoteBranch(branch);
     ```
     Then pass `{ fromRemote: adopt }` to `gitWorktreeAdd`:
     ```typescript
     const { existed } = await gitWorktreeAdd(worktreePath, branch, { fromRemote: adopt });
     ```
   - Apply the same change to the manual-slug path (around line ~69) — call `maybeAdoptRemoteBranch(branch)` after computing `branch` and pass the result. Rationale: behavior is identical at the call site, and the user's "ticket flow" framing also covers manual slugs that happen to match an existing remote branch (e.g. picking up a teammate's work). This is the consistent choice.
   - Note ordering: the call to `maybeAdoptRemoteBranch` must happen BEFORE `spinner2.start(...)` (and the manual-path equivalent) — a `p.confirm` inside an active spinner corrupts the terminal output. Place it after the `Creating: ${branch}  →  ${worktreePath}` stderr write but before any `p.spinner()` start.
   - The `if (existed) process.stderr.write(...)` block stays — it correctly fires only on the legacy path (since the `fromRemote=true` branch returns `{ existed: false }`, which matches the user's mental model: a freshly-adopted remote branch is "new locally").

2. In `src/commands/pick.ts`:
   - Import `maybeAdoptRemoteBranch` from `../lib/branch-remote.js`.
   - In Step 5, between computing `branch` (line ~81) and `spinner2.start(...)` (line ~83), call:
     ```typescript
     const { adopt } = await maybeAdoptRemoteBranch(branch);
     ```
     Then pass `{ fromRemote: adopt }` to `gitWorktreeAdd`. Same reasoning re: spinner ordering.

3. Update `src/commands/create.test.ts`:
   - Add a mock for `../lib/branch-remote.js`:
     ```typescript
     const mockMaybeAdoptRemoteBranch = vi.fn();
     vi.mock('../lib/branch-remote.js', () => ({
       maybeAdoptRemoteBranch: (...args: unknown[]) => mockMaybeAdoptRemoteBranch(...args),
     }));
     ```
   - In `beforeEach`, default it to `mockMaybeAdoptRemoteBranch.mockResolvedValue({ adopt: false })` so all existing tests behave exactly as before.
   - Add new tests (one block, ~3 tests minimum):
     1. "ADOPT REMOTE (JIRA): when maybeAdoptRemoteBranch returns { adopt: true }, gitWorktreeAdd called with { fromRemote: true }" — assert third arg of `mockGitWorktreeAdd` is `{ fromRemote: true }`.
     2. "DECLINE REMOTE (JIRA): when maybeAdoptRemoteBranch returns { adopt: false }, gitWorktreeAdd called with { fromRemote: false }" — symmetric.
     3. "ADOPT REMOTE (MANUAL): manual slug path also passes { fromRemote: true } when helper returns adopt=true" — asserts the manual path got the same treatment.
   - Update the existing `gitWorktreeAdd` `expect.toHaveBeenCalledWith(...)` assertions to allow the third arg. Either:
     - Change them from `toHaveBeenCalledWith('/path', 'branch')` to `toHaveBeenCalledWith('/path', 'branch', { fromRemote: false })`, OR
     - Use `expect.objectContaining(...)` / change to assert on `mockGitWorktreeAdd.mock.calls[0]` directly.
     Pick whichever is least churn for the existing test bodies. Prefer the explicit `{ fromRemote: false }` form.

4. Update `src/commands/pick.test.ts`:
   - Mirror changes from #3 (mock `branch-remote`, default to `{ adopt: false }`, update existing `toHaveBeenCalledWith` assertions, add 2 new tests for adopt=true and adopt=false confirming the third arg passes through).

Style notes:
- Do NOT add try/catch around `maybeAdoptRemoteBranch` — it either returns or `process.exit(0)`s on cancel (the helper owns that). Errors propagate to the existing outer try/catch which already prints via `p.cancel(message)`.
- Branch name passed to `maybeAdoptRemoteBranch` is the FULL branch including type prefix (e.g. `feature/PROJ-123-fix-login`), since that's what's checked against `origin/feature/PROJ-123-fix-login`.
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/commands/create.test.ts src/commands/pick.test.ts</automated>
  </verify>
  <done>
- `create.ts` JIRA path and manual path both call `maybeAdoptRemoteBranch(branch)` before `gitWorktreeAdd`.
- `pick.ts` Step 5 calls `maybeAdoptRemoteBranch(branch)` before `gitWorktreeAdd`.
- `gitWorktreeAdd` is called with the third arg `{ fromRemote: adopt }` in all three call sites.
- `create.test.ts` and `pick.test.ts` both mock the helper, default it to `{ adopt: false }` (preserving all existing test semantics), and add new tests for adopt=true / adopt=false paths.
- Full test suite passes: `npx vitest run`.
  </done>
</task>

</tasks>

<verification>
- `npx vitest run` — all tests pass (lib + commands).
- Manual smoke (optional, not required by automated verify):
  - In a real repo: `treeji create SOME-BRANCH-THAT-EXISTS-ON-ORIGIN` (where local does not have it) → prompt appears → confirm → worktree created with `--track`. Verify with `git -C <worktree-path> rev-parse --abbrev-ref HEAD@{upstream}` returns `origin/<branch>`.
  - Decline at the prompt → existing behavior (new local branch from HEAD, no upstream).
  - For a branch that does not exist anywhere → no prompt, new local branch from HEAD (existing behavior, unchanged).
- No `@clack/prompts` import added to `src/lib/git.ts`.
</verification>

<success_criteria>
1. `gitRemoteBranchExists` exists in `src/lib/git.ts`, uses `git ls-remote --heads origin <branch>`, has 4 unit tests.
2. `gitWorktreeAdd` accepts optional `{ fromRemote?: boolean }`. When true, runs `git fetch origin <branch>` then `git worktree add --track -b <branch> <path> origin/<branch>` and returns `{ existed: false }`. Legacy path unchanged.
3. `src/lib/branch-remote.ts` exports `maybeAdoptRemoteBranch(branch)`. Local-branch-exists, no-remote, decline, confirm, cancel cases all covered by unit tests.
4. `create.ts` (both JIRA and manual paths) and `pick.ts` invoke the helper before `gitWorktreeAdd` and pass `{ fromRemote: adopt }`.
5. Command tests mock the helper, default to `{ adopt: false }` (no behavior change for existing assertions), and add coverage for both adopt=true and adopt=false.
6. UI logic (`@clack/prompts`) lives only in `branch-remote.ts` and the commands — `git.ts` stays pure.
7. `npx vitest run` is green.
</success_criteria>

<output>
After completion, create `.planning/quick/260428-lau-upravit-pick-a-create-pokud-lokalni-bran/260428-lau-SUMMARY.md` documenting:
- Files changed
- Decision: used `git ls-remote` (not `git branch -r`) — explain why (sees unfetched branches).
- Decision: applied to manual-slug path in create.ts too — explain why (consistency, identical call site).
- Test counts added.
</output>
