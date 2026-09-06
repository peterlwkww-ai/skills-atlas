import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('a curated page renders both tab buttons', async () => {
  const html = await readFile('dist/skills/superpowers/brainstorming/index.html', 'utf8')
  assert.match(html, /data-pane="mine"/)
  assert.match(html, /data-pane="source"/)
})

test('a page with no note renders no tabs at all', async () => {
  const html = await readFile('dist/skills/superpowers/systematic-debugging/index.html', 'utf8')
  assert.doesNotMatch(html, /id="tabs"/)
})

test('the tab strip is hidden by default so desktop shows both panes', async () => {
  const html = await readFile('dist/skills/superpowers/brainstorming/index.html', 'utf8')
  assert.match(html, /<div id="tabs"[^>]*\shidden/)
})
