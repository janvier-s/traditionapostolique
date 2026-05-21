import { z } from 'zod';
export const SectionSchema = z.enum(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']);
export type Section = z.infer<typeof SectionSchema>;

export const TopicSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	label: z.string().min(1),
	section: SectionSchema,
	groupe: z.string().min(1),
	description: z.string().optional()
});
export type Topic = z.infer<typeof TopicSchema>;
