import { z } from 'zod';

export const PillarSchema = z.enum(['dieu', 'eglise', 'saints', 'sacrements', 'vie', 'fin']);
export type Pillar = z.infer<typeof PillarSchema>;

export type TaxonomyNode = {
	id: string;
	label?: string;
	topicId?: number;
	primary?: boolean;
	children?: TaxonomyNode[];
};

export const TaxonomyNodeSchema: z.ZodType<TaxonomyNode> = z.lazy(() =>
	z
		.object({
			id: z.string().min(1),
			label: z.string().min(1).optional(),
			topicId: z.number().int().nonnegative().optional(),
			primary: z.boolean().optional(),
			children: z.array(TaxonomyNodeSchema).optional()
		})
		.refine((n) => (n.label != null) !== (n.topicId != null), {
			message: 'Node must be exactly one of: umbrella (label) or topic-ref (topicId)'
		})
);

export const TaxonomySchema = z.object({
	dieu: z.array(TaxonomyNodeSchema),
	eglise: z.array(TaxonomyNodeSchema),
	saints: z.array(TaxonomyNodeSchema),
	sacrements: z.array(TaxonomyNodeSchema),
	vie: z.array(TaxonomyNodeSchema),
	fin: z.array(TaxonomyNodeSchema)
});
export type Taxonomy = z.infer<typeof TaxonomySchema>;
