#!/usr/bin/env node
// sourceUrl 的存活檢查。刻意不放進 CI：外部 HTTP 一旦成為建置的阻塞條件，
// 對方限流或暫時故障就會讓站台無法部署，而且失敗訊息看起來像資料錯誤。
// 手動執行：npm run check-links
import { readFileSync } from 'node:fs'

const registry = JSON.parse(readFileSync(new URL('../src/data/registry.json', import.meta.url), 'utf8'))
const targets = [
  ...registry.sources.flatMap(s => [s.repo, s.licenceUrl].filter(Boolean)),
  ...registry.skills.map(s => s.sourceUrl),
]

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
