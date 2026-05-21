import { describe, it, expect } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
	it('lowercases and dashes', () => expect(slugify('Hello World')).toBe('hello-world'));
	it('strips accents', () => expect(slugify('Évangile')).toBe('evangile'));
	it('strips punctuation', () => expect(slugify("L'Église")).toBe('l-eglise'));
	it('truncates at 80 chars', () =>
		expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80));
	it('returns the input as-is when already a slug', () => expect(slugify('abc-123')).toBe('abc-123'));
});
