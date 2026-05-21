import { z } from 'zod';
export const WorkSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	title: z.string().min(1),
	alternativeTitles: z.array(z.string()).optional(),
	authorId: z.number().int().nonnegative(),
	description: z.string().optional(),
	link: z.string().url().optional(),
	summary: z.string().optional(),
	compositionDate: z.string().optional(),
	outline: z.string().optional(),
	editions: z.array(z.string()).optional()
});
export type Work = z.infer<typeof WorkSchema>;
