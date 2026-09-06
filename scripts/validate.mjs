#!/usr/bin/env node
// astro build 前的資料閘門。任何一條硬規則失敗就 exit 1，讓 CI 紅燈。
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import matter from 'gray-matter'
import { validateRegistry } from '../src/lib/schema.mjs'
import { validateNotes } from '../src/lib/join.mjs'

const registryUrl = new URL('../src/data/registry.json', import.meta.url)
const notesUrl = new URL('../src/content/notes/', import.meta.url)

const registry = JSON.parse(readFileSync(registryUrl, 'utf8'))

const notes = existsSync(notesUrl)
  ? readdirSync(notesUrl).filter(f => f.endsWith('.md')).map(f => {
      const parsed = matter(readFileSync(new URL(f, notesUrl), 'utf8'))
      return { id: f.replace(/\.md$/, ''), data: parsed.data, body: parsed.content }
    })
  : []

const errors = [...validateRegistry(registry), ...validateNotes(registry, notes)]

// 只警告、不擋建置
const warnings = []
const noteTargets = new Set(notes.map(n => n.data?.skill))
const uncurated = registry.skills.filter(s => !noteTargets.has(s.id))
if (uncurated.length) warnings.push(`${uncurated.length} skill(s) have no note (expected — most skills are reference-only)`)
for (const n of notes) {
  if (typeof n.data?.verdict === 'string' && n.data.verdict.length > 120) {
    warnings.push(`note "${n.id}": verdict is ${n.data.verdict.length} chars (over 120 — the card layout will overflow)`)
  }
}

if (errors.length) {
  console.error(`\n✗ validate: ${errors.length} error(s)\n`)
  for (const e of errors) console.error(`  ERROR  ${e}`)
  console.error('')
  process.exit(1)
}

for (const w of warnings) console.warn(`  WARN   ${w}`)
console.log(`✓ validate: ${registry.skills.length} skills, ${registry.sources.length} sources, ${notes.length} notes, 0 errors, ${warnings.length} warning(s)`)
