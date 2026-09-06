import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    skill: z.string(),
    rank: z.number().int().min(1),
    rating: z.number().int().min(1).max(5),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'rare']),
    tags: z.array(z.string()).default([]),
    verdict: z.string(),
  }),
})

export const collections = { notes }
