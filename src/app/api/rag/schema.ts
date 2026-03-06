import { z } from 'zod'

export const FiltersSchema = z.object({
  type: z.enum(['estatuto', 'jurisprudencia', 'reglamento']).optional(),
}).optional()

export const RagBodySchema = z.object({
  query: z.string().min(1).max(2000),
  filters: FiltersSchema,
  locale: z.enum(['es', 'en']).optional(),
  /** S7.1 A/B: false = desactivar query expansion para benchmark */
  useQueryExpansion: z.boolean().optional(),
  /** S7.2 A/B: false = desactivar prompts por área (prompt genérico) */
  usePromptByArea: z.boolean().optional(),
})

export type RagBody = z.infer<typeof RagBodySchema> 