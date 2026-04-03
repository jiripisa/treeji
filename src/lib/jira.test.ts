import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Version3Client } from 'jira.js';

// --- Module-scope mock functions ---

const mockLoadConfig = vi.fn();
const mockGetToken = vi.fn();

const mockGetIssue = vi.fn();
const mockSearchForIssuesUsingJqlEnhancedSearchPost = vi.fn();

vi.mock('../lib/config.js', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock('../lib/keychain.js', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

// Class-based vi.mock for Version3Client (required for constructor mocks — Phase 1 decision)
vi.mock('jira.js', () => ({
  Version3Client: vi.fn(function () {
    return {
      issues: { getIssue: (...args: unknown[]) => mockGetIssue(...args) },
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearchPost: (...args: unknown[]) =>
          mockSearchForIssuesUsingJqlEnhancedSearchPost(...args),
      },
    };
  }),
}));

describe('fetchIssue', () => {
  beforeEach(() => {
    vi.mocked(Version3Client).mockClear();
    mockLoadConfig.mockClear();
    mockGetToken.mockClear();
    mockGetIssue.mockClear();
    mockSearchForIssuesUsingJqlEnhancedSearchPost.mockClear();

    // Default happy-path config
    mockLoadConfig.mockReturnValue({ host: 'https://jira.example.com', email: 'user@example.com' });
    mockGetToken.mockReturnValue('test-token');

    // Default happy-path API response
    mockGetIssue.mockResolvedValue({
      fields: {
        summary: 'Fix login',
        status: { name: 'In Progress' },
        issuetype: { name: 'Bug' },
      },
    });
  });

  it('returns {key, summary, statusName} when API responds successfully', async () => {
    const { fetchIssue } = await import('./jira.js');
    const result = await fetchIssue('PROJ-123');

    expect(result).toEqual({
      key: 'PROJ-123',
      summary: 'Fix login',
      statusName: 'In Progress',
    });
  });

  it('calls getIssue with correct fields including summary, status, issuetype', async () => {
    const { fetchIssue } = await import('./jira.js');
    await fetchIssue('PROJ-123');

    expect(mockGetIssue).toHaveBeenCalledWith({
      issueIdOrKey: 'PROJ-123',
      fields: ['summary', 'status', 'issuetype'],
    });
  });

  it('falls back to ticket key as summary when fields.summary is undefined', async () => {
    mockGetIssue.mockResolvedValue({
      fields: {
        summary: undefined,
        status: { name: 'To Do' },
      },
    });

    const { fetchIssue } = await import('./jira.js');
    const result = await fetchIssue('PROJ-456');

    expect(result.summary).toBe('PROJ-456');
  });

  it('throws "JIRA not configured" when loadConfig returns empty host', async () => {
    mockLoadConfig.mockReturnValue({ host: '', email: 'user@example.com' });

    const { fetchIssue } = await import('./jira.js');
    await expect(fetchIssue('PROJ-123')).rejects.toThrow('JIRA not configured');
  });

  it('throws "JIRA not configured" when loadConfig returns missing email', async () => {
    mockLoadConfig.mockReturnValue({ host: 'https://jira.example.com', email: '' });

    const { fetchIssue } = await import('./jira.js');
    await expect(fetchIssue('PROJ-123')).rejects.toThrow('JIRA not configured');
  });

  it('throws "JIRA API token not found" when getToken returns null', async () => {
    mockGetToken.mockReturnValue(null);

    const { fetchIssue } = await import('./jira.js');
    await expect(fetchIssue('PROJ-123')).rejects.toThrow('JIRA API token not found');
  });

  it('retries when first call throws 429 error and succeeds on second call', async () => {
    mockGetIssue
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValueOnce({
        fields: { summary: 'Retry worked', status: { name: 'To Do' } },
      });

    const { fetchIssue } = await import('./jira.js');
    const result = await fetchIssue('PROJ-123');

    expect(result.summary).toBe('Retry worked');
    expect(mockGetIssue).toHaveBeenCalledTimes(2);
  });

  it('throws after 3 attempts when all calls throw 429 error', async () => {
    mockGetIssue
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockRejectedValueOnce(new Error('429 Too Many Requests'));

    const { fetchIssue } = await import('./jira.js');
    await expect(fetchIssue('PROJ-123')).rejects.toThrow('429');

    expect(mockGetIssue).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on non-429 error — throws immediately', async () => {
    mockGetIssue.mockRejectedValueOnce(new Error('Not Found'));

    const { fetchIssue } = await import('./jira.js');
    await expect(fetchIssue('PROJ-123')).rejects.toThrow('Not Found');

    expect(mockGetIssue).toHaveBeenCalledTimes(1);
  });
});

describe('fetchIssueStatuses', () => {
  beforeEach(() => {
    vi.mocked(Version3Client).mockClear();
    mockLoadConfig.mockClear();
    mockGetToken.mockClear();
    mockGetIssue.mockClear();
    mockSearchForIssuesUsingJqlEnhancedSearchPost.mockClear();

    mockLoadConfig.mockReturnValue({ host: 'https://jira.example.com', email: 'user@example.com' });
    mockGetToken.mockReturnValue('test-token');

    mockSearchForIssuesUsingJqlEnhancedSearchPost.mockResolvedValue({
      issues: [
        { key: 'PROJ-1', fields: { status: { name: 'To Do' } } },
        { key: 'PROJ-2', fields: { status: { name: 'In Progress' } } },
      ],
    });
  });

  it('returns empty Map without calling Version3Client constructor when given empty array', async () => {
    const { fetchIssueStatuses } = await import('./jira.js');

    const result = await fetchIssueStatuses([]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(Version3Client).not.toHaveBeenCalled();
  });

  it('calls searchForIssuesUsingJqlEnhancedSearchPost with correct JQL for two keys', async () => {
    const { fetchIssueStatuses } = await import('./jira.js');
    await fetchIssueStatuses(['PROJ-1', 'PROJ-2']);

    expect(mockSearchForIssuesUsingJqlEnhancedSearchPost).toHaveBeenCalledWith(
      expect.objectContaining({
        jql: 'issue in (PROJ-1, PROJ-2)',
      }),
    );
  });

  it('returns Map with correct key-to-statusName mapping', async () => {
    const { fetchIssueStatuses } = await import('./jira.js');
    const result = await fetchIssueStatuses(['PROJ-1', 'PROJ-2']);

    expect(result.get('PROJ-1')).toBe('To Do');
    expect(result.get('PROJ-2')).toBe('In Progress');
    expect(result.size).toBe(2);
  });

  it('never calls the deprecated searchForIssuesUsingJql (GET) method', async () => {
    const { fetchIssueStatuses } = await import('./jira.js');
    await fetchIssueStatuses(['PROJ-1']);

    // Only the enhanced POST should have been called
    expect(mockSearchForIssuesUsingJqlEnhancedSearchPost).toHaveBeenCalledTimes(1);
    // The mock does not expose a deprecated method — confirming correct method was used
  });

  it('accepts arbitrary key arrays and constructs correct JQL', async () => {
    mockSearchForIssuesUsingJqlEnhancedSearchPost.mockResolvedValue({
      issues: [
        { key: 'ABC-10', fields: { status: { name: 'Done' } } },
        { key: 'XYZ-999', fields: { status: { name: 'In Progress' } } },
        { key: 'DEF-42', fields: { status: { name: 'To Do' } } },
      ],
    });

    const { fetchIssueStatuses } = await import('./jira.js');
    const result = await fetchIssueStatuses(['ABC-10', 'XYZ-999', 'DEF-42']);

    expect(mockSearchForIssuesUsingJqlEnhancedSearchPost).toHaveBeenCalledWith(
      expect.objectContaining({
        jql: 'issue in (ABC-10, XYZ-999, DEF-42)',
        maxResults: 3,
      }),
    );
    expect(result.size).toBe(3);
    expect(result.get('DEF-42')).toBe('To Do');
  });
});

describe('fetchAssignedIssues', () => {
  beforeEach(() => {
    vi.mocked(Version3Client).mockClear();
    mockLoadConfig.mockClear();
    mockGetToken.mockClear();
    mockGetIssue.mockClear();
    mockSearchForIssuesUsingJqlEnhancedSearchPost.mockClear();

    mockLoadConfig.mockReturnValue({ host: 'https://jira.example.com', email: 'user@example.com' });
    mockGetToken.mockReturnValue('test-token');

    mockSearchForIssuesUsingJqlEnhancedSearchPost.mockResolvedValue({
      issues: [
        { key: 'PROJ-1', fields: { summary: 'Build login page', status: { name: 'In Progress' } } },
        { key: 'PROJ-2', fields: { summary: 'Fix signup bug', status: { name: 'To Do' } } },
      ],
    });
  });

  it('returns mapped array from mock response', async () => {
    const { fetchAssignedIssues } = await import('./jira.js');
    const result = await fetchAssignedIssues();

    expect(result).toEqual([
      { key: 'PROJ-1', summary: 'Build login page', statusName: 'In Progress' },
      { key: 'PROJ-2', summary: 'Fix signup bug', statusName: 'To Do' },
    ]);
  });

  it('passes correct JQL to searchForIssuesUsingJqlEnhancedSearchPost', async () => {
    const { fetchAssignedIssues } = await import('./jira.js');
    await fetchAssignedIssues();

    expect(mockSearchForIssuesUsingJqlEnhancedSearchPost).toHaveBeenCalledWith(
      expect.objectContaining({
        jql: 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC',
      }),
    );
  });

  it('passes fields: [\'summary\', \'status\'] and maxResults: 50 by default', async () => {
    const { fetchAssignedIssues } = await import('./jira.js');
    await fetchAssignedIssues();

    expect(mockSearchForIssuesUsingJqlEnhancedSearchPost).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: ['summary', 'status'],
        maxResults: 50,
      }),
    );
  });

  it('returns empty array when result.issues is undefined', async () => {
    mockSearchForIssuesUsingJqlEnhancedSearchPost.mockResolvedValue({ issues: undefined });

    const { fetchAssignedIssues } = await import('./jira.js');
    const result = await fetchAssignedIssues();

    expect(result).toEqual([]);
  });

  it('propagates error thrown by withRetry when JIRA is unreachable', async () => {
    mockSearchForIssuesUsingJqlEnhancedSearchPost.mockRejectedValue(new Error('JIRA unreachable'));

    const { fetchAssignedIssues } = await import('./jira.js');
    await expect(fetchAssignedIssues()).rejects.toThrow('JIRA unreachable');
  });

  it('accepts custom maxResults override', async () => {
    const { fetchAssignedIssues } = await import('./jira.js');
    await fetchAssignedIssues(10);

    expect(mockSearchForIssuesUsingJqlEnhancedSearchPost).toHaveBeenCalledWith(
      expect.objectContaining({
        maxResults: 10,
      }),
    );
  });
});
