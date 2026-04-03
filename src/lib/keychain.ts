import { Entry } from '@napi-rs/keyring';

const SERVICE = 'treeji';

export function setToken(email: string, token: string): void {
  const entry = new Entry(SERVICE, email);
  entry.setPassword(token);
}

export function getToken(email: string): string | null {
  // Env var override takes priority (CI / keychain-unavailable systems)
  if (process.env.TREEJI_JIRA_TOKEN) {
    return process.env.TREEJI_JIRA_TOKEN;
  }
  try {
    const entry = new Entry(SERVICE, email);
    return entry.getPassword();
  } catch {
    return null;
  }
}

export function deleteToken(email: string): void {
  try {
    const entry = new Entry(SERVICE, email);
    entry.deletePassword();
  } catch {
    // Entry absent — acceptable, no-op
  }
}
