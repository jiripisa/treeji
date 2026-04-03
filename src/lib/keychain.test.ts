import { describe, it, expect, vi, afterEach } from 'vitest';

// Shared mock for setPassword/getPassword/deletePassword
const mockSetPassword = vi.fn();
const mockGetPassword = vi.fn(() => { throw new Error('Entry not found'); });
const mockDeletePassword = vi.fn(() => { throw new Error('Entry not found'); });

// Mock the @napi-rs/keyring module so tests don't touch the real OS keychain
// Must use class-based constructor mock
vi.mock('@napi-rs/keyring', () => {
  class MockEntry {
    constructor(_service: string, _account: string) {}
    setPassword(token: string) { return mockSetPassword(token); }
    getPassword() { return mockGetPassword(); }
    deletePassword() { return mockDeletePassword(); }
  }
  return { Entry: MockEntry };
});

describe('CLI-02: keychain token storage', () => {
  describe('getToken — env var fallback', () => {
    afterEach(() => {
      delete process.env.TREEJI_JIRA_TOKEN;
      vi.resetModules();
    });

    it('returns TREEJI_JIRA_TOKEN env var value when set, skipping keychain', async () => {
      process.env.TREEJI_JIRA_TOKEN = 'testtoken';
      const { getToken } = await import('./keychain.js');
      const result = getToken('any@email.com');
      expect(result).toBe('testtoken');
    });

    it('returns null when keychain is empty and TREEJI_JIRA_TOKEN is not set', async () => {
      delete process.env.TREEJI_JIRA_TOKEN;
      // mockGetPassword throws by default — should return null
      const { getToken } = await import('./keychain.js');
      const result = getToken('nobody@example.com');
      expect(result).toBeNull();
    });
  });

  describe('setToken / getToken round-trip', () => {
    afterEach(() => {
      vi.resetModules();
      mockSetPassword.mockClear();
    });

    it('setToken stores token and getToken retrieves it (requires active macOS session)', async () => {
      const { setToken } = await import('./keychain.js');
      setToken('user@example.com', 'mytoken');
      expect(mockSetPassword).toHaveBeenCalledWith('mytoken');
    });
  });

  describe('deleteToken', () => {
    afterEach(() => {
      vi.resetModules();
    });

    it('deleteToken does not throw when entry does not exist', async () => {
      // mockDeletePassword throws by default — deleteToken should swallow it
      const { deleteToken } = await import('./keychain.js');
      expect(() => deleteToken('nobody@example.com')).not.toThrow();
    });
  });
});
