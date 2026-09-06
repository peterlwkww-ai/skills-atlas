import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import matter from 'gray-matter'
import { validateNotes, joinSkills } from '../../src/lib/join.mjs'

const registry = JSON.parse(
  readFileSync(new URL('../../src/data/registry.json', import.meta.url), 'utf8'))

const loadNotes = (dir) => {
  const url = new URL(`../fixtures/${dir}/`, import.meta.url)
  return readdirSync(url).filter(f => f.endsWith('.md')).map(f => {
    const parsed = matter(readFileSync(new URL(f, url), 'utf8'))
    return { id: f.replace(/\.md$/, ''), data: parsed.data, body: parsed.content }
  })
}

test('rule 2: a note pointing at a non-existent skill is an error', () => {
  const errors = validateNotes(registry, loadNotes('notes-orphan'))
  assert.ok(errors.some(e => /does not exist/i.test(e)), `got: ${errors}`)
})

test('rule 3: two notes with the same rank is an error', () => {
  const errors = validateNotes(registry, loadNotes('notes-duplicate-rank'))
  assert.ok(errors.some(e => /duplicate rank/i.test(e)), `got: ${errors}`)
})

test('rule 3: a note with rank 1 and a note with rank "1" no longer silently pass as distinct ranks', () => {
  const notes = [
    {
      id: 'superpowers--brainstorming',
      data: { skill: 'superpowers/brainstorming', rank: 1, rating: 5, frequency: 'weekly', tags: [], verdict: 'V' },
      body: 'text',
    },
    {
      id: 'superpowers--systematic-debugging',
      data: { skill: 'superpowers/systematic-debugging', rank: '1', rating: 5, frequency: 'weekly', tags: [], verdict: 'V' },
      body: 'text',
    },
  ]
  const errors = validateNotes(registry, notes)
  // A Map keyed on the raw value would treat 1 and "1" as different keys and
  // report nothing (the bug). The validated fix rejects the quoted rank
  // outright, so this pair must produce an error naming the offending note —
  // it must NOT come back as [].
  assert.ok(
    errors.some(e => /rank must be an integer/.test(e) && /superpowers--systematic-debugging/.test(e)),
    `got: ${errors}`)
})

test('rule 3: a non-integer rank is rejected outright', () => {
  const notes = [{
    id: 'superpowers--writing-plans',
    data: { skill: 'superpowers/writing-plans', rank: '1', rating: 5, frequency: 'weekly', tags: [], verdict: 'V' },
    body: 'text',
  }]
  const errors = validateNotes(registry, notes)
  assert.ok(
    errors.some(e => /rank must be an integer/.test(e) && /superpowers--writing-plans/.test(e)),
    `got: ${errors}`)
})

test('rule 4: bodyMarkdown set on a source that is not embedTier full is an error', () => {
  const bad = JSON.parse(readFileSync(
    new URL('../fixtures/registry-embed-without-licence.json', import.meta.url), 'utf8'))
  const errors = validateNotes(bad, [])
  assert.ok(errors.some(e => /embedTier/i.test(e) && /bodyMarkdown/i.test(e)), `got: ${errors}`)
})

// Finding 8 (final review, feat/catalogue): rule 4 had only ever been
// exercised against a linkOnly fixture. excerpt is the other restricted
// tier, and it is the branch Finding 4's linkOnly-excerpt bug actually
// lived in — rule 4's own code path for it had never been run by a test.
test('rule 4: bodyMarkdown set on a source with embedTier "excerpt" is also an error', () => {
  const bad = JSON.parse(readFileSync(
    new URL('../fixtures/registry-excerpt-with-bodymarkdown.json', import.meta.url), 'utf8'))
  const errors = validateNotes(bad, [])
  assert.ok(errors.some(e => /embedTier/i.test(e) && /bodyMarkdown/i.test(e) && /excerpt/i.test(e)), `got: ${errors}`)
})

test('a skill with no note joins fine and gets note === null', () => {
  const views = joinSkills(registry, [])
  assert.equal(views.length, registry.skills.length)
  assert.ok(views.every(v => v.note === null))
})

test('a skill with a note carries the note through', () => {
  const notes = [{
    id: 'superpowers--brainstorming',
    data: { skill: 'superpowers/brainstorming', rank: 1, rating: 5, frequency: 'weekly', tags: ['planning'], verdict: 'V' },
    body: '## Why\n\ntext',
  }]
  const view = joinSkills(registry, notes).find(v => v.id === 'superpowers/brainstorming')
  assert.equal(view.note.rank, 1)
  assert.equal(view.note.verdict, 'V')
})
