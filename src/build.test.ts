import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const distEntry = resolve(process.cwd(), 'dist/index.js');

describe('CLI-06: dist/index.js build output', () => {
  it.skipIf(!existsSync(distEntry))('dist/index.js has shebang as first line after build', () => {
    const content = readFileSync(distEntry, 'utf-8');
    const firstLine = content.split('\n')[0];
    expect(firstLine).toBe('#!/usr/bin/env node');
  });

  it.skipIf(!existsSync(distEntry))('dist/index.js has executable file permissions (mode & 0o111 !== 0) after build', () => {
    const mode = statSync(distEntry).mode;
    expect(mode & 0o111).not.toBe(0);
  });
});
