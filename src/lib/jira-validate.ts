import { Version3Client } from 'jira.js';

export async function validateJiraCredentials(
  host: string,
  email: string,
  token: string,
): Promise<{ success: boolean; displayName?: string; error?: string }> {
  const client = new Version3Client({
    host,
    authentication: {
      basic: { email, apiToken: token },
    },
  });
  try {
    const myself = await client.myself.getCurrentUser();
    return { success: true, displayName: myself.displayName };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
