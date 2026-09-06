import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('dist/index.html exists and carries the site title', async () => {
  const html = await readFile('dist/index.html', 'utf8')
  assert.match(html, /<title>[^<]*skills-atlas/i)
})

test('internal links are prefixed with the Pages base path', async () => {
  const html = await readFile('dist/index.html', 'utf8')
  // 不得出現 href="/about" 這種沒帶 base 的絕對路徑內部連結
  assert.doesNotMatch(html, /href="\/(?!skills-atlas\/)[a-z]/)
})
