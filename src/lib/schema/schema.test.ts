import { describe, it, expect } from 'vitest';
import { AuthorSchema, WorkSchema, TopicSchema, QuoteSchema, BercotEntrySchema } from './index';

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
	it('accepts minimal topic', () => {
		expect(
			TopicSchema.safeParse({
				id: 1,
				slug: 'foi',
				label: 'Foi'
			}).success
		).toBe(true);
	});
});

describe('TopicSchema (parentId/order)', () => {
	it('accepts a topic with no parent/order', () => {
		expect(
			TopicSchema.safeParse({
				id: 1,
				slug: 'a',
				label: 'A'
			}).success
		).toBe(true);
	});
	it('accepts parentId and order as non-negative ints', () => {
		expect(
			TopicSchema.safeParse({
				id: 2,
				slug: 'b',
				label: 'B',
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

describe('BercotEntrySchema', () => {
	const base = {
		id: 'a1b2c3d4e5f6',
		sourceEntry: 'ABORTION, INFANTICIDE',
		attribution: 'Tertullian (c. 197, W), 3.25.',
		en: 'In our case, murder is once for all forbidden.'
	};
	it('accepts a minimal pending entry', () => {
		const r = BercotEntrySchema.safeParse(base);
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.status).toBe('pending');
			expect(r.data.mappedTopicIds).toEqual([]);
		}
	});
	it('accepts all optional fields filled', () => {
		const r = BercotEntrySchema.safeParse({
			...base,
			subsection: 'I. Meaning of baptism',
			fr: 'Le meurtre…',
			authorId: 7,
			linksPrimary: 'https://example.com/x',
			notes: 'check vol 3',
			mappedTopicIds: [20],
			siteQuoteId: 142,
			status: 'published',
			dedupMatch: 142
		});
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.status).toBe('published');
			expect(r.data.mappedTopicIds).toEqual([20]);
			expect(r.data.authorId).toBe(7);
			expect(r.data.dedupMatch).toBe(142);
		}
	});
	it('accepts new optional text fields', () => {
		const r = BercotEntrySchema.safeParse({
			...base,
			latin: 'Semel homicidium prohibitum est.',
			greek: 'μία φορά',
			context: 'Written against Marcion.',
			studyTitle: 'Adversus Marcionem, III'
		});
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.latin).toBe('Semel homicidium prohibitum est.');
			expect(r.data.greek).toBe('μία φορά');
			expect(r.data.context).toBe('Written against Marcion.');
			expect(r.data.studyTitle).toBe('Adversus Marcionem, III');
		}
	});
	it('accepts workId and migne', () => {
		const r = BercotEntrySchema.safeParse({ ...base, workId: 3, migne: 'PL 1, 123' });
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.workId).toBe(3);
			expect(r.data.migne).toBe('PL 1, 123');
		}
	});
	it('accepts linksArchive as a valid URL', () => {
		const r = BercotEntrySchema.safeParse({
			...base,
			linksArchive: 'https://archive.org/details/foo'
		});
		expect(r.success).toBe(true);
	});
	it('rejects non-url linksPrimary', () => {
		expect(BercotEntrySchema.safeParse({ ...base, linksPrimary: 'not a url' }).success).toBe(false);
	});
	it('rejects non-url linksArchive', () => {
		expect(BercotEntrySchema.safeParse({ ...base, linksArchive: 'not a url' }).success).toBe(false);
	});
	it('rejects negative workId', () => {
		expect(BercotEntrySchema.safeParse({ ...base, workId: -1 }).success).toBe(false);
	});
	it('fully populated entry parses cleanly', () => {
		const r = BercotEntrySchema.safeParse({
			...base,
			subsection: 'I. On murder',
			fr: 'Le meurtre est interdit.',
			latin: 'Semel prohibitum est.',
			greek: 'ἅπαξ',
			context: 'Against Marcion.',
			authorId: 7,
			workId: 3,
			studyTitle: 'Adv. Marcionem III',
			migne: 'PL 2, 346',
			linksPrimary: 'https://example.com/primary',
			linksArchive: 'https://archive.org/details/bar',
			notes: 'check vol 3',
			mappedTopicIds: [20, 21],
			siteQuoteId: 142,
			status: 'published',
			dedupMatch: 142
		});
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.workId).toBe(3);
			expect(r.data.linksPrimary).toBe('https://example.com/primary');
			expect(r.data.linksArchive).toBe('https://archive.org/details/bar');
		}
	});
	it('rejects non-hex id', () => {
		expect(BercotEntrySchema.safeParse({ ...base, id: 'NOT-A-HASH' }).success).toBe(false);
	});
	it('rejects unknown status', () => {
		expect(BercotEntrySchema.safeParse({ ...base, status: 'foo' }).success).toBe(false);
	});
	it('rejects negative dedupMatch', () => {
		expect(BercotEntrySchema.safeParse({ ...base, dedupMatch: -1 }).success).toBe(false);
	});
});
