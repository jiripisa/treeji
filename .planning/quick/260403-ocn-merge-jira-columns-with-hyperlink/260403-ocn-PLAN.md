---
phase: quick
plan: 260403-ocn
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
    - "Header shows 5 columns: name | status | branch | age | jira (not 6)"
    - "JIRA column displays 'PRJ-160 (In Progress)' format with OSC 8 hyperlink on the ticket ID"
    - "When JIRA is unreachable the column shows only the hyperlinked ticket ID with no status parens"
    - "When branch has no ticket key the JIRA column is empty"
  artifacts:
    - path: "src/commands/list.ts"
      provides: "Merged JIRA column with OSC 8 hyperlink support"
      contains: "\\e]8;;"
    - path: "src/commands/list.test.ts"
      provides: "Tests covering merged column format and hyperlink rendering"
  key_links:
    - from: "src/commands/list.ts"
      to: "src/lib/config.ts"
      via: "loadConfig().host import for hyperlink URL construction"
      pattern: "loadConfig"
---

<objective>
Merge the "ticket" and "jira status" columns into a single "jira" column.

Purpose: Reduce column count from 6 to 5. Ticket ID becomes a clickable OSC 8 terminal hyperlink pointing to {host}/browse/{key}. Status appears in parentheses after the key, colored via colorStatus().
Output: Updated list.ts with 5-column layout and updated tests covering the new format.
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

<task type="auto" tdd="true">
  <name>Task 1: Merge ticket + jira status into single jira column with OSC 8 hyperlinks</name>
  <files>src/commands/list.ts, src/commands/list.test.ts</files>
  <behavior>
    - jiraCell('PROJ-123', 'In Progress', 'https://acme.atlassian.net') returns OSC 8 hyperlink wrapping 'PROJ-123' followed by ' (In Progress)' colored by colorStatus()
    - jiraCell('PROJ-123', '', 'https://acme.atlassian.net') returns OSC 8 hyperlink wrapping 'PROJ-123' with no parens (JIRA unreachable case)
    - jiraCell(null, '', 'https://acme.atlassian.net') returns empty string (no ticket key)
    - Header row contains 'jira' (not 'ticket' or 'jira status')
    - Header row does NOT contain 'ticket' as a standalone column
    - Column count in header is 5 (name | status | branch | age | jira)
    - jiraWidth computed from visible text length (ticket key + ' (' + status + ')') — NOT from the raw string with escape sequences
  </behavior>
  <action>
1. Add import for loadConfig at top of list.ts:
   `import { loadConfig } from '../lib/config.js';`

2. Add jiraCell helper function that builds the JIRA column value:
   ```typescript
   function jiraCell(key: string | null, statusName: string, host: string | undefined): string {
     if (!key) return '';
     const url = host ? `${host}/browse/${key}` : '';
     const link = `\x1b]8;;${url}\x1b\\${key}\x1b]8;;\x1b\\`;
     if (!statusName) return link;
     return `${link} (${colorStatus(statusName)})`;
   }
   ```

3. Replace the two separate width computations (ticketKeyWidth and jiraStatusWidth) with a single jiraWidth:
   ```typescript
   const jiraWidth = Math.max(
     ...rows.map((r) => {
       const key = extractTicketKey(r.wt.branch);
       const status = key ? (jiraStatuses.get(key) ?? '') : '';
       if (!key) return 0;
       return status ? `${key} (${status})`.length : key.length;
     }),
     'jira'.length,
   );
   ```
   IMPORTANT: jiraWidth uses visible text lengths (no escape sequences) so padding calculations are correct.

4. Load config once before rendering:
   ```typescript
   const { host } = loadConfig();
   ```

5. Update header to use 'jira' instead of 'ticket' + 'jira status':
   Replace: `'ticket'.padEnd(ticketKeyWidth + 2) + 'jira status'`
   With: `'jira'`

