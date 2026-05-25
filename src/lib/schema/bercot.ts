import { z } from 'zod';

export const BercotStatusSchema = z.enum(['pending', 'kept', 'rejected', 'published']);
export type BercotStatus = z.infer<typeof BercotStatusSchema>;

export const BercotEntrySchema = z.object({
	id: z.string().regex(/^[a-f0-9]{12}$/, 'must be a 12-char hex hash'),
	sourceEntry: z.string().min(1),
	subsection: z.string().optional(),
	attribution: z.string().min(1),
	en: z.string().min(1),

	fr: z.string().optional(),
	authorId: z.number().int().nonnegative().optional(),
	sourceUrl: z.string().url().optional(),
	notes: z.string().optional(),

	mappedTopicIds: z.array(z.number().int().nonnegative()).default([]),
	siteQuoteId: z.number().int().nonnegative().optional(),

	status: BercotStatusSchema.default('pending'),
	dedupMatch: z.number().int().nonnegative().optional()
});
export type BercotEntry = z.infer<typeof BercotEntrySchema>;
