import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const html = () => readFile('dist/index.html', 'utf8')

test('the picks section renders one card per note', async () => {
  const h = await html()
  const cards = h.match(/data-curated="true"/g) ?? []
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
