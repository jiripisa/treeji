import slugify from 'slugify';

export const SLUG_MAX_LENGTH = 50;

export function toSlug(input: string): string {
  const slug = slugify(input, { lower: true, strict: true });
  // strict: true removes all non-alphanumeric chars; output may be empty for all-special input
  return slug.slice(0, SLUG_MAX_LENGTH).replace(/-+$/, '');
}

export function validateSlug(slug: string): string | undefined {
  if (!slug) return 'Slug cannot be empty';
  if (!/^[a-z0-9]/.test(slug)) return 'Slug must start with a letter or number';
  if (slug.length > SLUG_MAX_LENGTH) return `Slug must be at most ${SLUG_MAX_LENGTH} characters`;
  return undefined; // valid
}
