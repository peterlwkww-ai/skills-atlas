import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('every skill gets its own page', async () => {
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  for (const skill of registry.skills) {
    const html = await readFile(`dist/skills/${skill.id}/index.html`, 'utf8')
    assert.match(html, new RegExp(skill.name.replace(/[-]/g, '\\-')))
  }
})

test('a curated page leads with the verdict, before the official description', async () => {
  const html = await readFile('dist/skills/superpowers/brainstorming/index.html', 'utf8')
  const verdictAt = html.indexOf('Stops me letting Claude')
  const officialAt = html.indexOf('You MUST use this before any creative work')
  assert.ok(verdictAt > -1 && officialAt > -1, 'both blocks must render')
  assert.ok(verdictAt < officialAt, 'the verdict must come before the official description')
})

test('a linkOnly skill does not embed full text but does list its headings', async () => {
  const html = await readFile('dist/skills/anthropic/skill-creator/index.html', 'utf8')
  assert.match(html, /Read the full skill/i)
  assert.match(html, /Evals/)
})

test('an embeddable skill carries its attribution line', async () => {
  const html = await readFile('dist/skills/task-observer/task-observer/index.html', 'utf8')
  assert.match(html, /CC BY 4\.0/)
})
