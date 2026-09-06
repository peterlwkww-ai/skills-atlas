import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const html = () => readFile('dist/index.html', 'utf8')

test('every skill in the registry has a row in the All mode', async () => {
  const h = await html()
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  for (const skill of registry.skills) {
    assert.ok(h.includes(`data-skill-id="${skill.id}"`), `missing row for ${skill.id}`)
  }
})

test('the All container starts hidden so picks is the default view', async () => {
  const h = await html()
  assert.match(h, /<div id="all"[^>]*\shidden/)
})

test('the filter panel offers one checkbox per source', async () => {
  const h = await html()
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  for (const source of registry.sources) {
    assert.ok(h.includes(`value="${source.id}"`), `missing source filter for ${source.id}`)
  }
})

test('rows in All mode do not show rank badges', async () => {
  const h = await html()
  const allStart = h.indexOf('<div id="all"')
  // Guard against String#slice(-1): if <div id="all"> is missing, indexOf
  // returns -1 and slice(-1) silently returns only the final character of
  // the document, so the regex below would trivially pass even when the
  // All-mode markup — and its rank badges — don't exist at all.
  assert.notEqual(allStart, -1, 'expected <div id="all"> to be present in the output')
  const allBlock = h.slice(allStart)
  assert.doesNotMatch(allBlock, /class="rank"/)
})
