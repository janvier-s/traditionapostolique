import { z } from 'zod';

export const EraSchema = z.enum(['apostolic', 'ante-nicene', 'nicene', 'post-nicene', 'medieval']);
export type Era = z.infer<typeof EraSchema>;

export const AuthorSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	name: z.string().min(1),
	originalName: z.string().optional(),
	era: EraSchema,
	dates: z.string().optional(),
	feastDay: z.string().optional(),
	function: z.string().optional(),
	language: z.array(z.string()).default([]),
	region: z.string().optional(),
	groups: z.array(z.string()).optional(),
	disciples: z.array(z.number().int()).optional(),
	sources: z
		.object({
			wikipedia: z.string().url().optional(),
			wikisource: z.string().url().optional(),
			wikimedia: z.string().url().optional()
		})
		.default({}),
	status: z.string().optional(),
	bioShort: z.string().optional(),
	bioLong: z.string().optional()
});
export type Author = z.infer<typeof AuthorSchema>;
