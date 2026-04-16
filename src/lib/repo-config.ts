import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface RepoConfig {
  symlinks?: string[];
}

export async function loadRepoConfig(gitRoot: string): Promise<RepoConfig> {
  const configPath = path.join(gitRoot, '.treeji.json');
  try {
    const raw = await readFile(configPath, 'utf-8');
    return JSON.parse(raw) as RepoConfig;
  } catch {
    return {};
  }
}
