import { Command } from 'commander';
import * as p from '@clack/prompts';
import { execa } from 'execa';
import { loadConfig } from '../lib/config.js';
import { extractTicketKey } from './list.js';

export function registerTicketCommand(program: Command): void {
  program
    .command('ticket')
    .description('Open current JIRA ticket in browser')
    .action(async () => {
      const config = loadConfig();
      if (!config.host) {
        p.log.error('JIRA not configured. Run `treeji configure` first.');
        process.exit(1);
      }

      const { stdout: branch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
      const ticketKey = extractTicketKey(branch.trim());

      if (!ticketKey) {
        p.log.error(`No JIRA ticket found in branch name: ${branch.trim()}`);
        process.exit(1);
      }

      const url = `${config.host}/browse/${ticketKey}`;

      try {
        const { default: open } = await import('open');
        await open(url);
        p.log.success(`Opened ${ticketKey}: ${url}`);
      } catch {
        p.log.info(`Open in your browser: ${url}`);
      }
    });
}
