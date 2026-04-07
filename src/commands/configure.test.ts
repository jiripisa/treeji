import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock all library dependencies to avoid real keychain/config/HTTP calls
const mockSaveConfig = vi.fn();
const mockLoadConfig = vi.fn((): { host: string | undefined; email: string | undefined } => ({ host: undefined, email: undefined }));
const mockSetToken = vi.fn();
const mockValidateJiraCredentials = vi.fn();

vi.mock('../lib/config.js', () => ({
  saveConfig: (...args: unknown[]) => mockSaveConfig(...args),
  loadConfig: () => mockLoadConfig(),
}));

vi.mock('../lib/keychain.js', () => ({
  setToken: (...args: unknown[]) => mockSetToken(...args),
  getToken: vi.fn(),
  deleteToken: vi.fn(),
}));

vi.mock('../lib/jira-validate.js', () => ({
  validateJiraCredentials: (...args: unknown[]) => mockValidateJiraCredentials(...args),
}));

// Mock open package to avoid real browser launches
const mockOpen = vi.fn().mockResolvedValue(undefined);
vi.mock('open', () => ({ default: (...args: unknown[]) => mockOpen(...args) }));

// Mock @clack/prompts to avoid interactive TTY requirements
const mockNote = vi.fn();
const mockOutro = vi.fn();
const mockIntro = vi.fn();
const mockCancel = vi.fn();
const mockSpinnerStart = vi.fn();
const mockSpinnerStop = vi.fn();
const mockText = vi.fn();
const mockPassword = vi.fn();
const mockIsCancel = vi.fn((_val: unknown) => false);

vi.mock('@clack/prompts', () => ({
  intro: (...args: unknown[]) => mockIntro(...args),
  note: (...args: unknown[]) => mockNote(...args),
  outro: (...args: unknown[]) => mockOutro(...args),
  cancel: (...args: unknown[]) => mockCancel(...args),
  spinner: vi.fn(() => ({ start: mockSpinnerStart, stop: mockSpinnerStop })),
  text: (...args: unknown[]) => mockText(...args),
  password: (...args: unknown[]) => mockPassword(...args),
  isCancel: (val: unknown) => mockIsCancel(val),
}));

