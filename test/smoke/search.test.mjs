import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('the search index is emitted with one entry per skill', async () => {
  const index = JSON.parse(await readFile('dist/search-index.json', 'utf8'))
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  assert.equal(index.length, registry.skills.length)
  assert.ok(index.every(e => e.id && e.name), 'every entry needs id and name')
})

test('a curated entry carries its verdict into the index', async () => {
  const index = JSON.parse(await readFile('dist/search-index.json', 'utf8'))
  const entry = index.find(e => e.id === 'superpowers/brainstorming')
  assert.match(entry.verdict, /Stops me letting Claude/)
})

test('the page renders a search input', async () => {
  const h = await readFile('dist/index.html', 'utf8')
  assert.match(h, /id="search"/)
})
