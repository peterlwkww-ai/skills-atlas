import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateRegistry } from '../../src/lib/schema.mjs'

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'))

test('rule 1: rejects a duplicate skill id', () => {
  const errors = validateRegistry(fixture('registry-duplicate-id.json'))
  assert.ok(errors.some(e => /duplicate/i.test(e)), `expected a duplicate error, got: ${errors}`)
})

test('rule 1: rejects an id that is not <sourceId>/<name>', () => {
  const errors = validateRegistry(fixture('registry-bad-id-format.json'))
  assert.ok(errors.some(e => /id format/i.test(e)), `expected an id-format error, got: ${errors}`)
})

test('rule 1: rejects a skill whose sourceId is not in sources[]', () => {
  const errors = validateRegistry(fixture('registry-orphan-source-id.json'))
  assert.ok(
    errors.some(e => /sourceId "ghost" is not declared/i.test(e)),
    `expected an undeclared-sourceId error, got: ${errors}`)
})

test('rule 5: rejects a source missing a required field', () => {
  const errors = validateRegistry(fixture('registry-missing-source-field.json'))
  assert.ok(errors.some(e => /missing.*licence/i.test(e)), `expected a missing-field error, got: ${errors}`)
})

test('rule 5: rejects an embedTier outside the three enum values', () => {
  const errors = validateRegistry(fixture('registry-bad-embed-tier.json'))
  assert.ok(errors.some(e => /embedTier/i.test(e)), `expected an embedTier error, got: ${errors}`)
})

// Finding 5 (final review, feat/catalogue): attribution must survive into
// the schema, not just the rendered page — CC BY 4.0 §3(a)(1)(A) requires
// retaining creator identification, so a full-tier source with no author
// must fail validation the same way a full-tier source with no licenceUrl
// already does.
test('rule 5: rejects a full-tier source missing author', () => {
  const errors = validateRegistry(fixture('registry-full-missing-author.json'))
  assert.ok(errors.some(e => /author/i.test(e)), `expected an author error, got: ${errors}`)
})

test('the real registry passes', () => {
  const real = JSON.parse(readFileSync(new URL('../../src/data/registry.json', import.meta.url), 'utf8'))
  assert.deepEqual(validateRegistry(real), [])
})
