import Conf from 'conf';
import type { JiraConfig } from '../types/config.js';

// Conf only stores non-secret settings — token lives in keychain only
type StoredConfig = JiraConfig; // { host: string; email: string }

const conf = new Conf<StoredConfig>({ projectName: 'treeji' });

export function loadConfig(): Partial<StoredConfig> {
  return {
    host: conf.get('host'),
    email: conf.get('email'),
  };
}

export function saveConfig(host: string, email: string): void {
  conf.set('host', host);
  conf.set('email', email);
}
