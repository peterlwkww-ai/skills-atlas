import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import registry from '../data/registry.json'
import { joinSkills } from '../lib/join.mjs'

export const GET: APIRoute = async () => {
  const notes = await getCollection('notes')
  const entries = joinSkills(registry, notes).map(v => ({
    id: v.id,
    name: v.name,
    description: v.description,
    verdict: v.note?.verdict ?? '',
    tags: v.note?.tags ?? [],
  }))
  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json' },
  })
}
