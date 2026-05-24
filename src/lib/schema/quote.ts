import { z } from 'zod';
export const QuoteStatusSchema = z.enum(['draft', 'ok']);
export const QuoteSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	title: z.string().optional(),
	authorId: z.number().int().nonnegative(),
	workId: z.number().int().nonnegative().optional(),
	topicIds: z.array(z.number().int().nonnegative()).min(1),
	reference: z.string().optional(),
	// Optional precise source for study-mode display. When the work is a
	// generic container (e.g. 'Lettres', 'Sermons') this carries the
	// specific letter/sermon and its addressee/topic, e.g.
	// 'Lettre 15. Au pape Damase.' Read-mode keeps the short work title.
	studyTitle: z.string().optional(),
	fr: z.string().optional(),
	en: z.string().optional(),
	latin: z.string().optional(),
	greek: z.string().optional(),
	context: z.string().optional(),
	migne: z.string().optional(),
	links: z
		.object({
			primary: z.string().url().optional(),
			archive: z.string().url().optional()
		})
		.default({}),
	notes: z.string().optional(),
	status: QuoteStatusSchema.optional()
});
export type Quote = z.infer<typeof QuoteSchema>;
