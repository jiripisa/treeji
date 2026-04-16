#!/usr/bin/env node

import { Command } from 'commander';
import { registerConfigureCommand } from './commands/configure.js';
import { registerCreateCommand } from './commands/create.js';
import { registerListCommand } from './commands/list.js';
import { registerSwitchCommand } from './commands/switch.js';
import { registerRemoveCommand } from './commands/remove.js';
import { registerSetupCommand } from './commands/setup.js';
import { registerPickCommand } from './commands/pick.js';
import { registerStatusCommand } from './commands/status.js';
import { registerTicketCommand } from './commands/ticket.js';

const program = new Command();
program
  .name('treeji')
  .description('Git worktree manager with JIRA integration\n\nExamples:\n  treeji create PROJ-123 feature   # create worktree from JIRA ticket\n  treeji pick                       # interactively pick assigned ticket\n  treeji switch                     # switch between worktrees\n  treeji list                       # show all worktrees')
  .version('0.1.0');

registerConfigureCommand(program);
registerCreateCommand(program);
registerListCommand(program);
registerSwitchCommand(program);
registerRemoveCommand(program);
registerSetupCommand(program);
registerPickCommand(program);
registerStatusCommand(program);
registerTicketCommand(program);

program.parseAsync().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
});
