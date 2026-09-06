#!/usr/bin/env node
// sourceUrl 的存活檢查。刻意不放進 CI：外部 HTTP 一旦成為建置的阻塞條件，
// 對方限流或暫時故障就會讓站台無法部署，而且失敗訊息看起來像資料錯誤。
// 手動執行：npm run check-links
import { readFileSync } from 'node:fs'

// 這支腳本承諾永遠不以非零碼結束，連讀不到或解析不了 registry 也一樣。
// 少了這層保護，ESM 頂層丟出的例外會讓 Node 以非零碼退出，等於把一個
// 手動工具變成擋事的東西 —— 而它被排除在 CI 之外正是為了不擋事。
let targets = []
try {
  const registry = JSON.parse(readFileSync(new URL('../src/data/registry.json', import.meta.url), 'utf8'))
  targets = [
    ...registry.sources.flatMap(s => [s.repo, s.licenceUrl].filter(Boolean)),
    ...registry.skills.map(s => s.sourceUrl),
  ]
} catch (err) {
  console.error(`could not read src/data/registry.json — ${err.message}`)
  console.error('nothing to check; this script never fails the build.')
  process.exit(0)
}

let bad = 0
for (const url of [...new Set(targets)]) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (res.ok) {
      console.log(`  ok    ${res.status}  ${url}`)
    } else {
      console.warn(`  BAD   ${res.status}  ${url}`)
      bad++
    }
  } catch (err) {
    console.warn(`  ERR         ${url} — ${err.message}`)
    bad++
  }
  // 對外部主機客氣一點：循序、有間隔，不要打成一片
  await new Promise(r => setTimeout(r, 300))
}

console.log(`\n${targets.length} link(s) checked, ${bad} problem(s).`)
console.log('This script never fails the build — fix findings by hand.')
