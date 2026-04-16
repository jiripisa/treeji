import { Command } from 'commander';

const SHELL_WRAPPER = `# treeji — shell function that intercepts 'switch' to cd into the worktree
# Install: add to ~/.zshrc (or ~/.bashrc)
treeji() {
  if [ "$1" = "switch" ]; then
    shift
    command treeji switch "$@"
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then return 1; fi
    local f="/tmp/treeji-switch-$$"
    if [ -f "$f" ]; then
      cd "$(cat "$f")" && rm -f "$f"
    fi
  else
    command treeji "$@"
  fi
}

# treeji — zsh completions
autoload -Uz compinit && compinit -C
_treeji() {
  local -a commands
  commands=(
    'configure:Configure JIRA Cloud credentials'
    'create:Create a worktree from JIRA key or manual slug'
    'list:List all worktrees with git status'
    'switch:Switch to a worktree'
    'remove:Remove a worktree, its directory, and branch'
    'setup-shell:Print shell function and completions'
    'pick:Pick an assigned JIRA ticket and create a worktree'
    'status:Unified dashboard of worktrees, branches, and JIRA tickets'
    'ticket:Open current JIRA ticket in browser'
    'help:Display help for a command'
  )
  _describe 'command' commands
}
compdef _treeji treeji
`;

export function registerSetupCommand(program: Command): void {
  program
    .command('setup-shell')
    .description('Print treeji shell function — add to ~/.zshrc to enable worktree cd and completions')
    .action(() => {
      process.stderr.write('Add the following to ~/.zshrc (or ~/.bashrc), then run: source ~/.zshrc\n');
      process.stdout.write(SHELL_WRAPPER);
    });
}
