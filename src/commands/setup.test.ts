import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

describe('setup command', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('STDOUT CONTENT: prints treeji function to stdout', async () => {
    const { registerSetupCommand } = await import('./setup.js');
    const program = new Command();
    program.exitOverride();
    registerSetupCommand(program);

    await program.parseAsync(['setup'], { from: 'user' });

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(output).toContain('treeji()');
  });

  it('TEMP FILE: output reads from /tmp/treeji-switch-$$ for cd target', async () => {
    const { registerSetupCommand } = await import('./setup.js');
    const program = new Command();
    program.exitOverride();
    registerSetupCommand(program);

    await program.parseAsync(['setup'], { from: 'user' });

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(output).toContain('treeji-switch-$$');
  });

  it('BASH COMPATIBILITY: output contains cd command invocation', async () => {
    const { registerSetupCommand } = await import('./setup.js');
    const program = new Command();
    program.exitOverride();
    registerSetupCommand(program);

    await program.parseAsync(['setup'], { from: 'user' });

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(output).toMatch(/cd\s+/);
  });

  it('COMMAND PASSTHROUGH: uses "command treeji" for real binary call', async () => {
    const { registerSetupCommand } = await import('./setup.js');
    const program = new Command();
    program.exitOverride();
    registerSetupCommand(program);

    await program.parseAsync(['setup'], { from: 'user' });

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(output).toContain('command treeji');
  });

  it('INSTALL INSTRUCTIONS: output references .zshrc or .bashrc for installation', async () => {
    const { registerSetupCommand } = await import('./setup.js');
    const program = new Command();
    program.exitOverride();
    registerSetupCommand(program);

    await program.parseAsync(['setup'], { from: 'user' });

    // Instructions are on stderr now (stdout stays clean for >>)
    const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrOutput).toMatch(/\.zshrc|\.bashrc/);
  });

  it('STDERR INSTRUCTIONS: instructions written to stderr before stdout function', async () => {
    const { registerSetupCommand } = await import('./setup.js');
    const program = new Command();
    program.exitOverride();
    registerSetupCommand(program);

    await program.parseAsync(['setup'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stderrOutput).toMatch(/Add the following|source ~\/.zshrc/);
  });

  it('STDOUT ONLY: stdout contains only the shell function, not the instruction text', async () => {
    const { registerSetupCommand } = await import('./setup.js');
    const program = new Command();
    program.exitOverride();
    registerSetupCommand(program);

    await program.parseAsync(['setup'], { from: 'user' });

    const stdoutOutput = stdoutSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('');
    expect(stdoutOutput).not.toContain('Add the following');
  });
});
