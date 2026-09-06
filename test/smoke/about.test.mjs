import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('the about page lists every source with its licence and tier', async () => {
  const html = await readFile('dist/about/index.html', 'utf8')
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  for (const source of registry.sources) {
    assert.ok(html.includes(source.name), `missing source ${source.name}`)
    assert.ok(html.includes(source.embedTier), `missing tier for ${source.name}`)
  }
})

test('every source row explains what its tier means, in words', async () => {
  const html = await readFile('dist/about/index.html', 'utf8')
  const NOTES = {
    full: 'Full text reproduced here',
    excerpt: 'Opening excerpt only',
    linkOnly: 'Metadata and structure only',
  }
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  for (const source of registry.sources) {
    assert.ok(NOTES[source.embedTier], `no expected prose for tier "${source.embedTier}"`)
    assert.ok(html.includes(NOTES[source.embedTier]),
      `about page never explains tier "${source.embedTier}" (source ${source.id})`)
  }
})

test('a superpowers skill links to the guided walkthrough', async () => {
  const html = await readFile('dist/skills/superpowers/brainstorming/index.html', 'utf8')
  assert.match(html, /Superpowers-guide\/#\/skill\/brainstorming/)
})

test('a non-superpowers skill has no walkthrough link', async () => {
  const html = await readFile('dist/skills/task-observer/task-observer/index.html', 'utf8')
  assert.doesNotMatch(html, /Superpowers-guide\/#\/skill\//)
})
