---
phase: quick
plan: 260403-csm
type: execute
wave: 1
depends_on: []
files_modified:
  - src/commands/setup.ts
  - src/commands/setup.test.ts
  - src/commands/switch.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "mafcli setup outputs a mafcli() shell function, not mafcd()"
    - "The mafcli() wrapper intercepts 'switch' and cd-s to the sentinel path"
    - "All other subcommands are passed through via 'command mafcli'"
    - "mafcd no longer appears anywhere in the codebase"
  artifacts:
    - path: "src/commands/setup.ts"
      provides: "Updated SHELL_WRAPPER constant with mafcli() function"
      contains: "command mafcli"
    - path: "src/commands/switch.ts"
      provides: "Updated description text without mafcd references"
  key_links:
    - from: "src/commands/setup.ts"
      to: "SHELL_WRAPPER"
      via: "process.stdout.write"
      pattern: "mafcli\\(\\)"
---

<objective>
Replace the `mafcd` shell wrapper with a `mafcli()` shell function in setup.ts, update switch.ts description to remove mafcd references, and update tests to match the new function name and behavior.

Purpose: The new design eliminates a separate `mafcd` function — the `mafcli` shell function itself intercepts the `switch` subcommand and handles `cd`, passing all other subcommands through to the real binary via `command mafcli`.

Output: Updated setup.ts (new SHELL_WRAPPER), updated setup.test.ts (assertions match new wrapper), updated switch.ts (description without mafcd).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace SHELL_WRAPPER in setup.ts and update switch.ts description</name>
  <files>src/commands/setup.ts, src/commands/switch.ts</files>
  <action>
In src/commands/setup.ts, replace the entire SHELL_WRAPPER constant with the new mafcli() function:

```bash
# mafcli — shell function that intercepts 'switch' to cd into the worktree
# Install: add to ~/.zshrc (or ~/.bashrc)
mafcli() {
  if [ "$1" = "switch" ]; then
    shift
    local output
    output=$(command mafcli switch "$@")
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then return 1; fi
    local target="${output#__MAFCLI_CD__:}"
    if [ -z "$target" ] || [ "$target" = "$output" ]; then
      echo "mafcli switch: unexpected output" >&2
      return 1
    fi
    cd "$target"
  else
    command mafcli "$@"
  fi
}
```

Also update the `.description()` call in setup.ts from the old mafcd description to:
'Print mafcli shell function — add to ~/.zshrc to enable worktree cd'

In src/commands/switch.ts, update the `.description()` call to remove the mafcd reference:
Change: 'Output worktree path for mafcd shell function (use mafcd [name] instead)'
To: 'Switch to a worktree (use via the mafcli shell function for cd support)'
  </action>
  <verify>
    <automated>grep -n "mafcd" /Users/jpisa/Development/Claude/mafin-cli/src/commands/setup.ts /Users/jpisa/Development/Claude/mafin-cli/src/commands/switch.ts && echo "FAIL: mafcd still present" || echo "PASS: no mafcd references"</automated>
  </verify>
  <done>setup.ts SHELL_WRAPPER contains mafcli() function with "command mafcli" passthrough; switch.ts description has no mafcd mention.</done>
</task>

<task type="auto">
  <name>Task 2: Update setup.test.ts assertions for the new mafcli() wrapper</name>
  <files>src/commands/setup.test.ts</files>
  <action>
Update test assertions in setup.test.ts to match the new wrapper:

1. Test "STDOUT CONTENT: prints mafcd function name to stdout"
   - Rename to: 'STDOUT CONTENT: prints mafcli function to stdout'
   - Change: expect(output).toContain('mafcd')
   - To: expect(output).toContain('mafcli()')

2. Test "SENTINEL REFERENCE" — no change needed (still checks __MAFCLI_CD__).

3. Test "BASH COMPATIBILITY" — no change needed (still checks for cd invocation).

4. Test "ARGS PASSTHROUGH" — no change needed ("$@" still present).

5. Test "INSTALL INSTRUCTIONS" — no change needed (.zshrc/.bashrc still referenced).

No new tests are needed — the existing coverage is sufficient for the wrapper structure.
  </action>
  <verify>
    <automated>cd /Users/jpisa/Development/Claude/mafin-cli && npx vitest run src/commands/setup.test.ts 2>&1</automated>
  </verify>
  <done>All 5 setup tests pass. No test references "mafcd" as the expected function name.</done>
</task>

</tasks>

<verification>
npx vitest run src/commands/setup.test.ts src/commands/switch.test.ts 2>&1
grep -rn "mafcd" src/ — should return zero results
</verification>

<success_criteria>
- mafcli setup outputs the mafcli() wrapper (not mafcd)
- The wrapper intercepts switch, calls "command mafcli switch", cd-s to the sentinel path
- All other subcommands pass through via "command mafcli "$@""
- switch.ts description contains no mafcd reference
- All setup tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/260403-csm-replace-mafcd-with-mafcli-switch-shell-w/260403-csm-SUMMARY.md`
</output>
