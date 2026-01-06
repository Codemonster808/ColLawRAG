import { z } from 'zod'

export const FiltersSchema = z.object({
  type: z.enum(['estatuto', 'jurisprudencia', 'reglamento']).optional(),
}).optional()

export const RagBodySchema = z.object({
  query: z.string().min(1).max(2000),
  filters: FiltersSchema,
  locale: z.enum(['es', 'en']).optional(),
})

export type RagBody = z.infer<typeof RagBodySchema> 