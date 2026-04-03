import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock function for getCurrentUser
const mockGetCurrentUser = vi.fn();

// Mock jira.js to avoid real HTTP calls
// Must use class-based constructor mock
vi.mock('jira.js', () => {
  class MockVersion3Client {
    myself = { getCurrentUser: mockGetCurrentUser };
  }
  return { Version3Client: MockVersion3Client };
});

describe('JIRA-01: validateJiraCredentials', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetCurrentUser.mockReset();
  });

  it('returns { success: true, displayName } when /myself responds 200', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ displayName: 'Jane Dev' });

    const { validateJiraCredentials } = await import('./jira-validate.js');
    const result = await validateJiraCredentials('https://org.atlassian.net', 'user@example.com', 'token123');

    expect(result).toEqual({ success: true, displayName: 'Jane Dev' });
  });

  it('returns { success: false, error } when /myself responds 401', async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error('401 Unauthorized'));

    const { validateJiraCredentials } = await import('./jira-validate.js');
    const result = await validateJiraCredentials('https://org.atlassian.net', 'user@example.com', 'badtoken');

    expect(result).toEqual({ success: false, error: '401 Unauthorized' });
  });

  it('returns { success: false, error } when host is unreachable', async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error('ECONNREFUSED connect ECONNREFUSED 127.0.0.1:443'));

    const { validateJiraCredentials } = await import('./jira-validate.js');
    const result = await validateJiraCredentials('https://localhost', 'user@example.com', 'token');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });
});
