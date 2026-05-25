import { describe, it, expect } from 'vitest';
import { AuthorSchema, WorkSchema, TopicSchema, QuoteSchema } from './index';

describe('AuthorSchema', () => {
	it('accepts a minimal author', () => {
		const ok = AuthorSchema.safeParse({
			id: 1,
			slug: 'augustinus',
			name: 'Augustin',
			era: 'post-nicene',
			language: ['latin'],
			sources: {}
		});
		expect(ok.success).toBe(true);
	});
	it('rejects unknown era', () => {
		const bad = AuthorSchema.safeParse({
			id: 1,
			slug: 'x',
			name: 'X',
			era: 'unknown',
			language: ['latin'],
			sources: {}
		});
		expect(bad.success).toBe(false);
	});
});

describe('WorkSchema', () => {
	it('requires authorId', () => {
		expect(WorkSchema.safeParse({ id: 1, slug: 'a', title: 'A' }).success).toBe(false);
		expect(WorkSchema.safeParse({ id: 1, slug: 'a', title: 'A', authorId: 1 }).success).toBe(true);
	});
});

describe('TopicSchema', () => {
	it('accepts roman section', () => {
		expect(
			TopicSchema.safeParse({
				id: 1,
				slug: 'foi',
				label: 'Foi',
				section: 'I',
				groupe: 'Sources'
			}).success
		).toBe(true);
	});
	it('rejects non-roman section', () => {
		expect(
			TopicSchema.safeParse({
				id: 1,
				slug: 'foi',
				label: 'Foi',
				section: '9',
				groupe: 'X'
			}).success
		).toBe(false);
	});
});

describe('TopicSchema (pillar/parentId/order)', () => {
	it('accepts a topic with no pillar/parent/order', () => {
		expect(
			TopicSchema.safeParse({
				id: 1,
				slug: 'a',
				label: 'A',
				section: 'I',
				groupe: 'g'
			}).success
		).toBe(true);
	});
	it('accepts pillar credo|sacrements|vie|priere', () => {
		for (const pillar of ['credo', 'sacrements', 'vie', 'priere'] as const) {
			expect(
				TopicSchema.safeParse({
					id: 1,
					slug: 'a',
					label: 'A',
					section: 'I',
					groupe: 'g',
					pillar
				}).success
			).toBe(true);
		}
	});
	it('rejects unknown pillar', () => {
		expect(
			TopicSchema.safeParse({
				id: 1,
				slug: 'a',
				label: 'A',
				section: 'I',
				groupe: 'g',
				pillar: 'dogme'
			}).success
		).toBe(false);
	});
	it('accepts parentId and order as non-negative ints', () => {
		expect(
			TopicSchema.safeParse({
				id: 2,
				slug: 'b',
				label: 'B',
				section: 'I',
				groupe: 'g',
				parentId: 1,
				order: 0
			}).success
		).toBe(true);
	});
	it('rejects negative parentId', () => {
		expect(
			TopicSchema.safeParse({
				id: 2,
				slug: 'b',
				label: 'B',
				section: 'I',
				groupe: 'g',
				parentId: -1
			}).success
		).toBe(false);
	});
	it('rejects negative order', () => {
		expect(
			TopicSchema.safeParse({
				id: 2,
				slug: 'b',
				label: 'B',
				section: 'I',
				groupe: 'g',
				order: -1
			}).success
		).toBe(false);
	});
});

describe('QuoteSchema', () => {
	it('accepts minimal quote', () => {
		const ok = QuoteSchema.safeParse({
			id: 1,
			slug: 'q-1',
			authorId: 1,
			topicIds: [1],
			fr: 'Bonjour',
			links: {}
		});
		expect(ok.success).toBe(true);
	});
	it('requires at least one topicId', () => {
		const bad = QuoteSchema.safeParse({
			id: 1,
			slug: 'q-1',
			authorId: 1,
			topicIds: [],
			links: {}
		});
		expect(bad.success).toBe(false);
	});
});
