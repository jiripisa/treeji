---
phase: quick
plan: 260407-eaz
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/worktree-hooks.ts
  - src/lib/worktree-hooks.test.ts
  - src/commands/create.ts
  - src/commands/create.test.ts
  - src/commands/pick.ts
  - src/commands/pick.test.ts
autonomous: true
must_haves:
  truths:
    - "After worktree creation, if main repo has .idea dir, user is prompted whether to symlink it"
    - "If user confirms, a symlink .idea -> main-repo/.idea is created in the new worktree"
    - "If user declines or .idea does not exist, no symlink is created"
    - "Both create and pick commands offer the symlink prompt"
  artifacts:
    - path: "src/lib/worktree-hooks.ts"
      provides: "maybeSymlinkIdea utility function"
      exports: ["maybeSymlinkIdea"]
    - path: "src/lib/worktree-hooks.test.ts"
      provides: "Unit tests for symlink logic"
  key_links:
    - from: "src/commands/create.ts"
      to: "src/lib/worktree-hooks.ts"
      via: "import maybeSymlinkIdea"
      pattern: "maybeSymlinkIdea"
    - from: "src/commands/pick.ts"
      to: "src/lib/worktree-hooks.ts"
      via: "import maybeSymlinkIdea"
      pattern: "maybeSymlinkIdea"
---

<objective>
Add a post-worktree-creation hook that detects `.idea` directory in the main repository and prompts the user to create a symbolic link to it in the new worktree. This allows IntelliJ/WebStorm settings to be shared across worktrees.

Purpose: Worktrees created by mafcli lose IDE settings because `.idea` is not tracked by git. Symlinking `.idea` from the main repo avoids re-configuring the IDE for each worktree.

Output: Shared `maybeSymlinkIdea` function used by both `create` and `pick` commands.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/git.ts
@src/commands/create.ts
@src/commands/pick.ts
@src/commands/create.test.ts
@src/commands/pick.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create maybeSymlinkIdea utility with tests</name>
  <files>src/lib/worktree-hooks.ts, src/lib/worktree-hooks.test.ts</files>
  <behavior>
    - Test 1: When gitRoot/.idea exists and user confirms, creates symlink at worktreePath/.idea pointing to gitRoot/.idea
    - Test 2: When gitRoot/.idea does not exist, does nothing (no prompt shown)
    - Test 3: When gitRoot/.idea exists but user declines, no symlink is created
    - Test 4: When worktreePath/.idea already exists (e.g., tracked in git), skips silently — no prompt, no error
  </behavior>
  <action>
Create `src/lib/worktree-hooks.ts` exporting:

```typescript
export async function maybeSymlinkIdea(gitRoot: string, worktreePath: string): Promise<void>
```

Logic:
1. Use `node:fs/promises` to check if `path.join(gitRoot, '.idea')` exists (use `stat`, catch ENOENT).
2. Check if `path.join(worktreePath, '.idea')` already exists — if yes, return silently (worktree may have its own .idea or already symlinked).
3. Use `@clack/prompts` `confirm()` to ask: "Symlink .idea from main repo? (shares IDE settings)"
4. If user confirms (and not `p.isCancel`), call `fs.symlink(path.join(gitRoot, '.idea'), path.join(worktreePath, '.idea'), 'dir')`.
5. Print `p.log.success('Linked .idea directory')` on success.
6. If user cancels or declines, do nothing.

Write tests in `src/lib/worktree-hooks.test.ts`:
- Mock `node:fs/promises` (`stat`, `symlink`) and `@clack/prompts` (`confirm`, `log`, `isCancel`).
- Follow existing mock patterns from `create.test.ts` (top-level `vi.fn()` + `vi.mock()`).
  </action>
  <verify>
    <automated>npx vitest run src/lib/worktree-hooks.test.ts</automated>
  </verify>
  <done>All 4 behaviors pass. Function is exported and ready for import.</done>
</task>

<task type="auto">
  <name>Task 2: Integrate maybeSymlinkIdea into create and pick commands</name>
  <files>src/commands/create.ts, src/commands/pick.ts, src/commands/create.test.ts, src/commands/pick.test.ts</files>
  <action>
In `src/commands/create.ts`:
1. Add import: `import { maybeSymlinkIdea } from '../lib/worktree-hooks.js';`
2. In both the JIRA path (after `spinner2.stop`) and the manual slug path (after `spinner.stop`), before `p.outro`, add:
   ```typescript
   await maybeSymlinkIdea(gitRoot, worktreePath);
   ```
   This call is inside the existing try/catch so any fs error is handled.

In `src/commands/pick.ts`:
1. Add import: `import { maybeSymlinkIdea } from '../lib/worktree-hooks.js';`
2. After `spinner2.stop` and the `existed` message, before `p.outro`, add:
   ```typescript
   await maybeSymlinkIdea(gitRoot, worktreePath);
   ```

In `src/commands/create.test.ts`:
1. Add mock for worktree-hooks: `const mockMaybeSymlinkIdea = vi.fn();` and `vi.mock('../lib/worktree-hooks.js', () => ({ maybeSymlinkIdea: (...args: unknown[]) => mockMaybeSymlinkIdea(...args) }));`
2. Add `mockMaybeSymlinkIdea.mockResolvedValue(undefined)` in `beforeEach`.
3. Add one test: "calls maybeSymlinkIdea after worktree creation" — verify it was called with `(gitRoot, worktreePath)`.

In `src/commands/pick.test.ts`:
1. Same mock pattern as create.test.ts.
2. Add one test: "calls maybeSymlinkIdea after worktree creation" — verify called with correct args.
  </action>
  <verify>
    <automated>npx vitest run src/commands/create.test.ts src/commands/pick.test.ts</automated>
  </verify>
  <done>Both create and pick commands call maybeSymlinkIdea after worktree creation. All existing tests still pass plus the new integration tests.</done>
</task>

</tasks>

<verification>
npx vitest run src/lib/worktree-hooks.test.ts src/commands/create.test.ts src/commands/pick.test.ts
</verification>

<success_criteria>
- `mafcli create PROJ-123 feature` prompts about .idea symlink after worktree creation (if .idea exists in main repo)
- `mafcli pick` prompts about .idea symlink after worktree creation (if .idea exists in main repo)
- No prompt appears when .idea does not exist in the main repo
- No prompt appears when .idea already exists in the target worktree
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/260407-eaz-symlink-idea-directory-in-new-worktrees-/260407-eaz-SUMMARY.md`
</output>
