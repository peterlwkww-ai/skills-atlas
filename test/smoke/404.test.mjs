import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('a 404 page exists and links back to the catalogue', async () => {
  const html = await readFile('dist/404.html', 'utf8')
  // href() always resolves through the Pages base path (/skills-atlas), so a
  // stale skill URL on GitHub Pages has a route back rather than dead-ending
  // on GitHub's generic 404 (spec §9).
  assert.match(html, /href="\/skills-atlas\/"/)
})
