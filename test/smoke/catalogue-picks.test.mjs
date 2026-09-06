import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const html = () => readFile('dist/index.html', 'utf8')

test('the picks section renders one card per note', async () => {
  const h = await html()
  // Scoped to #picks: Task 5 gives SkillRow the same data-curated attribute
  // as SkillCard (by design — see task-5-brief's DOM contract), so an
  // unscoped whole-document match now also counts the All-mode rows for
  // the same 2 curated skills and would read 4, not 2.
  const picksStart = h.indexOf('<div id="picks"')
  const allStart = h.indexOf('<div id="all"')
  assert.notEqual(picksStart, -1, 'expected <div id="picks"> in output')
  assert.notEqual(allStart, -1, 'expected <div id="all"> in output')
  const picksBlock = h.slice(picksStart, allStart)
  const cards = picksBlock.match(/data-curated="true"/g) ?? []
  assert.equal(cards.length, 2, 'expected 2 curated cards (brainstorming, task-observer)')
})

test('a curated card shows its rank and verdict', async () => {
  const h = await html()
  assert.match(h, /Stops me letting Claude write code before the design exists/)
  assert.match(h, /class="rank"[^>]*>1</)
})

test('the mode switch offers both modes', async () => {
  const h = await html()
  assert.match(h, /data-mode="picks"/)
  assert.match(h, /data-mode="all"/)
})
