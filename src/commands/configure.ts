import { Command } from 'commander';
import * as p from '@clack/prompts';
import { loadConfig, saveConfig } from '../lib/config.js';
import { setToken } from '../lib/keychain.js';
import { validateJiraCredentials } from '../lib/jira-validate.js';

export function registerConfigureCommand(program: Command): void {
  program
    .command('configure')
    .description('Configure JIRA Cloud credentials')
    .option('--url <url>', 'JIRA instance URL (https://your-org.atlassian.net)')
    .option('--email <email>', 'JIRA account email')
    .option(
      '--token <token>',
      'JIRA API token (WARNING: appears in shell history — use TREEJI_JIRA_TOKEN env var for CI)',
    )
    .action(async (opts: { url?: string; email?: string; token?: string }) => {
      const existing = loadConfig();

      let host: string;
      let email: string;
      let token: string;

      const isNonInteractive = opts.url && opts.email && opts.token;

      if (isNonInteractive) {
        // D-01: non-interactive — use flags directly, no prompts
        host = opts.url!;
        email = opts.email!;
        token = opts.token!;
      } else {
        // D-01: interactive mode — prompt step by step
        // D-02: show current values as initial values
        p.intro('Configure JIRA credentials');

        if (existing.host) {
          p.note(`${existing.host} / ${existing.email ?? ''}`, 'Current configuration');
        }

        const hostResult = await p.text({
          message: 'JIRA instance URL',
          initialValue: existing.host ?? '',
          placeholder: 'https://your-org.atlassian.net',
          validate: (v) =>
            v && v.startsWith('https://') ? undefined : 'Must start with https://',
        });
        if (p.isCancel(hostResult)) {
          p.cancel('Cancelled.');
          process.exit(0);
        }

        const emailResult = await p.text({
          message: 'JIRA account email',
          initialValue: existing.email ?? '',
          placeholder: 'you@example.com',
          validate: (v) => (v && v.includes('@') ? undefined : 'Enter a valid email address'),
        });
        if (p.isCancel(emailResult)) {
          p.cancel('Cancelled.');
          process.exit(0);
        }

        const tokenResult = await p.password({
          message: 'JIRA API token',
          validate: (v) => (v && v.length > 0 ? undefined : 'Token cannot be empty'),
        });
        if (p.isCancel(tokenResult)) {
          p.cancel('Cancelled.');
          process.exit(0);
        }

        host = hostResult as string;
        email = emailResult as string;
        token = tokenResult as string;
      }

      // Normalize URL: strip trailing slash
      host = host.replace(/\/$/, '');

      // Save non-secret config
      saveConfig(host, email);

      // Store token in keychain (never in config file)
      setToken(email, token);

      // D-03: validate connection
      const spinner = p.spinner();
      spinner.start('Validating JIRA credentials...');
      const validation = await validateJiraCredentials(host, email, token);
      spinner.stop(validation.success ? 'Connection validated' : 'Connection failed');

      // D-04: summary table
      const tokenSource = process.env.TREEJI_JIRA_TOKEN ? 'env var (TREEJI_JIRA_TOKEN)' : 'OS keychain';
      if (validation.success) {
        p.note(
          [
            `JIRA URL:    ${host}`,
            `Email:       ${email}`,
            `Token:       stored in ${tokenSource}`,
            `Connection:  OK — logged in as ${validation.displayName ?? email}`,
          ].join('\n'),
          'Configuration saved',
        );
        p.outro('treeji is ready to use.');
      } else {
        p.note(
          [
            `JIRA URL:    ${host}`,
            `Email:       ${email}`,
            `Token:       stored in ${tokenSource}`,
            `Connection:  FAILED — ${validation.error ?? 'unknown error'}`,
          ].join('\n'),
          'Configuration saved (credentials stored despite validation failure)',
        );
        p.outro('Check your JIRA URL and token, then run configure again.');
      }
    });
}
