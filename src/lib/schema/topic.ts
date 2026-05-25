import { z } from 'zod';

export const PillarSchema = z.enum(['credo', 'sacrements', 'vie', 'priere']);
export type Pillar = z.infer<typeof PillarSchema>;

export const TopicSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	label: z.string().min(1),
	description: z.string().optional(),
	pillar: PillarSchema.optional(),
	parentId: z.number().int().nonnegative().optional(),
	order: z.number().int().nonnegative().optional()
});
export type Topic = z.infer<typeof TopicSchema>;
