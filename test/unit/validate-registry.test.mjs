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
  const errors = validateRegistry(fixture('registry-bad-id-format.json'))
  assert.ok(Array.isArray(errors))
})

test('rule 5: rejects a source missing a required field', () => {
  const errors = validateRegistry(fixture('registry-missing-source-field.json'))
  assert.ok(errors.some(e => /missing.*licence/i.test(e)), `expected a missing-field error, got: ${errors}`)
})

test('rule 5: rejects an embedTier outside the three enum values', () => {
  const errors = validateRegistry(fixture('registry-bad-embed-tier.json'))
  assert.ok(errors.some(e => /embedTier/i.test(e)), `expected an embedTier error, got: ${errors}`)
})

test('the real registry passes', () => {
  const real = JSON.parse(readFileSync(new URL('../../src/data/registry.json', import.meta.url), 'utf8'))
  assert.deepEqual(validateRegistry(real), [])
})