6. Update separator line to use jiraWidth instead of ticketKeyWidth + 2 + jiraStatusWidth.

7. Update data rows to use jiraCell:
   Remove: `ticketKeyCol` and `jiraStatusCol` variables and their console.log concatenation
   Add:
   ```typescript
   const ticketKey = extractTicketKey(wt.branch);
   const ticketStatus = ticketKey ? (jiraStatuses.get(ticketKey) ?? '') : '';
   const jiraCol = jiraCell(ticketKey, jiraWarning ? '' : ticketStatus, host).padEnd(jiraWidth + 2);
   ```
   Note: When jiraWarning is true, pass empty statusName so only hyperlinked key is shown.
   Note: padEnd(jiraWidth + 2) pads based on visible width but the actual string contains escape sequences. To get correct padding, compute visible length and pad manually:
   ```typescript
   const jiraVisible = ticketKey
     ? ((!jiraWarning && ticketStatus) ? `${ticketKey} (${ticketStatus})` : ticketKey)
     : '';
   const jiraColRaw = jiraCell(ticketKey, jiraWarning ? '' : ticketStatus, host);
   const jiraColPadded = jiraColRaw + ' '.repeat(Math.max(0, jiraWidth + 2 - jiraVisible.length));
   ```

8. In the console.log for data rows replace `ticketKeyCol + jiraStatusCol` with `jiraColPadded` (last column — no trailing pad needed, so just `jiraColRaw` is also fine since it's the last column).

9. Update list.test.ts:
   - Add mock for loadConfig:
     ```typescript
     const mockLoadConfig = vi.fn();
     vi.mock('../lib/config.js', () => ({
       loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
     }));
     ```
   - In beforeEach: `mockLoadConfig.mockReturnValue({ host: 'https://jira.example.com' });`
   - Update test "shows branch name, age, ahead/behind for a clean worktree": change `expect(header).toContain('jira status')` to `expect(header).toContain('jira')` and add `expect(header).not.toContain('ticket')`.
   - Update JIRA STATUS COLUMN tests: existing assertions `toContain('In Progress')` and `toContain('PROJ-123')` still pass since both appear in the merged column value. No test changes needed there.
   - Add new test describing hyperlink format:
     ```
     JIRA HYPERLINK: jira column contains OSC 8 escape sequence for ticket with host URL
     - mockLoadConfig returns { host: 'https://jira.example.com' }
     - branch 'feature/PROJ-123-fix', status 'In Progress'
     - output contains '\x1b]8;;https://jira.example.com/browse/PROJ-123\x1b\\'
     ```
   - Add test: JIRA UNREACHABLE HYPERLINK: when JIRA unreachable, hyperlink still present for ticket key, no parens in output
   - Clear mockLoadConfig in beforeEach.
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/commands/list.test.ts 2>&1</automated>
  </verify>
  <done>
    - All existing tests pass
    - Header shows 'jira' column (not 'ticket' and 'jira status' separately)
    - Data rows render OSC 8 escape sequences wrapping ticket key with correct URL
    - JIRA unreachable: hyperlink present, no status in parens
    - No ticket key: empty jira cell
    - Column alignment is correct (visible text widths used for padding)
  </done>
</task>

</tasks>

<verification>
npx vitest run src/commands/list.test.ts
All tests green. Header contains 'jira', not 'ticket' or 'jira status'.
Manual smoke test: mafcli list — verify 5-column output with clickable ticket IDs in iTerm2/Warp.
</verification>

<success_criteria>
- 5 columns in header: name | status | branch | age | jira
- JIRA column: hyperlinked ticket key + ' (' + colored status + ')' when status available
- JIRA column: hyperlinked ticket key only when JIRA unreachable
- JIRA column: empty when no ticket key in branch
- All list.test.ts tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/260403-ocn-merge-jira-columns-with-hyperlink/260403-ocn-SUMMARY.md`
</output>
