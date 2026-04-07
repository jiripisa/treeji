import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clack/prompts
const mockSelect = vi.fn();
const mockText = vi.fn();
const mockCancel = vi.fn();
const mockIsCancel = vi.fn((_v?: unknown) => false);

vi.mock('@clack/prompts', () => ({
  select: (args: unknown) => mockSelect(args),
  text: (args: unknown) => mockText(args),
  cancel: (args: unknown) => mockCancel(args),
  isCancel: (args: unknown) => mockIsCancel(args),
}));

describe('BRANCH_TYPE_OPTIONS', () => {
  it('has 9 entries', async () => {
    const { BRANCH_TYPE_OPTIONS } = await import('./branch-type.js');
    expect(BRANCH_TYPE_OPTIONS).toHaveLength(9);
  });

  it('includes feature, fix, refactor, docs, style, test, chore, custom, none', async () => {
    const { BRANCH_TYPE_OPTIONS } = await import('./branch-type.js');
    const values = BRANCH_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toContain('feature');
    expect(values).toContain('fix');
    expect(values).toContain('refactor');
    expect(values).toContain('docs');
    expect(values).toContain('style');
    expect(values).toContain('test');
    expect(values).toContain('chore');
    expect(values).toContain('custom');
    expect(values).toContain('none');
  });

  it('each entry has value and hint', async () => {
    const { BRANCH_TYPE_OPTIONS } = await import('./branch-type.js');
    for (const option of BRANCH_TYPE_OPTIONS) {
      expect(option).toHaveProperty('value');
      expect(option).toHaveProperty('hint');
    }
  });
});

describe('promptBranchType', () => {
  beforeEach(() => {
    mockSelect.mockClear();
    mockText.mockClear();
    mockCancel.mockClear();
    mockIsCancel.mockReset();
    mockIsCancel.mockReturnValue(false);
  });

  it('returns selected value string for standard type (feature)', async () => {
    mockSelect.mockResolvedValue('feature');
    const { promptBranchType } = await import('./branch-type.js');
    const result = await promptBranchType();
    expect(result).toBe('feature');
  });

  it('returns selected value string for fix', async () => {
    mockSelect.mockResolvedValue('fix');
    const { promptBranchType } = await import('./branch-type.js');
    const result = await promptBranchType();
    expect(result).toBe('fix');
  });

  it('returns empty string when "none" selected', async () => {
    mockSelect.mockResolvedValue('none');
    const { promptBranchType } = await import('./branch-type.js');
    const result = await promptBranchType();
    expect(result).toBe('');
  });

  it('prompts p.text() and returns custom value when "custom" selected', async () => {
    mockSelect.mockResolvedValue('custom');
    mockText.mockResolvedValue('hotfix');
    const { promptBranchType } = await import('./branch-type.js');
    const result = await promptBranchType();
    expect(mockText).toHaveBeenCalled();
    expect(result).toBe('hotfix');
  });

  it('calls process.exit(0) when select is cancelled', async () => {
    const cancelSymbol = Symbol('cancel');
    mockSelect.mockResolvedValue(cancelSymbol);
    mockIsCancel.mockImplementation((v) => v === cancelSymbol);

    class ExitError extends Error {
      code: number;
      constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
      }
    }
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new ExitError(Number(code ?? 0));
    });

    const { promptBranchType } = await import('./branch-type.js');
    await expect(promptBranchType()).rejects.toThrow('exit 0');
    expect(mockCancel).toHaveBeenCalledWith('Cancelled.');

    exitSpy.mockRestore();
  });

  it('calls process.exit(0) when custom text is cancelled', async () => {
    const cancelSymbol = Symbol('cancel');
    mockSelect.mockResolvedValue('custom');
    mockText.mockResolvedValue(cancelSymbol);
    mockIsCancel.mockImplementation((v) => v === cancelSymbol);

    class ExitError extends Error {
      code: number;
      constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
      }
    }
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new ExitError(Number(code ?? 0));
    });

    const { promptBranchType } = await import('./branch-type.js');
    await expect(promptBranchType()).rejects.toThrow('exit 0');
    expect(mockCancel).toHaveBeenCalledWith('Cancelled.');

    exitSpy.mockRestore();
  });
});
