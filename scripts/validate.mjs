#!/usr/bin/env node
// astro build 前的資料閘門。任何一條硬規則失敗就 exit 1，讓 CI 紅燈。
import { readFileSync } from 'node:fs'
import { validateRegistry } from '../src/lib/schema.mjs'

const registry = JSON.parse(readFileSync(new URL('../src/data/registry.json', import.meta.url), 'utf8'))

const errors = [...validateRegistry(registry)]
const warnings = []

if (errors.length) {
  console.error(`\n✗ validate: ${errors.length} error(s)\n`)
  for (const e of errors) console.error(`  ERROR  ${e}`)
  console.error('')
  process.exit(1)
}

for (const w of warnings) console.warn(`  WARN   ${w}`)
console.log(`✓ validate: ${registry.skills.length} skills, ${registry.sources.length} sources, 0 errors, ${warnings.length} warning(s)`)
