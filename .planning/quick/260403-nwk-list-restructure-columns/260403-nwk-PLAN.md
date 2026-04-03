---
phase: quick
plan: 260403-nwk
type: execute
wave: 1
depends_on: []
files_modified:
  - src/commands/list.ts
  - src/commands/list.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "First column shows basename of worktree directory (name), not branch"
    - "Branch appears as its own column after status"
    - "Path column is gone"
    - "Ticket key (e.g. PROJ-123) appears in its own column"
    - "JIRA status (e.g. In Progress) appears in a separate column after ticket key"
    - "Column order is: name, status, branch, remote, age, ticket, jira status"
  artifacts:
    - path: "src/commands/list.ts"
      provides: "Updated list command with 7-column table"
    - path: "src/commands/list.test.ts"
      provides: "Tests updated to match new column structure"
  key_links:
    - from: "src/commands/list.ts"
      to: "wt.path"
      via: "path.basename(wt.path)"
      pattern: "basename.*wt\\.path"
---

<objective>
Restructure the `treeji list` table from 6 columns to 7 columns with a new column
order and split ticket info into two separate columns.

Purpose: The name column (basename) is more scannable than a full path; separating
ticket key from JIRA status makes both columns independently useful.

Output: Updated src/commands/list.ts and src/commands/list.test.ts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@src/commands/list.ts
@src/commands/list.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restructure list.ts columns</name>
  <files>src/commands/list.ts</files>
  <action>
Add `import path from 'node:path';` at the top (use node: prefix per nodenext conventions).

Replace the entire column-rendering section with a 7-column layout in this exact order:
  name | status | branch | remote | age | ticket | jira status

Column details:

**name** — `path.basename(wt.path)`. For worktrees where wt.path is the repo root
(isMain === true or basename equals the last segment of git root), show the basename as-is.
Width: max of all name values and 'name'.length.

**status** — unchanged: chalk.green('✓') or chalk.red('✗'). Fixed width 8.

**branch** — full branch string (wt.branch ?? '(detached)'). Width: max of all branches
and 'branch'.length. Add 2 padding.

**remote** — unchanged: `↑N ↓M`. Fixed width 10.

**age** — unchanged. Width: max of all ages and 'age'.length. Add 2 padding.

**ticket** — `extractTicketKey(wt.branch) ?? ''`. Width: max of all ticket keys
and 'ticket'.length. Add 2 padding. Plain text (no color).

**jira status** — `colorStatus(ticketStatus)` where `ticketStatus = ticketKey ?
(jiraStatuses.get(ticketKey) ?? '') : ''`. Width: max of all raw (strip-ansi)
jira status values and 'jira status'.length. Add 2 padding.

For the separator line width calculation, use the sum of all column widths as computed.

Remove the `pathWidth` variable entirely. Remove `wt.path` from the data row output.
Remove `ticketWidth` reuse for the combined ticket+status column — replace with two
separate width variables: `ticketKeyWidth` and `jiraStatusWidth`.

The jira status column is the last column — no trailing padding needed.

Header line must read:
  'name' + 'status' + 'branch' + 'remote' + 'age' + 'ticket' + 'jira status'

Data line must follow the same order.

Note: chalk adds ANSI escape codes that inflate `.length`. For computing `jiraStatusWidth`,
strip color codes from the status string before measuring: use a simple regex
`str.replace(/\x1b\[[0-9;]*m/g, '').length` or just use the raw (pre-colorStatus) string
length since `colorStatus` only wraps in chalk without adding characters. Use raw
`ticketStatus.length` for width computation, then apply `colorStatus(ticketStatus)` in
the rendered cell.
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/commands/list.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>list.ts compiles and tests pass with the new 7-column order</done>
</task>

<task type="auto">
  <name>Task 2: Update list.test.ts for new column structure</name>
  <files>src/commands/list.test.ts</files>
  <action>
Update tests to match the new column layout. Key changes:

**Test "JIRA UNREACHABLE"** (currently checks `output.toContain('feature/PROJ-500-some-task')`):
  - The path column is gone. The name column will show `repo-feature` (basename of
    `/repo-feature`). The branch column will show `feature/PROJ-500-some-task`.
  - Change assertion to `expect(output).toContain('feature/PROJ-500-some-task')` — this
    still holds because branch is now its own column. Leave this assertion unchanged.
  - Keep `expect(output).toContain('⚠ JIRA unreachable')` unchanged.

**Test "STATUS SHOWN"** — add assertion that `PROJ-123` appears as its own token
(ticket column) separately from `In Progress` (jira status column):
  - `expect(output).toContain('PROJ-123')` — already exists, keep
  - `expect(output).toContain('In Progress')` — already exists, keep

**Test "4. MULTIPLE WORKTREES"** — currently checks for `feature/PROJ-101` in output.
  The name column will show `repo-feature` and branch column will show `feature/PROJ-101`.
  The assertion `expect(output).toContain('feature/PROJ-101')` still holds (branch column).
  Add: `expect(output).toContain('repo-feature')` to verify name column.
  Add: `expect(output).toContain('repo')` to verify first worktree name column.

**Test "1. CLEAN WORKTREE ROW"** — mock returns path `/repo`, branch `main`.
  Name column will show `repo`. Add: `expect(output).toContain('repo')`.
  Existing assertions (main, 1 hour ago, ↑0 ↓0, ✓) remain valid.

**Header assertion** — add a new test or inline check that the header line contains
'name', 'status', 'branch', 'remote', 'age', 'ticket', 'jira status' (case-insensitive
or exact match as rendered). Add inside "1. CLEAN WORKTREE ROW":
  `expect(lines[0]).toContain('name')`
  `expect(lines[0]).toContain('branch')`
  `expect(lines[0]).toContain('jira status')`

No other test changes required. Do not add new describe blocks.
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/commands/list.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>All existing tests pass with no skips; new assertions confirm name and jira status columns</done>
</task>

</tasks>

<verification>
npx vitest run src/commands/list.test.ts — all tests green.
npx tsc --noEmit — no type errors.
Manual smoke: `node dist/index.js list` (after build) shows 7 columns in correct order.
</verification>

<success_criteria>
- Column order is: name, status, branch, remote, age, ticket, jira status
- path column absent from output
- name column shows basename of worktree directory
- ticket column shows only the key (e.g. PROJ-123), no status
- jira status column shows colored status string
- All vitest tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/260403-nwk-list-restructure-columns/260403-nwk-SUMMARY.md`
with what was changed, decisions made, and final column structure.
</output>
