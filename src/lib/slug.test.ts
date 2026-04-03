import { describe, it, expect } from 'vitest';
import { toSlug, validateSlug, SLUG_MAX_LENGTH } from './slug.js';

describe('toSlug', () => {
  it('transliterates Czech diacritics', () => {
    expect(toSlug('Oprava přihlášení uživatele')).toBe('oprava-prihlaseni-uzivatele');
  });

  it('strips emoji', () => {
    expect(toSlug('🎉 Release day!')).toBe('release-day');
  });

  it('handles punctuation and special chars', () => {
    expect(toSlug("Fix: user's `login` endpoint (PROJ-123)")).toBe('fix-users-login-endpoint-proj-123');
  });

  it('returns empty string for all-special input', () => {
    expect(toSlug('!!!---???')).toBe('');
  });

  it('trims to max 50 chars', () => {
    expect(toSlug('a'.repeat(60)).length).toBeLessThanOrEqual(50);
  });

  it('trims to exactly 50 chars for long input', () => {
    expect(toSlug('a'.repeat(60)).length).toBe(50);
  });

  it('removes trailing hyphens', () => {
    const result = toSlug('my-slug-with-trailing--hyphens---');
    expect(result).not.toMatch(/-$/);
  });
});

describe('validateSlug', () => {
  it('returns error message for empty slug', () => {
    expect(validateSlug('')).toBe('Slug cannot be empty');
  });

  it('allows slug starting with a number (valid)', () => {
    expect(validateSlug('123abc')).toBeUndefined();
  });

  it('returns error for slug starting with hyphen', () => {
    expect(validateSlug('-bad-start')).toBe('Slug must start with a letter or number');
  });

  it('returns error for slug exceeding max length', () => {
    expect(validateSlug('a'.repeat(51))).toBe('Slug must be at most 50 characters');
  });

  it('returns undefined for valid slug', () => {
    expect(validateSlug('valid-slug-123')).toBeUndefined();
  });
});

describe('SLUG_MAX_LENGTH', () => {
  it('is 50', () => {
    expect(SLUG_MAX_LENGTH).toBe(50);
  });
});
