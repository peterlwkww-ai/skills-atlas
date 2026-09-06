import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// This test asserts a single invariant, repo-wide, for every element the
// client scripts toggle with the `hidden` attribute (catalog.js, detail.js):
// no `display`-setting CSS rule may match that element without a
// `:not([hidden])` guard. An author-stylesheet `display` declaration
// outranks the browser's default `[hidden] { display: none }` rule
// regardless of selector specificity, so an unguarded rule silently makes
// `.hidden = true` a no-op — see Findings 1 and 2 (SkillRow.astro's `.row`,
// index.astro's `.grid`) and the pre-existing `#tabs` fix in
// [...id].astro for the first instance of this same mechanism.
//
// This test targets the MECHANISM, not the two previously-reported
// instances, precisely because scoping the fix to only what was reported is
// what let the same bug recur three times on this project. Any element
// added later to the toggle list below is covered automatically.
const TOGGLED_SELECTORS = ['#picks', '#all', '#tabs', '#pane-mine', '#pane-source', '.row', '.card']

const DIST = 'dist'

function walk(dir) {
  let out = []
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out = out.concat(walk(p))
    else out.push(p)
  }
  return out
}

// Gathers CSS text from every place the build can put it: standalone .css
// files under dist/, and <style> blocks inlined into dist/**/*.html (this
// project's Astro build inlines all component styles into a single <style>
// tag per page — there are no separate .css files today, but both sources
// are read so this test keeps working if that ever changes).
function collectCssSources() {
  const files = walk(DIST)
  const sources = []
  for (const file of files) {
    if (file.endsWith('.css')) {
      sources.push({ file, css: readFileSync(file, 'utf8') })
    } else if (file.endsWith('.html')) {
      // <noscript> CSS is excluded on purpose: Finding 7's fallback rule
      // (`#all { display: block !important; }`) exists specifically to
      // defeat the `hidden` attribute for readers with JS disabled, since
      // without JS nothing ever runs to remove it. That is the opposite of
      // this test's target bug (an always-on rule fighting a *script's*
      // runtime toggling) — a <noscript> override only ever applies when no
      // script is toggling anything, so it cannot exhibit that bug and a
      // :not([hidden]) guard on it would defeat its own purpose.
      const html = readFileSync(file, 'utf8').replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
      let m
      while ((m = styleRe.exec(html))) {
        sources.push({ file, css: m[1] })
      }
    }
  }
  return sources
}

// Recursively splits a CSS string into { selector, body } rules, descending
// into @media/@supports/@layer/@container blocks (which wrap ordinary style
// rules) and skipping other at-rules (@font-face, @keyframes, @page, …)
// whose bodies are not selector/declaration pairs.
function extractRules(css, acc = []) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let i = 0
  const n = clean.length
  while (i < n) {
    const braceIdx = clean.indexOf('{', i)
    if (braceIdx === -1) break
    const header = clean.slice(i, braceIdx).trim()
    let depth = 1
    let j = braceIdx + 1
    while (j < n && depth > 0) {
      if (clean[j] === '{') depth++
      else if (clean[j] === '}') depth--
      j++
    }
    const body = clean.slice(braceIdx + 1, j - 1)
    if (/^@(media|supports|layer|container|document)\b/i.test(header)) {
      extractRules(body, acc)
    } else if (/^@/.test(header)) {
      // opaque at-rule (keyframes, font-face, page, charset, ...) — skip
    } else if (header) {
      acc.push({ selector: header, body })
    }
    i = j
  }
  return acc
}

// True if `target` (e.g. ".row" or "#tabs") appears in `selectorText` as its
// own compound-selector token — not merely as a textual prefix of a longer,
// unrelated identifier. Astro inserts a `[data-astro-cid-<hash>]` attribute
// selector immediately after the base selector for every rule in a scoped
// <style> block (e.g. `#tabs[data-astro-cid-ig2ai4ss]:not([hidden])`), so a
// literal `${target}{` or `${target} {` check — which would work against
// hand-written source — matches nothing against real build output. A prior
// verification recipe on this project failed for exactly this reason and
// reported a false pass (see observation log 0022). Checking only that the
// character following the match is not a CSS identifier character correctly
// tells `.row` apart from an unrelated `.row-name`/`.row-source`/`.row-text`
// class (each of those IS its own selector and may set `display` freely; a
// naive substring search would misreport them as instances of `.row`).
function mentionsSelector(selectorText, target) {
  const isIdentChar = (ch) => ch !== undefined && /[A-Za-z0-9_-]/.test(ch)
  let from = 0
  while (true) {
    const pos = selectorText.indexOf(target, from)
    if (pos === -1) return false
    const after = selectorText[pos + target.length]
    if (!isIdentChar(after)) return true
    from = pos + 1
  }
}

function setsDisplay(body) {
  return body.split(';').some(decl => /^\s*display\s*:/i.test(decl))
}

test('hidden-guard: every display-setting rule for a hidden-toggled element carries :not([hidden])', () => {
  const sources = collectCssSources()
  assert.ok(sources.length > 0, 'expected to find at least one CSS source (a .css file or an inlined <style> block) under dist/')

  const violations = []
  for (const { file, css } of sources) {
    const rules = extractRules(css)
    for (const { selector, body } of rules) {
      if (!setsDisplay(body)) continue
      for (const target of TOGGLED_SELECTORS) {
        if (!mentionsSelector(selector, target)) continue
        if (!selector.includes(':not([hidden])')) {
          violations.push(`${file}: selector "${selector}" (matches ${target}) sets display without :not([hidden]) guard — declarations: ${body}`)
        }
      }
    }
  }

  assert.deepEqual(violations, [], `hidden-guard violations found:\n${violations.join('\n')}`)
})