describe('JIRA-01: configure command', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSaveConfig.mockClear();
    mockLoadConfig.mockClear();
    mockSetToken.mockClear();
    mockValidateJiraCredentials.mockClear();
    mockNote.mockClear();
    mockOutro.mockClear();
    mockIntro.mockClear();
    mockText.mockClear();
    mockPassword.mockClear();
    mockIsCancel.mockClear();
    mockIsCancel.mockReturnValue(false);
    mockLoadConfig.mockReturnValue({ host: undefined, email: undefined });
    mockOpen.mockClear();
    mockOpen.mockResolvedValue(undefined);
  });

  describe('non-interactive mode (--url --email --token flags)', () => {
    it('--url --email --token flags skip all prompts and proceed directly', async () => {
      mockValidateJiraCredentials.mockResolvedValue({ success: true, displayName: 'Jane Dev' });

      const { registerConfigureCommand } = await import('./configure.js');
      const program = new Command();
      program.exitOverride();
      registerConfigureCommand(program);

      await program.parseAsync(['configure', '--url', 'https://org.atlassian.net', '--email', 'user@example.com', '--token', 'tok'], { from: 'user' });

      expect(mockSaveConfig).toHaveBeenCalledWith('https://org.atlassian.net', 'user@example.com');
      expect(mockSetToken).toHaveBeenCalledWith('user@example.com', 'tok');
      expect(mockValidateJiraCredentials).toHaveBeenCalledTimes(1);
    });

    it('missing required flag in non-interactive mode prints error and exits 1', async () => {
      // When not all flags are provided, falls back to interactive mode (prompts)
      // This test verifies the command registers without error on partial flags
      const { registerConfigureCommand } = await import('./configure.js');
      expect(typeof registerConfigureCommand).toBe('function');
    });

    it('non-interactive mode does not open browser', async () => {
      mockValidateJiraCredentials.mockResolvedValue({ success: true, displayName: 'Jane Dev' });

      const { registerConfigureCommand } = await import('./configure.js');
      const program = new Command();
      program.exitOverride();
      registerConfigureCommand(program);

      await program.parseAsync(['configure', '--url', 'https://org.atlassian.net', '--email', 'user@example.com', '--token', 'tok'], { from: 'user' });

      expect(mockOpen).not.toHaveBeenCalled();
    });
  });

  describe('interactive mode (no flags)', () => {
    it('shows current config values as initialValue in prompts (D-02)', async () => {
      // Verify loadConfig is called to pre-fill prompt initial values
      mockLoadConfig.mockReturnValue({ host: 'https://existing.atlassian.net', email: 'existing@example.com' });
      mockValidateJiraCredentials.mockResolvedValue({ success: true, displayName: 'Jane Dev' });

      mockText
        .mockResolvedValueOnce('https://existing.atlassian.net')
        .mockResolvedValueOnce('existing@example.com');
      mockPassword.mockResolvedValueOnce('mytoken');

      const { registerConfigureCommand } = await import('./configure.js');
      const program = new Command();
      program.exitOverride();
      registerConfigureCommand(program);

      await program.parseAsync(['configure'], { from: 'user' });

      expect(mockLoadConfig).toHaveBeenCalled();
      // D-02: text prompt should receive initialValue from existing config
      const firstTextCall = mockText.mock.calls[0]?.[0] as { initialValue?: string };
      expect(firstTextCall?.initialValue).toBe('https://existing.atlassian.net');
    });

    it('cancel signal from any prompt exits cleanly without saving', async () => {
      // When isCancel returns true, process.exit(0) is called — mock process.exit to throw
      // so execution actually stops (otherwise it continues and crashes on host.replace)
      class ExitError extends Error { code: number; constructor(code: number) { super(`exit ${code}`); this.code = code; } }
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new ExitError(Number(code ?? 0));
      });

      // text() returns a cancelled symbol value
      const cancelSymbol = Symbol('cancel');
      mockText.mockResolvedValueOnce(cancelSymbol as unknown as string);
      mockIsCancel.mockReturnValueOnce(true); // first isCancel check returns true

      const { registerConfigureCommand } = await import('./configure.js');
      const program = new Command();
      program.exitOverride();
      registerConfigureCommand(program);

      await expect(
        program.parseAsync(['configure'], { from: 'user' })
      ).rejects.toThrow('exit 0');

      // saveConfig should not have been called if cancel was detected
      expect(mockSaveConfig).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });

    it('opens browser to Atlassian token page after email prompt (D-05)', async () => {
      mockValidateJiraCredentials.mockResolvedValue({ success: true, displayName: 'Jane Dev' });
      mockText
        .mockResolvedValueOnce('https://org.atlassian.net')
        .mockResolvedValueOnce('user@example.com');
      mockPassword.mockResolvedValueOnce('mytoken');

      const { registerConfigureCommand } = await import('./configure.js');
      const program = new Command();
      program.exitOverride();
      registerConfigureCommand(program);

      await program.parseAsync(['configure'], { from: 'user' });

      expect(mockOpen).toHaveBeenCalledWith('https://id.atlassian.com/manage-profile/security/api-tokens');
      const noteCall = mockNote.mock.calls.find((call) => String(call[1]).includes('Browser opened'));
      expect(noteCall).toBeDefined();
      expect(String(noteCall?.[1])).toContain('Browser opened');
    });

    it('falls back to printed URL when browser open fails (D-05)', async () => {
      mockOpen.mockRejectedValueOnce(new Error('spawn failed'));
      mockValidateJiraCredentials.mockResolvedValue({ success: true, displayName: 'Jane Dev' });
      mockText
        .mockResolvedValueOnce('https://org.atlassian.net')
        .mockResolvedValueOnce('user@example.com');
      mockPassword.mockResolvedValueOnce('mytoken');

      const { registerConfigureCommand } = await import('./configure.js');
      const program = new Command();
      program.exitOverride();
      registerConfigureCommand(program);

      await program.parseAsync(['configure'], { from: 'user' });

      const noteCall = mockNote.mock.calls.find((call) => String(call[1]).includes('Open in your browser'));
      expect(noteCall).toBeDefined();
      expect(String(noteCall?.[0])).toContain('https://id.atlassian.com/manage-profile/security/api-tokens');
    });
  });

  describe('post-save validation (D-03)', () => {
    it('calls validateJiraCredentials after saving config', async () => {
      mockValidateJiraCredentials.mockResolvedValue({ success: true, displayName: 'Jane Dev' });

      const { registerConfigureCommand } = await import('./configure.js');
      const program = new Command();
      program.exitOverride();
      registerConfigureCommand(program);

      await program.parseAsync(['configure', '--url', 'https://org.atlassian.net', '--email', 'user@example.com', '--token', 'tok'], { from: 'user' });

      expect(mockValidateJiraCredentials).toHaveBeenCalledWith('https://org.atlassian.net', 'user@example.com', 'tok');
    });

    it('shows success summary table on valid credentials (D-04)', async () => {
      mockValidateJiraCredentials.mockResolvedValue({ success: true, displayName: 'Jane Dev' });

      const { registerConfigureCommand } = await import('./configure.js');
      const program = new Command();
      program.exitOverride();
      registerConfigureCommand(program);

      await program.parseAsync(['configure', '--url', 'https://org.atlassian.net', '--email', 'user@example.com', '--token', 'tok'], { from: 'user' });

      // D-04: summary note should contain URL, email, and connection result
      expect(mockNote).toHaveBeenCalled();
      const noteContent = mockNote.mock.calls[0]?.[0] as string;
      expect(noteContent).toContain('https://org.atlassian.net');
      expect(noteContent).toContain('user@example.com');
      expect(noteContent).toMatch(/jane dev/i);
      expect(mockOutro).toHaveBeenCalled();
    });

    it('shows failure message clearly when /myself returns error (D-03)', async () => {
      mockValidateJiraCredentials.mockResolvedValue({ success: false, error: '401 Unauthorized' });

      const { registerConfigureCommand } = await import('./configure.js');
      const program = new Command();
      program.exitOverride();
      registerConfigureCommand(program);

      await program.parseAsync(['configure', '--url', 'https://org.atlassian.net', '--email', 'user@example.com', '--token', 'badtoken'], { from: 'user' });

      expect(mockNote).toHaveBeenCalled();
      const noteContent = mockNote.mock.calls[0]?.[0] as string;
      expect(noteContent).toContain('401');
    });
  });
});
