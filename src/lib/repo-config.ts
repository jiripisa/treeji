import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

export interface RepoConfig {
  symlinks?: string[];
}

export async function loadRepoConfig(gitRoot: string): Promise<RepoConfig> {
  const configPath = path.join(gitRoot, '.treeji.yml');
  try {
    const raw = await readFile(configPath, 'utf-8');
    return (parse(raw) as RepoConfig) ?? {};
  } catch {
    return {};
  }
}
