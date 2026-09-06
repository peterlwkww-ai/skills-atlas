import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mdToSafeHtml } from '../../src/lib/markdown.mjs'

test('a Markdown link gains rel and target while keeping its href', () => {
  const html = mdToSafeHtml('[x](https://example.com "t")')
  assert.equal(html, '<p><a href="https://example.com" title="t" rel="nofollow noopener" target="_blank">x</a></p>\n')
})

test('a raw <script> tag and its contents do not survive', () => {
  const html = mdToSafeHtml('<script>alert(1)</script>')
  assert.ok(!/<script/i.test(html), `expected no <script> tag, got: ${html}`)
  assert.ok(!/alert\(1\)/.test(html), `expected script contents to be removed, got: ${html}`)
})

test('<img src=x onerror=alert(1)> does not survive', () => {
  const html = mdToSafeHtml('<img src=x onerror=alert(1)>')
  assert.ok(!/<img/i.test(html), `expected no <img> tag, got: ${html}`)
  assert.ok(!/onerror/i.test(html), `expected no onerror attribute, got: ${html}`)
})

test('a javascript: link comes back with no href attribute', () => {
  const html = mdToSafeHtml('[x](javascript:alert(1))')
  assert.ok(!/href/i.test(html), `expected no href attribute, got: ${html}`)
})
