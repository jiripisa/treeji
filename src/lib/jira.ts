import { Version3Client } from 'jira.js';
import { loadConfig } from './config.js';
import { getToken } from './keychain.js';

function createJiraClient(): Version3Client {
  const config = loadConfig();
  if (!config.host || !config.email) {
    throw new Error('JIRA not configured. Run `treeji configure` first.');
  }
  const token = getToken(config.email);
  if (!token) {
    throw new Error('JIRA API token not found. Run `treeji configure` first.');
  }
  return new Version3Client({
    host: config.host,
    authentication: { basic: { email: config.email, apiToken: token } },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let delay = 400;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429') || msg.toLowerCase().includes('too many requests');
      if (!is429 || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('withRetry: unreachable');
}

export async function fetchIssue(ticketKey: string): Promise<{
  key: string;
  summary: string;
  statusName: string;
}> {
  const client = createJiraClient();
  const issue = await withRetry(() =>
    client.issues.getIssue({
      issueIdOrKey: ticketKey,
      fields: ['summary', 'status', 'issuetype'],
    }),
  );
  return {
    key: ticketKey,
    summary: (issue.fields?.summary as string | undefined) ?? ticketKey,
    statusName: (issue.fields?.status as { name?: string } | undefined)?.name ?? '',
  };
}

export async function fetchIssueStatuses(
  ticketKeys: string[],
): Promise<Map<string, string>> {
  if (ticketKeys.length === 0) return new Map();
  const client = createJiraClient();
  const jql = `issue in (${ticketKeys.join(', ')})`;
  const result = await withRetry(() =>
    client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost({
      jql,
      fields: ['status'],
      maxResults: ticketKeys.length,
    }),
  );
  const map = new Map<string, string>();
  for (const issue of result.issues ?? []) {
    const key = issue.key ?? '';
    const statusName = (issue.fields?.status as { name?: string } | undefined)?.name ?? '';
    if (key) map.set(key, statusName);
  }
  return map;
}

export async function fetchAssignedIssues(maxResults = 50, includeAll = false): Promise<Array<{
  key: string;
  summary: string;
  statusName: string;
}>> {
  const client = createJiraClient();
  const jql = includeAll
    ? 'assignee = currentUser() ORDER BY updated DESC'
    : 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';
  const result = await withRetry(() =>
    client.issueSearch.searchForIssuesUsingJqlEnhancedSearchPost({
      jql,
      fields: ['summary', 'status'],
      maxResults,
    }),
  );
  return (result.issues ?? []).map((issue) => ({
    key: issue.key ?? '',
    summary: (issue.fields?.summary as string | undefined) ?? '',
    statusName: (issue.fields?.status as { name?: string } | undefined)?.name ?? '',
  }));
}
