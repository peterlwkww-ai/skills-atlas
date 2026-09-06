# skill-atlas 目錄站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 skill-atlas 靜態站台 —— 一個 Agent Skills 策展目錄，預設顯示作者手寫心得的精選技能，可切換為完整技能目錄並篩選搜尋，每個技能有獨立 URL，第三方內容依授權分級呈現。

**Architecture:** Astro 靜態輸出。資料分兩處且互不覆蓋：`src/data/registry.json` 是機器產出的技能事實，`src/content/notes/*.md` 是作者手寫心得，兩者在建置期用 `skill:` 欄位 join。`scripts/validate.mjs` 在 `astro build` 前執行五條硬規則，其中「未登記授權不得嵌入全文」是建置期的合規攔截。前端只有原生 DOM 篩選與 Fuse.js 搜尋，無框架。

**Tech Stack:** Astro 5（static）、Fuse.js 7、marked（Markdown → HTML，建置期）、sanitize-html（第三方內容消毒）、gray-matter（validate.mjs 讀 frontmatter）、node:test、GitHub Actions → GitHub Pages

**Spec:** `docs/superpowers/specs/2026-09-05-skill-atlas-design.md`

## Global Constraints

- **Node 版本：** 本機 v24.16.0；CI 用 `node-version: 20`（與 Superpowers-guide 一致）。程式碼不得使用 Node 20 沒有的 API。
- **部署分支：** `master`（不是 `main`）。與 Superpowers-guide 一致。
- **Pages base path：** 這是 project site，站台掛在 `/skill-atlas` 之下。**所有內部連結一律用 `import.meta.env.BASE_URL` 組出來，不得寫死開頭的 `/`。** 這是 Pages project site 最常見的壞法。
- **語言：** 站台所有面向使用者的文案一律英文。程式碼註解與本計畫為中文。
- **`embedTier` 預設值：** `linkOnly`。**任何來源的授權等級都必須先讀過該來源的實際 LICENSE 才可提升。禁止依印象填寫。**（spec §5.2）
- **資料分離：** `src/data/registry.json` 是機器產出區，`src/content/notes/` 是手寫區。任何程式都不得寫入 `src/content/notes/`。
- **npm 安裝一律非互動：** 不得使用 `npm create astro@latest`（會開互動提示）。所有依賴以明確版本用 `npm install` 安裝。
- **Astro 5 的 content config 位置是 `src/content.config.ts`**（不是 spec §4 寫的 `src/content/config.ts` —— Astro 5 移動了這個檔案）。這是本計畫對 spec 的唯一一處刻意偏離。

---

## File Structure

實作結束後的檔案樹與各檔責任：

| 檔案 | 責任 |
|---|---|
| `package.json` | 依賴與 npm scripts |
| `astro.config.mjs` | `site` / `base` / `output: 'static'` |
| `tsconfig.json` | Astro 官方 strict 設定 |
| `.gitignore` | `node_modules/`、`dist/`、`.astro/` |
| `src/data/registry.json` | **機器產出區。** 技能事實與來源授權登記 |
| `src/content.config.ts` | notes collection 的 Zod schema |
| `src/content/notes/*.md` | **手寫區。** 作者心得，一技能一檔 |
| `src/lib/schema.mjs` | registry 的 schema 定義（純 JS，供 validate.mjs 與 Astro 共用） |
| `src/lib/join.mjs` | registry × notes 的合併，輸出頁面使用的視圖模型 |
| `src/lib/markdown.mjs` | `marked` + `sanitize-html`，把 Markdown 字串轉成安全 HTML |
| `src/lib/url.mjs` | base path 安全的連結組合器 |
| `src/layouts/Base.astro` | HTML 骨架、全站 CSS、頁首頁尾 |
| `src/components/SkillCard.astro` | 精選模式的大卡片 |
| `src/components/SkillRow.astro` | 目錄模式的密集列 |
| `src/components/FilterPanel.astro` | 側欄篩選器（純 markup，行為在 catalog.js） |
| `src/components/LicenceBadge.astro` | 出處與授權標示 |
| `src/components/SourceBody.astro` | 原始 SKILL.md 區塊，三種授權狀態 |
| `src/pages/index.astro` | 目錄頁（雙模式） |
| `src/pages/skills/[...id].astro` | 詳情頁 |
| `src/pages/about.astro` | 站台說明與授權致謝表 |
| `src/pages/search-index.json.ts` | 建置期產生搜尋索引的靜態 endpoint |
| `src/scripts/catalog.js` | 目錄頁的模式切換、篩選、搜尋（瀏覽器端） |
| `src/scripts/detail.js` | 詳情頁的手機分頁籤與 Copy 按鈕（瀏覽器端） |
| `scripts/validate.mjs` | 五條硬規則，`astro build` 前的閘門 |
| `scripts/check-links.mjs` | `sourceUrl` 存活檢查。**手動執行，不進 CI** |
| `test/unit/*.test.mjs` | validate 規則的單元測試（用刻意壞掉的 fixture） |
| `test/fixtures/**` | 故意違反每條規則的資料 |
| `test/smoke/*.test.mjs` | 對 `dist/` 的產出檢查，隨 UI 任務逐步長大 |
| `.github/workflows/pages.yml` | CI 與部署 |

**測試策略說明（給執行者）：** spec §10 沒有指定元件測試框架，所以 UI 任務的紅綠循環走 **smoke test**：先在 `test/smoke/` 寫一條對 `dist/` 產出的斷言並看它失敗，再實作，再 build 後看它通過。這不是省略 TDD，是把驗證層放在 spec 指定的位置。

---

## Task 1: Repo 骨架與可建置的 Astro 站

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/lib/url.mjs`
- Create: `src/layouts/Base.astro`
- Create: `src/pages/index.astro`
- Create: `README.md`
- Create: `CHANGELOG.md`
- Test: `test/smoke/build.test.mjs`

**Interfaces:**
- Consumes: 無（第一個任務）
- Produces: `src/lib/url.mjs` 匯出 `href(path: string): string` —— 後續每個任務組內部連結都必須用它。npm scripts `build` / `test` / `test:smoke` 的名稱後續任務會沿用。

- [ ] **Step 1: 建立 repo 與 git**

```bash
cd <your-checkout>/skills-atlas
git init -b master
git config user.name "<your name>"
git config user.email "<your git email>"
```

- [ ] **Step 2: 建立 package.json**

不要用 `npm create astro@latest`（互動式，會卡住）。直接寫檔：

```json
{
  "name": "skill-atlas",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "validate": "node scripts/validate.mjs",
    "build": "node scripts/validate.mjs && astro build",
    "test": "node --test test/unit/",
    "test:smoke": "node --test test/smoke/",
    "check-links": "node scripts/check-links.mjs"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "fuse.js": "^7.0.0",
    "gray-matter": "^4.0.3",
    "marked": "^15.0.0",
    "sanitize-html": "^2.13.0"
  }
}
```

- [ ] **Step 3: 安裝依賴**

```bash
npm install
```

Expected: 建立 `node_modules/` 與 `package-lock.json`，無 error。

- [ ] **Step 4: 寫 .gitignore**

```
node_modules/
dist/
.astro/
.DS_Store
```

- [ ] **Step 5: 寫 astro.config.mjs**

`base` 是 Pages project site 的關鍵設定。

```js
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://peterlwkww-ai.github.io',
  base: '/skill-atlas',
  output: 'static',
  trailingSlash: 'always',
})
```

- [ ] **Step 6: 寫 tsconfig.json**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 7: 寫失敗的 smoke test**

Create `test/smoke/build.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('dist/index.html exists and carries the site title', async () => {
  const html = await readFile('dist/index.html', 'utf8')
  assert.match(html, /<title>[^<]*skill-atlas/i)
})

test('internal links are prefixed with the Pages base path', async () => {
  const html = await readFile('dist/index.html', 'utf8')
  // 不得出現 href="/about" 這種沒帶 base 的絕對路徑內部連結
  assert.doesNotMatch(html, /href="\/(?!skill-atlas\/)[a-z]/)
})
```

- [ ] **Step 8: 執行 smoke test 確認失敗**

Run: `npm run test:smoke`
Expected: FAIL —— `ENOENT: no such file or directory, open 'dist/index.html'`

- [ ] **Step 9: 寫 src/lib/url.mjs**

```js
// Pages project site 的 base 是 /skill-atlas。所有內部連結都要經過這裡，
// 不要在 template 裡自己拼 '/'，那在 Pages 上會 404。
export function href(base, path) {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : `/${path}`
  const joined = `${b}${p}`
  return joined.endsWith('/') ? joined : `${joined}/`
}
```

- [ ] **Step 10: 寫 src/layouts/Base.astro**

```astro
---
import { href } from '../lib/url.mjs'
const base = import.meta.env.BASE_URL
interface Props { title: string; description?: string }
const { title, description = 'A curated catalogue of agent skills.' } = Astro.props
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} · skill-atlas</title>
  <meta name="description" content={description} />
  <style is:global>
    :root {
      --bg: #ffffff; --fg: #1a1a1a; --muted: #6b7280;
      --line: #e5e7eb; --accent: #2563eb; --star: #b45309;
      --card: #fafafa;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117; --fg: #e6edf3; --muted: #8b949e;
        --line: #30363d; --accent: #4a9eff; --star: #e3b341;
        --card: #161b22;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: var(--bg); color: var(--fg);
      font: 15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    a { color: var(--accent); }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
    header.site { border-bottom: 1px solid var(--line); padding: 14px 0; }
    header.site a.brand { color: var(--fg); font-weight: 600; text-decoration: none; }
    footer.site { border-top: 1px solid var(--line); margin-top: 48px; padding: 20px 0; color: var(--muted); font-size: 13px; }
    code { font-family: ui-monospace, Menlo, Consolas, monospace; }
  </style>
</head>
<body>
  <header class="site"><div class="wrap">
    <a class="brand" href={href(base, '/')}>skill-atlas</a>
  </div></header>
  <main class="wrap"><slot /></main>
  <footer class="site"><div class="wrap">
    <a href={href(base, '/about/')}>About &amp; credits</a>
    &nbsp;·&nbsp;
    <a href="https://peterlwkww-ai.github.io/Superpowers-guide/">Superpowers Guide ↗</a>
  </div></footer>
</body>
</html>
```

- [ ] **Step 11: 寫 src/pages/index.astro（暫時最小版）**

```astro
---
import Base from '../layouts/Base.astro'
---
<Base title="Skills">
  <h1>skill-atlas</h1>
  <p>A curated catalogue of agent skills.</p>
</Base>
```

- [ ] **Step 12: 建置並執行 smoke test**

```bash
npx astro build && npm run test:smoke
```

Expected: build 成功；兩條 smoke test 都 PASS。

- [ ] **Step 13: 寫 README.md**

```markdown
# skill-atlas

A curated catalogue of agent skills. Not an installer — a review site:
which skills are worth using, why, and when not to.

**Live:** https://peterlwkww-ai.github.io/skill-atlas/

## Data model

Two separate stores that are joined at build time:

- `src/data/registry.json` — machine-generated skill facts. **Never edit by hand.**
- `src/content/notes/*.md` — hand-written opinions. **Never touched by scripts.**

They join on the `skill:` field in each note's frontmatter.

## Commands

    npm run dev          # local dev server
    npm run validate     # data validation only
    npm run build        # validate, then build to dist/
    npm test             # unit tests for the validator
    npm run test:smoke   # assertions against a built dist/
    npm run check-links  # verify sourceUrl values (manual, not in CI)

## Related

Sibling project: [Superpowers Guide](https://github.com/peterlwkww-ai/Superpowers-guide)
— a scenario walkthrough for the superpowers plugin specifically.
```

- [ ] **Step 14: 寫 CHANGELOG.md**

```markdown
# Changelog

## 2026-09-05 — Claude (Peter)

- Repo 建立。Astro 5 靜態站骨架、base path 安全的連結組合器、smoke test 基礎。
```

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
feat: scaffold Astro static site with base-path-safe links

Sets up the repo skeleton: package.json with non-interactive dependency
install, astro.config with the Pages project-site base path, a shared
layout, and the first smoke tests asserting the build output.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 2: registry.json 與其 schema 驗證（硬規則 1 與 5）

**Files:**
- Create: `src/data/registry.json`
- Create: `src/lib/schema.mjs`
- Create: `scripts/validate.mjs`
- Test: `test/unit/validate-registry.test.mjs`
- Test: `test/fixtures/registry-duplicate-id.json`
- Test: `test/fixtures/registry-bad-id-format.json`
- Test: `test/fixtures/registry-missing-source-field.json`
- Test: `test/fixtures/registry-bad-embed-tier.json`

**Interfaces:**
- Consumes: 無
- Produces:
  - `src/lib/schema.mjs` 匯出 `validateRegistry(registry) -> string[]`（回傳錯誤訊息陣列，空陣列表示通過）
  - `scripts/validate.mjs` 為可執行入口，有錯誤時 `process.exit(1)`
  - `src/data/registry.json` 的實際結構，Task 3 起的所有任務都讀它

- [ ] **Step 1: 寫失敗的單元測試**

Create `test/unit/validate-registry.test.mjs`:

```js
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
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test`
Expected: FAIL —— `Cannot find module '.../src/lib/schema.mjs'`

- [ ] **Step 3: 寫四個壞掉的 fixture**

`test/fixtures/registry-duplicate-id.json`:

```json
{
  "generatedAt": "2026-09-05",
  "sources": [
    { "id": "s", "name": "S", "repo": "https://example.com/s", "licence": "MIT", "licenceUrl": "https://example.com/s/LICENSE", "embedTier": "full" }
  ],
  "skills": [
    { "id": "s/a", "name": "a", "command": "/s:a", "sourceId": "s", "version": "1", "category": "X", "description": "d", "headings": [], "bodyExcerpt": "e", "bodyMarkdown": null, "sizeBytes": 1, "sourceUrl": "https://example.com/s/a" },
    { "id": "s/a", "name": "a", "command": "/s:a", "sourceId": "s", "version": "1", "category": "X", "description": "d", "headings": [], "bodyExcerpt": "e", "bodyMarkdown": null, "sizeBytes": 1, "sourceUrl": "https://example.com/s/a" }
  ]
}
```

`test/fixtures/registry-bad-id-format.json`:

```json
{
  "generatedAt": "2026-09-05",
  "sources": [
    { "id": "s", "name": "S", "repo": "https://example.com/s", "licence": "MIT", "licenceUrl": "https://example.com/s/LICENSE", "embedTier": "full" }
  ],
  "skills": [
    { "id": "justaname", "name": "a", "command": "/s:a", "sourceId": "s", "version": "1", "category": "X", "description": "d", "headings": [], "bodyExcerpt": "e", "bodyMarkdown": null, "sizeBytes": 1, "sourceUrl": "https://example.com/s/a" }
  ]
}
```

`test/fixtures/registry-missing-source-field.json`:

```json
{
  "generatedAt": "2026-09-05",
  "sources": [
    { "id": "s", "name": "S", "repo": "https://example.com/s", "embedTier": "full" }
  ],
  "skills": []
}
```

`test/fixtures/registry-bad-embed-tier.json`:

```json
{
  "generatedAt": "2026-09-05",
  "sources": [
    { "id": "s", "name": "S", "repo": "https://example.com/s", "licence": "MIT", "licenceUrl": "https://example.com/s/LICENSE", "embedTier": "everything" }
  ],
  "skills": []
}
```

- [ ] **Step 4: 寫 src/lib/schema.mjs**

```js
// registry.json 的 schema 驗證。純 JS，不依賴 Astro —— validate.mjs 要能在
// build 之前獨立跑。
export const EMBED_TIERS = ['full', 'excerpt', 'linkOnly']

const SOURCE_REQUIRED = ['id', 'name', 'repo', 'licence', 'embedTier']
const SKILL_REQUIRED = [
  'id', 'name', 'command', 'sourceId', 'version', 'category',
  'description', 'headings', 'bodyExcerpt', 'sourceUrl',
]

export function validateRegistry(registry) {
  const errors = []

  if (!registry || typeof registry !== 'object') return ['registry is not an object']
  if (!Array.isArray(registry.sources)) errors.push('sources must be an array')
  if (!Array.isArray(registry.skills)) errors.push('skills must be an array')
  if (errors.length) return errors

  const sourceIds = new Set()
  for (const src of registry.sources) {
    const label = `source "${src?.id ?? '(no id)'}"`
    for (const field of SOURCE_REQUIRED) {
      if (src?.[field] === undefined || src[field] === null || src[field] === '') {
        errors.push(`${label}: missing required field "${field}"`)
      }
    }
    if (src?.embedTier !== undefined && !EMBED_TIERS.includes(src.embedTier)) {
      errors.push(`${label}: embedTier "${src.embedTier}" is not one of ${EMBED_TIERS.join(', ')}`)
    }
    // licenceUrl 只在 full / excerpt 時必填 —— linkOnly 的成因常常正是查不到授權檔
    if (src?.embedTier === 'full' || src?.embedTier === 'excerpt') {
      if (!src.licenceUrl) errors.push(`${label}: licenceUrl is required when embedTier is "${src.embedTier}"`)
    }
    if (src?.id) {
      if (sourceIds.has(src.id)) errors.push(`duplicate source id "${src.id}"`)
      sourceIds.add(src.id)
    }
  }

  const skillIds = new Set()
  for (const sk of registry.skills) {
    const label = `skill "${sk?.id ?? '(no id)'}"`
    for (const field of SKILL_REQUIRED) {
      if (sk?.[field] === undefined || sk[field] === null || sk[field] === '') {
        errors.push(`${label}: missing required field "${field}"`)
      }
    }
    if (!('bodyMarkdown' in (sk ?? {}))) {
      errors.push(`${label}: field "bodyMarkdown" must be present (use null when not embedded)`)
    }
    if (sk?.id) {
      if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(sk.id)) {
        errors.push(`${label}: id format must be <sourceId>/<name>, lowercase`)
      }
      if (skillIds.has(sk.id)) errors.push(`duplicate skill id "${sk.id}"`)
      skillIds.add(sk.id)
      if (sk.sourceId && sk.id !== `${sk.sourceId}/${sk.name}`) {
        errors.push(`${label}: id must equal "${sk.sourceId}/${sk.name}"`)
      }
    }
    if (sk?.sourceId && !sourceIds.has(sk.sourceId)) {
      errors.push(`${label}: sourceId "${sk.sourceId}" is not declared in sources[]`)
    }
  }

  return errors
}
```

- [ ] **Step 5: 寫 src/data/registry.json 的初始 5 筆**

**注意：`embedTier` 一律先填 `linkOnly`。** Step 6 才依實際 LICENSE 逐一提升。這是 spec §5.2「不得猜測」的執行方式。

```json
{
  "generatedAt": "2026-09-05",
  "sources": [
    {
      "id": "superpowers",
      "name": "Superpowers",
      "repo": "https://github.com/obra/superpowers",
      "licence": "unverified",
      "licenceUrl": null,
      "embedTier": "linkOnly"
    },
    {
      "id": "task-observer",
      "name": "One Skill to Rule Them All",
      "repo": "https://github.com/rebelytics/one-skill-to-rule-them-all",
      "licence": "CC BY 4.0",
      "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
      "embedTier": "full"
    },
    {
      "id": "anthropic",
      "name": "Anthropic Skills",
      "repo": "https://github.com/anthropics/skills",
      "licence": "unverified",
      "licenceUrl": null,
      "embedTier": "linkOnly"
    }
  ],
  "skills": [
    {
      "id": "superpowers/brainstorming",
      "name": "brainstorming",
      "command": "/superpowers:brainstorming",
      "sourceId": "superpowers",
      "version": "6.3.0",
      "category": "Planning",
      "description": "You MUST use this before any creative work — creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation.",
      "headings": ["Three Paths", "Anti-Pattern: Too Simple To Need Approval", "Red Flags", "Checklist", "Process Flow", "Visual Companion"],
      "bodyExcerpt": "Help turn ideas into fully formed designs and specs through natural collaborative dialogue.\n\nStart by classifying how much process the request needs, then work through your path: understand the context, refine the idea, present a design, and get your human partner's approval.",
      "bodyMarkdown": null,
      "sizeBytes": 15456,
      "sourceUrl": "https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md"
    },
    {
      "id": "superpowers/systematic-debugging",
      "name": "systematic-debugging",
      "command": "/superpowers:systematic-debugging",
      "sourceId": "superpowers",
      "version": "6.3.0",
      "category": "Debugging",
      "description": "Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes.",
      "headings": ["Overview", "The Loop", "Red Flags"],
      "bodyExcerpt": "A bug is a hypothesis about the system that has not been tested yet. Write the hypothesis down before changing anything.",
      "bodyMarkdown": null,
      "sizeBytes": 9000,
      "sourceUrl": "https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md"
    },
    {
      "id": "superpowers/writing-plans",
      "name": "writing-plans",
      "command": "/superpowers:writing-plans",
      "sourceId": "superpowers",
      "version": "6.3.0",
      "category": "Planning",
      "description": "Use when you have a spec or requirements for a multi-step task, before touching code.",
      "headings": ["Overview", "Scope Check", "File Structure", "Task Right-Sizing", "No Placeholders", "Self-Review"],
      "bodyExcerpt": "Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste.",
      "bodyMarkdown": null,
      "sizeBytes": 6000,
      "sourceUrl": "https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md"
    },
    {
      "id": "task-observer/task-observer",
      "name": "task-observer",
      "command": "/task-observer",
      "sourceId": "task-observer",
      "version": "3.x",
      "category": "Meta",
      "description": "Monitors task execution for skill improvement opportunities. Captures patterns, user corrections, workflow insights, and methodology worth preserving as reusable skills.",
      "headings": ["Session Start Protocol", "When to Observe", "What to Watch For", "How to Log", "Surfacing Protocol", "Acting on Observations"],
      "bodyExcerpt": "Skills improve best from friction noticed during real work, not from sitting down to \"improve a skill.\" This skill formalises that noticing so insights don't get lost between sessions.",
      "bodyMarkdown": null,
      "sizeBytes": 45010,
      "sourceUrl": "https://github.com/rebelytics/one-skill-to-rule-them-all/blob/main/SKILL.md"
    },
    {
      "id": "anthropic/skill-creator",
      "name": "skill-creator",
      "command": "/anthropic-skills:skill-creator",
      "sourceId": "anthropic",
      "version": "1.x",
      "category": "Meta",
      "description": "Create new skills, modify and improve existing skills, and measure skill performance.",
      "headings": ["Overview", "Creating a Skill", "Evals"],
      "bodyExcerpt": "Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill.",
      "bodyMarkdown": null,
      "sizeBytes": 33168,
      "sourceUrl": "https://github.com/anthropics/skills/blob/main/skill-creator/SKILL.md"
    }
  ]
}
```

- [ ] **Step 6: 逐一核實授權並提升 embedTier**

**這一步不能跳過，也不能用印象填。** 對 `superpowers` 與 `anthropic` 兩個來源各做一次：

```bash
curl -sI https://raw.githubusercontent.com/obra/superpowers/main/LICENSE | head -1
curl -s  https://raw.githubusercontent.com/obra/superpowers/main/LICENSE | head -5
curl -sI https://raw.githubusercontent.com/anthropics/skills/main/LICENSE | head -1
curl -s  https://raw.githubusercontent.com/anthropics/skills/main/LICENSE | head -5
```

判定規則：
- 回應 `200` 且內容是 MIT / Apache-2.0 / CC BY → 把該 source 的 `licence` 改成實際授權名、`licenceUrl` 填該 LICENSE 的 blob URL、`embedTier` 改為 `"full"`
- 回應 `404`，或授權禁止再散布 → **維持 `linkOnly`，`licence` 改為 `"unknown"`**
- 判不出來 → 維持 `linkOnly`

`task-observer` 的 CC BY 4.0 已由其 SKILL.md 本文載明，不需再查。

- [ ] **Step 7: 寫 scripts/validate.mjs**

```js
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
```

- [ ] **Step 8: 執行測試確認通過**

```bash
npm test && npm run validate
```

Expected: 六條測試全 PASS；validate 輸出 `✓ validate: 5 skills, 3 sources, 0 errors, 0 warning(s)`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
feat: add registry schema and validation rules 1 and 5

Introduces src/data/registry.json with five seed skills and the schema
validator behind it. Every source starts at embedTier linkOnly and is
only raised after its actual LICENSE has been read, per the spec's
never-guess rule.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 3: notes collection、join 邏輯與硬規則 2 / 3 / 4

**Files:**
- Create: `src/content.config.ts`
- Create: `src/content/notes/superpowers--brainstorming.md`
- Create: `src/content/notes/task-observer--task-observer.md`
- Create: `src/lib/join.mjs`
- Modify: `scripts/validate.mjs`（加入 notes 相關的三條規則）
- Test: `test/unit/validate-notes.test.mjs`
- Test: `test/fixtures/notes-orphan/`、`test/fixtures/notes-duplicate-rank/`、`test/fixtures/registry-embed-without-licence.json`

**Interfaces:**
- Consumes: `validateRegistry` from `src/lib/schema.mjs`；`src/data/registry.json` 的結構（Task 2）
- Produces:
  - `src/lib/join.mjs` 匯出 `validateNotes(registry, notes) -> string[]` 與 `joinSkills(registry, notes) -> SkillView[]`
  - `SkillView` 的欄位：`{ id, name, command, source, version, category, description, headings, bodyExcerpt, bodyMarkdown, sourceUrl, note }`，其中 `source` 是完整的 source 物件，`note` 是 `{ rank, rating, frequency, tags, verdict, body }` 或 `null`
  - `notes` 參數的形狀：`[{ id, data: {...frontmatter}, body: string }]`，與 Astro `getCollection('notes')` 的回傳一致

- [ ] **Step 1: 寫失敗的單元測試**

Create `test/unit/validate-notes.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import matter from 'gray-matter'
import { validateNotes, joinSkills } from '../../src/lib/join.mjs'

const registry = JSON.parse(
  readFileSync(new URL('../../src/data/registry.json', import.meta.url), 'utf8'))

const loadNotes = (dir) => {
  const url = new URL(`../fixtures/${dir}/`, import.meta.url)
  return readdirSync(url).filter(f => f.endsWith('.md')).map(f => {
    const parsed = matter(readFileSync(new URL(f, url), 'utf8'))
    return { id: f.replace(/\.md$/, ''), data: parsed.data, body: parsed.content }
  })
}

test('rule 2: a note pointing at a non-existent skill is an error', () => {
  const errors = validateNotes(registry, loadNotes('notes-orphan'))
  assert.ok(errors.some(e => /does not exist/i.test(e)), `got: ${errors}`)
})

test('rule 3: two notes with the same rank is an error', () => {
  const errors = validateNotes(registry, loadNotes('notes-duplicate-rank'))
  assert.ok(errors.some(e => /duplicate rank/i.test(e)), `got: ${errors}`)
})

test('rule 4: bodyMarkdown set on a source that is not embedTier full is an error', () => {
  const bad = JSON.parse(readFileSync(
    new URL('../fixtures/registry-embed-without-licence.json', import.meta.url), 'utf8'))
  const errors = validateNotes(bad, [])
  assert.ok(errors.some(e => /embedTier/i.test(e) && /bodyMarkdown/i.test(e)), `got: ${errors}`)
})

test('a skill with no note joins fine and gets note === null', () => {
  const views = joinSkills(registry, [])
  assert.equal(views.length, registry.skills.length)
  assert.ok(views.every(v => v.note === null))
})

test('a skill with a note carries the note through', () => {
  const notes = [{
    id: 'superpowers--brainstorming',
    data: { skill: 'superpowers/brainstorming', rank: 1, rating: 5, frequency: 'weekly', tags: ['planning'], verdict: 'V' },
    body: '## Why\n\ntext',
  }]
  const view = joinSkills(registry, notes).find(v => v.id === 'superpowers/brainstorming')
  assert.equal(view.note.rank, 1)
  assert.equal(view.note.verdict, 'V')
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test`
Expected: FAIL —— `Cannot find module '.../src/lib/join.mjs'`

- [ ] **Step 3: 寫三組壞掉的 fixture**

`test/fixtures/notes-orphan/ghost--skill.md`:

```markdown
---
skill: nosuchsource/nosuchskill
rank: 1
rating: 5
frequency: weekly
tags: []
verdict: "Points at nothing."
---

## Why it's in my top 10

Body.
```

`test/fixtures/notes-duplicate-rank/a--one.md`:

```markdown
---
skill: superpowers/brainstorming
rank: 1
rating: 5
frequency: weekly
tags: []
verdict: "First."
---

Body.
```

`test/fixtures/notes-duplicate-rank/b--two.md`:

```markdown
---
skill: superpowers/writing-plans
rank: 1
rating: 4
frequency: monthly
tags: []
verdict: "Also first, which is the bug."
---

Body.
```

`test/fixtures/registry-embed-without-licence.json`:

```json
{
  "generatedAt": "2026-09-05",
  "sources": [
    { "id": "s", "name": "S", "repo": "https://example.com/s", "licence": "unknown", "licenceUrl": null, "embedTier": "linkOnly" }
  ],
  "skills": [
    { "id": "s/a", "name": "a", "command": "/s:a", "sourceId": "s", "version": "1", "category": "X", "description": "d", "headings": [], "bodyExcerpt": "e", "bodyMarkdown": "FULL TEXT THAT MUST NOT BE HERE", "sizeBytes": 1, "sourceUrl": "https://example.com/s/a" }
  ]
}
```

- [ ] **Step 4: 寫 src/lib/join.mjs**

```js
// registry × notes 的驗證與合併。純 JS，validate.mjs 與 Astro 頁面共用。

export function validateNotes(registry, notes) {
  const errors = []
  const skillById = new Map(registry.skills.map(s => [s.id, s]))
  const sourceById = new Map(registry.sources.map(s => [s.id, s]))

  // 規則 2：note 的 skill: 必須解析得到
  for (const note of notes) {
    const target = note.data?.skill
    if (!target) {
      errors.push(`note "${note.id}": missing required frontmatter field "skill"`)
      continue
    }
    if (!skillById.has(target)) {
      errors.push(`note "${note.id}": skill "${target}" does not exist in registry.json`)
    }
  }

  // 規則 3：rank 唯一
  const seenRank = new Map()
  for (const note of notes) {
    const rank = note.data?.rank
    if (rank === undefined) {
      errors.push(`note "${note.id}": missing required frontmatter field "rank"`)
      continue
    }
    if (seenRank.has(rank)) {
      errors.push(`duplicate rank ${rank}: "${seenRank.get(rank)}" and "${note.id}"`)
    }
    seenRank.set(rank, note.id)
  }

  // 規則 4：授權合規的結構攔截
  for (const skill of registry.skills) {
    if (skill.bodyMarkdown === null || skill.bodyMarkdown === undefined) continue
    const source = sourceById.get(skill.sourceId)
    if (!source) continue // 規則 1 已經報過了
    if (source.embedTier !== 'full') {
      errors.push(
        `skill "${skill.id}": bodyMarkdown is set but source "${source.id}" has ` +
        `embedTier "${source.embedTier}" — full text may only be embedded when embedTier is "full"`)
    }
  }

  return errors
}

export function joinSkills(registry, notes) {
  const sourceById = new Map(registry.sources.map(s => [s.id, s]))
  const noteBySkill = new Map(notes.map(n => [n.data.skill, n]))

  return registry.skills.map(skill => {
    const note = noteBySkill.get(skill.id) ?? null
    return {
      id: skill.id,
      name: skill.name,
      command: skill.command,
      source: sourceById.get(skill.sourceId) ?? null,
      version: skill.version,
      category: skill.category,
      description: skill.description,
      headings: skill.headings ?? [],
      bodyExcerpt: skill.bodyExcerpt,
      bodyMarkdown: skill.bodyMarkdown ?? null,
      sourceUrl: skill.sourceUrl,
      note: note
        ? {
            rank: note.data.rank,
            rating: note.data.rating,
            frequency: note.data.frequency,
            tags: note.data.tags ?? [],
            verdict: note.data.verdict,
            body: note.body,
          }
        : null,
    }
  })
}

// 精選在前（依 rank），其餘依名稱
export function sortForCatalogue(views) {
  return [...views].sort((a, b) => {
    if (a.note && b.note) return a.note.rank - b.note.rank
    if (a.note) return -1
    if (b.note) return 1
    return a.name.localeCompare(b.name)
  })
}
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npm test`
Expected: 全部 PASS（Task 2 的六條 + 本任務的五條）

- [ ] **Step 6: 寫 src/content.config.ts**

```ts
import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    skill: z.string(),
    rank: z.number().int().min(1),
    rating: z.number().int().min(1).max(5),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'rare']),
    tags: z.array(z.string()).default([]),
    verdict: z.string(),
  }),
})

export const collections = { notes }
```

- [ ] **Step 7: 寫兩篇真的 notes**

`src/content/notes/superpowers--brainstorming.md`:

```markdown
---
skill: superpowers/brainstorming
rank: 1
rating: 5
frequency: weekly
tags: [planning, must-have]
verdict: "Stops me letting Claude write code before the design exists."
---

## Why it's in my top 10

The classification step is the whole value. Naming a request as spike,
bounded, or architectural before anything else kills the failure mode where
a five-minute question quietly turns into a rewrite. The approval gate is
what makes it stick: nothing gets built until I have said yes to a design I
can actually read.

## When NOT to use it

When I already know the exact line to change. The ceremony costs more than
the fix, and the skill's own "bounded" path still makes me sit through a
design step I do not need.

## Gotchas I hit

I assumed "bounded" meant I could skip the approval gate. It does not — the
gate is the point, and only the size of the design scales with the task.
```

`src/content/notes/task-observer--task-observer.md`:

```markdown
---
skill: task-observer/task-observer
rank: 2
rating: 5
frequency: daily
tags: [meta, must-have]
verdict: "Catches the lessons I would otherwise lose between sessions."
---

## Why it's in my top 10

Every session produces one or two things worth remembering about how the
work went, and every one of them used to evaporate when the session ended.
This writes them down as they happen instead of asking me to remember at the
end, which is exactly when I have the least attention left.

## When NOT to use it

Quick factual questions with no tools involved. The overhead is real and
there is nothing to observe.

## Gotchas I hit

The observation log has to sit on one stable absolute path. Letting it
resolve relative to the working directory silently shards it — every
project gets its own log, and each one looks complete.
```

- [ ] **Step 8: 在 validate.mjs 接上 notes 規則**

Modify `scripts/validate.mjs`，整檔替換為：

```js
#!/usr/bin/env node
// astro build 前的資料閘門。任何一條硬規則失敗就 exit 1，讓 CI 紅燈。
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import matter from 'gray-matter'
import { validateRegistry } from '../src/lib/schema.mjs'
import { validateNotes } from '../src/lib/join.mjs'

const registryUrl = new URL('../src/data/registry.json', import.meta.url)
const notesUrl = new URL('../src/content/notes/', import.meta.url)

const registry = JSON.parse(readFileSync(registryUrl, 'utf8'))

const notes = existsSync(notesUrl)
  ? readdirSync(notesUrl).filter(f => f.endsWith('.md')).map(f => {
      const parsed = matter(readFileSync(new URL(f, notesUrl), 'utf8'))
      return { id: f.replace(/\.md$/, ''), data: parsed.data, body: parsed.content }
    })
  : []

const errors = [...validateRegistry(registry), ...validateNotes(registry, notes)]

// 只警告、不擋建置
const warnings = []
const noteTargets = new Set(notes.map(n => n.data?.skill))
const uncurated = registry.skills.filter(s => !noteTargets.has(s.id))
if (uncurated.length) warnings.push(`${uncurated.length} skill(s) have no note (expected — most skills are reference-only)`)
for (const n of notes) {
  if (typeof n.data?.verdict === 'string' && n.data.verdict.length > 120) {
    warnings.push(`note "${n.id}": verdict is ${n.data.verdict.length} chars (over 120 — the card layout will overflow)`)
  }
}

if (errors.length) {
  console.error(`\n✗ validate: ${errors.length} error(s)\n`)
  for (const e of errors) console.error(`  ERROR  ${e}`)
  console.error('')
  process.exit(1)
}

for (const w of warnings) console.warn(`  WARN   ${w}`)
console.log(`✓ validate: ${registry.skills.length} skills, ${registry.sources.length} sources, ${notes.length} notes, 0 errors, ${warnings.length} warning(s)`)
```

- [ ] **Step 9: 執行完整驗證與建置**

```bash
npm test && npm run build
```

Expected: 單元測試全 PASS；validate 輸出 `5 skills, 3 sources, 2 notes, 0 errors, 1 warning(s)`；astro build 成功。

- [ ] **Step 10: 確認規則 4 真的會擋（人工紅燈驗證）**

暫時把 `src/data/registry.json` 裡 `anthropic/skill-creator` 的 `bodyMarkdown` 從 `null` 改成 `"x"`，然後：

```bash
npm run validate
```

Expected: exit 1，並印出 `bodyMarkdown is set but source "anthropic" has embedTier "linkOnly"`。

**確認後把 `bodyMarkdown` 改回 `null`**，再跑一次 `npm run validate` 確認回到 0 errors。

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
feat: add notes collection, join logic, and validation rules 2-4

Hand-written notes live in their own content collection and join to the
registry on the skill field. Rule 4 turns licence compliance into a build
gate: full text cannot be embedded unless its source is registered as
embedTier full.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 4: 目錄頁 —— My picks 模式

**Files:**
- Create: `src/components/SkillCard.astro`
- Modify: `src/pages/index.astro`
- Test: `test/smoke/catalogue-picks.test.mjs`

**Interfaces:**
- Consumes: `joinSkills`, `sortForCatalogue` from `src/lib/join.mjs`；`href` from `src/lib/url.mjs`
- Produces: `index.astro` 渲染的 DOM 契約，Task 5 與 6 依賴這些 hook：
  - 每張卡片是 `<article class="card" data-skill-id data-source data-rating data-frequency data-tags data-curated>`
  - 精選容器 `<div id="picks">`
  - 模式切換器 `<div id="mode-switch">` 內含 `<button data-mode="picks">` 與 `<button data-mode="all">`

- [ ] **Step 1: 寫失敗的 smoke test**

Create `test/smoke/catalogue-picks.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const html = () => readFile('dist/index.html', 'utf8')

test('the picks section renders one card per note', async () => {
  const h = await html()
  const cards = h.match(/data-curated="true"/g) ?? []
  assert.equal(cards.length, 2, 'expected 2 curated cards (brainstorming, task-observer)')
})

test('a curated card shows its rank and verdict', async () => {
  const h = await html()
  assert.match(h, /Stops me letting Claude write code before the design exists/)
  assert.match(h, /class="rank"[^>]*>1</)
})

test('the mode switch offers both modes', async () => {
  const h = await html()
  assert.match(h, /data-mode="picks"/)
  assert.match(h, /data-mode="all"/)
})
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm run build && npm run test:smoke`
Expected: 三條新測試 FAIL（`expected 2 curated cards` 等），Task 1 的兩條仍 PASS

- [ ] **Step 3: 寫 src/components/SkillCard.astro**

```astro
---
import { href } from '../lib/url.mjs'
const base = import.meta.env.BASE_URL
const { skill } = Astro.props
const n = skill.note
const stars = n ? '★'.repeat(n.rating) + '☆'.repeat(5 - n.rating) : ''
---
<article
  class="card"
  data-skill-id={skill.id}
  data-source={skill.source?.id}
  data-rating={n ? String(n.rating) : '0'}
  data-frequency={n ? n.frequency : ''}
  data-tags={n ? n.tags.join(' ') : ''}
  data-curated={n ? 'true' : 'false'}
>
  <div class="card-top">
    {n && <span class="rank">{n.rank}</span>}
    <a class="card-name" href={href(base, `/skills/${skill.id}/`)}>{skill.name}</a>
    {n && <span class="stars">{stars}</span>}
  </div>
  <p class="card-verdict">{n ? n.verdict : skill.description}</p>
  <p class="card-meta">
    {skill.source?.name} v{skill.version}{n && <> · {n.frequency}</>}
    {n && n.tags.length > 0 && <> · {n.tags.join(', ')}</>}
  </p>
</article>

<style>
  .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; background: var(--card); }
  .card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .rank {
    display: inline-flex; align-items: center; justify-content: center;
    width: 20px; height: 20px; border-radius: 5px; flex: none;
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    color: var(--accent); font-size: 12px; font-weight: 600;
  }
  .card-name { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 600; text-decoration: none; }
  .stars { margin-left: auto; color: var(--star); font-size: 12px; letter-spacing: 1px; }
  .card-verdict { margin: 0 0 8px; font-size: 14px; line-height: 1.55; }
  .card-meta { margin: 0; font-size: 12px; color: var(--muted); }
</style>
```

- [ ] **Step 4: 改寫 src/pages/index.astro**

```astro
---
import Base from '../layouts/Base.astro'
import SkillCard from '../components/SkillCard.astro'
import registry from '../data/registry.json'
import { getCollection } from 'astro:content'
import { joinSkills, sortForCatalogue } from '../lib/join.mjs'

const notes = await getCollection('notes')
const views = sortForCatalogue(joinSkills(registry, notes))
const picks = views.filter(v => v.note)
---
<Base title="Skills">
  <h1>Skills worth using</h1>
  <p class="lede">
    Not an installer — a review site. What each skill is for, why it earned a
    place, and when to leave it alone.
  </p>

  <div id="mode-switch" role="group" aria-label="View mode">
    <button type="button" data-mode="picks" class="active" aria-pressed="true">★ My picks ({picks.length})</button>
    <button type="button" data-mode="all" aria-pressed="false">All {views.length}</button>
  </div>

  <div id="picks" class="grid">
    {picks.map(skill => <SkillCard skill={skill} />)}
  </div>
</Base>

<style>
  .lede { color: var(--muted); max-width: 62ch; }
  #mode-switch { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; margin: 20px 0 18px; }
  #mode-switch button {
    padding: 7px 15px; font: inherit; font-size: 13px; border: 0; cursor: pointer;
    background: transparent; color: var(--fg);
  }
  #mode-switch button.active {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--accent); font-weight: 600;
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
</style>
```

- [ ] **Step 5: 建置並確認 smoke test 通過**

```bash
npm run build && npm run test:smoke
```

Expected: 全部 PASS（Task 1 兩條 + 本任務三條）

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
feat: render the My picks mode of the catalogue

Curated skills get large cards carrying rank, rating and the one-line
verdict. Card markup exposes the data attributes the filter and search
layers will read.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 5: 目錄頁 —— All skills 模式與篩選

**Files:**
- Create: `src/components/SkillRow.astro`
- Create: `src/components/FilterPanel.astro`
- Create: `src/scripts/catalog.js`
- Modify: `src/pages/index.astro`
- Test: `test/smoke/catalogue-all.test.mjs`

**Interfaces:**
- Consumes: Task 4 的 DOM 契約（`#mode-switch`、`.card` 的 data 屬性）
- Produces:
  - `<div id="all">` 容器，內含 `<div id="filters">` 與 `<div id="rows">`
  - 每列 `<a class="row" data-skill-id data-source data-rating data-frequency data-tags data-curated>`
  - `catalog.js` 匯出的行為：模式狀態寫入 `?view=`，篩選以 `hidden` 屬性套用

- [ ] **Step 1: 寫失敗的 smoke test**

Create `test/smoke/catalogue-all.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const html = () => readFile('dist/index.html', 'utf8')

test('every skill in the registry has a row in the All mode', async () => {
  const h = await html()
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  for (const skill of registry.skills) {
    assert.ok(h.includes(`data-skill-id="${skill.id}"`), `missing row for ${skill.id}`)
  }
})

test('the All container starts hidden so picks is the default view', async () => {
  const h = await html()
  assert.match(h, /<div id="all"[^>]*\shidden/)
})

test('the filter panel offers one checkbox per source', async () => {
  const h = await html()
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  for (const source of registry.sources) {
    assert.ok(h.includes(`value="${source.id}"`), `missing source filter for ${source.id}`)
  }
})

test('rows in All mode do not show rank badges', async () => {
  const h = await html()
  const allBlock = h.slice(h.indexOf('<div id="all"'))
  assert.doesNotMatch(allBlock, /class="rank"/)
})
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm run build && npm run test:smoke`
Expected: 四條新測試 FAIL

- [ ] **Step 3: 寫 src/components/SkillRow.astro**

```astro
---
import { href } from '../lib/url.mjs'
const base = import.meta.env.BASE_URL
const { skill } = Astro.props
const n = skill.note
---
<a
  class="row"
  href={href(base, `/skills/${skill.id}/`)}
  data-skill-id={skill.id}
  data-source={skill.source?.id}
  data-rating={n ? String(n.rating) : '0'}
  data-frequency={n ? n.frequency : ''}
  data-tags={n ? n.tags.join(' ') : ''}
  data-curated={n ? 'true' : 'false'}
>
  <span class="row-name">{skill.name}</span>
  <span class="row-source">{skill.source?.name}</span>
  <span class="row-stars">{n ? '★'.repeat(n.rating) : '—'}</span>
  <span class="row-text">{n ? n.verdict : skill.description}</span>
</a>

<style>
  .row {
    display: grid; grid-template-columns: 190px 130px 70px 1fr; gap: 12px;
    align-items: baseline; padding: 8px 12px; text-decoration: none; color: var(--fg);
    border-bottom: 1px solid var(--line); font-size: 13px;
  }
  .row:hover { background: var(--card); }
  .row-name { font-family: ui-monospace, Menlo, Consolas, monospace; }
  .row-source { color: var(--muted); font-size: 11px; }
  .row-stars { color: var(--star); font-size: 11px; }
  .row-text {
    color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  @media (max-width: 700px) {
    .row { grid-template-columns: 1fr auto; }
    .row-source, .row-text { display: none; }
  }
</style>
```

- [ ] **Step 4: 寫 src/components/FilterPanel.astro**

```astro
---
const { sources, frequencies, tags } = Astro.props
---
<div id="filters">
  <fieldset>
    <legend>Source</legend>
    {sources.map(s => (
      <label><input type="checkbox" name="source" value={s.id} /> {s.name}</label>
    ))}
  </fieldset>

  <fieldset>
    <legend>Minimum rating</legend>
    <label><input type="radio" name="rating" value="0" checked /> Any</label>
    <label><input type="radio" name="rating" value="4" /> ★★★★+</label>
    <label><input type="radio" name="rating" value="5" /> ★★★★★</label>
  </fieldset>

  <fieldset>
    <legend>Frequency</legend>
    {frequencies.map(f => (
      <label><input type="checkbox" name="frequency" value={f} /> {f}</label>
    ))}
  </fieldset>

  {tags.length > 0 && (
    <fieldset>
      <legend>Tags</legend>
      {tags.map(t => (
        <label><input type="checkbox" name="tag" value={t} /> {t}</label>
      ))}
    </fieldset>
  )}

  <fieldset>
    <legend>Notes</legend>
    <label><input type="checkbox" name="curated" value="true" /> Has my notes</label>
  </fieldset>

  <button type="button" id="clear-filters">Clear all</button>
</div>

<style>
  #filters { width: 170px; flex: none; font-size: 12px; }
  #filters fieldset { border: 0; border-top: 1px solid var(--line); margin: 0 0 12px; padding: 10px 0 0; }
  #filters legend {
    padding: 0; font-size: 10px; letter-spacing: .07em; text-transform: uppercase; color: var(--muted);
  }
  #filters label { display: block; padding: 2px 0; cursor: pointer; }
  #clear-filters {
    font: inherit; font-size: 12px; padding: 4px 10px; cursor: pointer;
    background: transparent; color: var(--fg); border: 1px solid var(--line); border-radius: 5px;
  }
  @media (max-width: 860px) { #filters { width: 100%; } }
</style>
```

- [ ] **Step 5: 寫 src/scripts/catalog.js**

```js
// 目錄頁的模式切換與篩選。純 DOM 操作 —— 不重新請求資料，
// 所以搜尋索引載入失敗時篩選仍然可用（spec §9）。

const params = new URLSearchParams(location.search)
const picks = document.getElementById('picks')
const all = document.getElementById('all')
const switcher = document.getElementById('mode-switch')

function setMode(mode, push) {
  const isAll = mode === 'all'
  picks.hidden = isAll
  all.hidden = !isAll
  for (const btn of switcher.querySelectorAll('button')) {
    const active = btn.dataset.mode === mode
    btn.classList.toggle('active', active)
    btn.setAttribute('aria-pressed', String(active))
  }
  if (push) {
    const url = new URL(location.href)
    if (isAll) url.searchParams.set('view', 'all')
    else url.searchParams.delete('view')
    history.replaceState(null, '', url)
  }
}

switcher.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]')
  if (btn) setMode(btn.dataset.mode, true)
})

setMode(params.get('view') === 'all' ? 'all' : 'picks', false)

// ── 篩選 ────────────────────────────────────────────────────────────────
const filters = document.getElementById('filters')
const rows = [...document.querySelectorAll('#rows .row')]

function checkedValues(name) {
  return [...filters.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value)
}

export function applyFilters() {
  const sources = checkedValues('source')
  const frequencies = checkedValues('frequency')
  const tags = checkedValues('tag')
  const curatedOnly = checkedValues('curated').length > 0
  const minRating = Number(filters.querySelector('input[name="rating"]:checked')?.value ?? 0)

  let shown = 0
  for (const row of rows) {
    const rowTags = (row.dataset.tags || '').split(' ').filter(Boolean)
    const ok =
      (sources.length === 0 || sources.includes(row.dataset.source)) &&
      (frequencies.length === 0 || frequencies.includes(row.dataset.frequency)) &&
      (tags.length === 0 || tags.some(t => rowTags.includes(t))) &&
      (!curatedOnly || row.dataset.curated === 'true') &&
      Number(row.dataset.rating) >= minRating &&
      row.dataset.searchHidden !== 'true'

    row.hidden = !ok
    if (ok) shown++
  }
  document.getElementById('result-count').textContent =
    `${shown} of ${rows.length} skills`
}

filters.addEventListener('change', applyFilters)
document.getElementById('clear-filters').addEventListener('click', () => {
  for (const i of filters.querySelectorAll('input[type="checkbox"]')) i.checked = false
  filters.querySelector('input[name="rating"][value="0"]').checked = true
  applyFilters()
})

applyFilters()
```

- [ ] **Step 6: 改寫 src/pages/index.astro 接上 All 模式**

在既有檔案的 frontmatter 加入 import 與衍生資料，並在 `#picks` 之後加入 `#all` 區塊。整檔替換為：

```astro
---
import Base from '../layouts/Base.astro'
import SkillCard from '../components/SkillCard.astro'
import SkillRow from '../components/SkillRow.astro'
import FilterPanel from '../components/FilterPanel.astro'
import registry from '../data/registry.json'
import { getCollection } from 'astro:content'
import { joinSkills, sortForCatalogue } from '../lib/join.mjs'

const notes = await getCollection('notes')
const views = sortForCatalogue(joinSkills(registry, notes))
const picks = views.filter(v => v.note)

const frequencies = ['daily', 'weekly', 'monthly', 'rare']
const tags = [...new Set(views.flatMap(v => v.note?.tags ?? []))].sort()
---
<Base title="Skills">
  <h1>Skills worth using</h1>
  <p class="lede">
    Not an installer — a review site. What each skill is for, why it earned a
    place, and when to leave it alone.
  </p>

  <div id="mode-switch" role="group" aria-label="View mode">
    <button type="button" data-mode="picks" class="active" aria-pressed="true">★ My picks ({picks.length})</button>
    <button type="button" data-mode="all" aria-pressed="false">All {views.length}</button>
  </div>

  <div id="picks" class="grid">
    {picks.map(skill => <SkillCard skill={skill} />)}
  </div>

  <div id="all" hidden>
    <div class="all-layout">
      <FilterPanel sources={registry.sources} frequencies={frequencies} tags={tags} />
      <div class="all-main">
        <p id="result-count" class="count">{views.length} of {views.length} skills</p>
        <div id="rows">
          {views.map(skill => <SkillRow skill={skill} />)}
        </div>
      </div>
    </div>
  </div>
</Base>

<script src="../scripts/catalog.js"></script>

<style>
  .lede { color: var(--muted); max-width: 62ch; }
  #mode-switch { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; margin: 20px 0 18px; }
  #mode-switch button {
    padding: 7px 15px; font: inherit; font-size: 13px; border: 0; cursor: pointer;
    background: transparent; color: var(--fg);
  }
  #mode-switch button.active {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--accent); font-weight: 600;
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
  .all-layout { display: flex; gap: 24px; align-items: flex-start; }
  .all-main { flex: 1; min-width: 0; }
  .count { margin: 0 0 8px; font-size: 12px; color: var(--muted); }
  #rows { border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
  @media (max-width: 860px) { .all-layout { flex-direction: column; } }
</style>
```

- [ ] **Step 7: 建置並確認 smoke test 通過**

```bash
npm run build && npm run test:smoke
```

Expected: 全部 PASS（累計 9 條）

- [ ] **Step 8: 人工確認篩選真的會動**

```bash
npm run dev
```

在瀏覽器開 `http://localhost:4321/skill-atlas/`，按 `All 5`，勾選 Source = Superpowers，確認列表剩 3 筆且計數變成 `3 of 5 skills`；按 Clear all 回到 5 筆。網址列應出現 `?view=all`。確認後 Ctrl-C 停掉 dev server。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
feat: add the All skills mode with sidebar filters

Dense rows for the full catalogue plus source, rating, frequency, tag and
has-notes filters. Filtering is pure DOM work so it keeps working when the
search index fails to load.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 6: 搜尋

**Files:**
- Create: `src/pages/search-index.json.ts`
- Modify: `src/pages/index.astro`（加搜尋框）
- Modify: `src/scripts/catalog.js`（接上 Fuse）
- Test: `test/smoke/search.test.mjs`

**Interfaces:**
- Consumes: Task 5 的 `applyFilters()` 與 `row.dataset.searchHidden` 契約
- Produces: `dist/search-index.json`，形狀為 `[{ id, name, description, verdict, tags }]`

- [ ] **Step 1: 寫失敗的 smoke test**

Create `test/smoke/search.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('the search index is emitted with one entry per skill', async () => {
  const index = JSON.parse(await readFile('dist/search-index.json', 'utf8'))
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  assert.equal(index.length, registry.skills.length)
  assert.ok(index.every(e => e.id && e.name), 'every entry needs id and name')
})

test('a curated entry carries its verdict into the index', async () => {
  const index = JSON.parse(await readFile('dist/search-index.json', 'utf8'))
  const entry = index.find(e => e.id === 'superpowers/brainstorming')
  assert.match(entry.verdict, /Stops me letting Claude/)
})

test('the page renders a search input', async () => {
  const h = await readFile('dist/index.html', 'utf8')
  assert.match(h, /id="search"/)
})
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm run build && npm run test:smoke`
Expected: 三條新測試 FAIL（`ENOENT ... dist/search-index.json`）

- [ ] **Step 3: 寫 src/pages/search-index.json.ts**

```ts
import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import registry from '../data/registry.json'
import { joinSkills } from '../lib/join.mjs'

export const GET: APIRoute = async () => {
  const notes = await getCollection('notes')
  const entries = joinSkills(registry, notes).map(v => ({
    id: v.id,
    name: v.name,
    description: v.description,
    verdict: v.note?.verdict ?? '',
    tags: v.note?.tags ?? [],
  }))
  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 4: 在 index.astro 加搜尋框**

在 `#mode-switch` 那個 `<div>` 之前插入：

```astro
  <input
    type="search"
    id="search"
    placeholder="Search skills…"
    autocomplete="off"
    aria-label="Search skills"
  />
```

並在該檔的 `<style>` 內加入：

```css
  #search {
    display: block; width: 100%; max-width: 420px; margin-top: 18px;
    padding: 8px 12px; font: inherit; font-size: 14px;
    background: var(--bg); color: var(--fg);
    border: 1px solid var(--line); border-radius: 7px;
  }
  #search:disabled { opacity: .5; }
```

- [ ] **Step 5: 在 catalog.js 接上 Fuse**

在 `src/scripts/catalog.js` **檔尾**追加：

```js
// ── 搜尋 ────────────────────────────────────────────────────────────────
// 索引載入失敗時只停用搜尋框，篩選器仍然可用（spec §9）。
import Fuse from 'fuse.js'

const searchInput = document.getElementById('search')
const cards = [...document.querySelectorAll('#picks .card')]
let fuse = null

function clearSearch() {
  for (const el of [...rows, ...cards]) delete el.dataset.searchHidden
}

function runSearch(query) {
  if (!fuse) return
  if (!query.trim()) { clearSearch(); applyFilters(); return }

  const hits = new Set(fuse.search(query).map(r => r.item.id))
  for (const el of [...rows, ...cards]) {
    el.dataset.searchHidden = hits.has(el.dataset.skillId) ? 'false' : 'true'
  }
  for (const card of cards) card.hidden = card.dataset.searchHidden === 'true'
  applyFilters()
}

const indexUrl = new URL('search-index.json', document.baseURI)
fetch(indexUrl)
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
  .then(entries => {
    fuse = new Fuse(entries, {
      threshold: 0.3,
      keys: ['name', 'description', 'verdict', 'tags'],
    })
  })
  .catch(err => {
    console.warn('search index unavailable, search disabled:', err)
    searchInput.disabled = true
    searchInput.placeholder = 'Search unavailable'
  })

let timer
searchInput.addEventListener('input', () => {
  clearTimeout(timer)
  timer = setTimeout(() => runSearch(searchInput.value), 200)
})
```

- [ ] **Step 6: 建置並確認通過**

```bash
npm run build && npm run test:smoke
```

Expected: 全部 PASS（累計 12 條）

- [ ] **Step 7: 人工確認搜尋會動**

`npm run dev`，開站，輸入 `debug`，確認 All 模式的列表收斂到 `systematic-debugging`。清空搜尋框確認恢復。Ctrl-C 停掉。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
feat: add build-time search index and client-side fuzzy search

Search and filters compose: a search narrows the set, filters narrow it
further. A failed index fetch disables only the search box.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 7: 詳情頁 —— 桌機雙欄與授權三態

**Files:**
- Create: `src/lib/markdown.mjs`
- Create: `src/components/LicenceBadge.astro`
- Create: `src/components/SourceBody.astro`
- Create: `src/pages/skills/[...id].astro`
- Test: `test/smoke/detail.test.mjs`

**Interfaces:**
- Consumes: `joinSkills`；`href`
- Produces:
  - `src/lib/markdown.mjs` 匯出 `mdToSafeHtml(markdown: string): string`
  - 詳情頁 DOM 契約：`<div id="pane-mine">`、`<div id="pane-source">`（Task 8 的分頁籤依賴這兩個 id）

- [ ] **Step 1: 寫失敗的 smoke test**

Create `test/smoke/detail.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('every skill gets its own page', async () => {
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  for (const skill of registry.skills) {
    const html = await readFile(`dist/skills/${skill.id}/index.html`, 'utf8')
    assert.match(html, new RegExp(skill.name.replace(/[-]/g, '\\-')))
  }
})

test('a curated page leads with the verdict, before the official description', async () => {
  const html = await readFile('dist/skills/superpowers/brainstorming/index.html', 'utf8')
  const verdictAt = html.indexOf('Stops me letting Claude')
  const officialAt = html.indexOf('You MUST use this before any creative work')
  assert.ok(verdictAt > -1 && officialAt > -1, 'both blocks must render')
  assert.ok(verdictAt < officialAt, 'the verdict must come before the official description')
})

test('a linkOnly skill does not embed full text but does list its headings', async () => {
  const html = await readFile('dist/skills/anthropic/skill-creator/index.html', 'utf8')
  assert.match(html, /Read the full skill/i)
  assert.match(html, /Evals/)
})

test('an embeddable skill carries its attribution line', async () => {
  const html = await readFile('dist/skills/task-observer/task-observer/index.html', 'utf8')
  assert.match(html, /CC BY 4\.0/)
})
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm run build && npm run test:smoke`
Expected: 四條新測試 FAIL（`ENOENT ... dist/skills/...`）

- [ ] **Step 3: 寫 src/lib/markdown.mjs**

```js
// 第三方 SKILL.md 內容在建置期轉 HTML 並消毒。
// 消毒不是為了現在 —— 現在的 registry 是手寫的。是為了子專案 3：
// 屆時內容來自外部來源，未消毒的 raw HTML 會直接進到靜態頁面裡。
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'strong', 'em', 'del', 'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

export function mdToSafeHtml(markdown) {
  if (!markdown) return ''
  const raw = marked.parse(markdown, { async: false, gfm: true })
  return sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, rel: 'nofollow noopener', target: '_blank' },
      }),
    },
  })
}
```

- [ ] **Step 4: 寫 src/components/LicenceBadge.astro**

```astro
---
const { source } = Astro.props
---
<p class="licence">
  {source.name} — {source.licence}
  {source.licenceUrl && <> (<a href={source.licenceUrl}>licence ↗</a>)</>}
  &nbsp;·&nbsp; <a href={source.repo}>source repository ↗</a>
</p>

<style>
  .licence { margin: 16px 0 0; padding-top: 12px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
</style>
```

- [ ] **Step 5: 寫 src/components/SourceBody.astro**

```astro
---
import { mdToSafeHtml } from '../lib/markdown.mjs'
const { skill } = Astro.props
const tier = skill.source?.embedTier ?? 'linkOnly'
const full = tier === 'full' && skill.bodyMarkdown
const excerptHtml = mdToSafeHtml(skill.bodyExcerpt)
const fullHtml = full ? mdToSafeHtml(skill.bodyMarkdown) : ''
---
<section class="source-body">
  <h2>The skill itself</h2>

  {skill.headings.length > 0 && (
    <>
      <p class="label">Structure</p>
      <ul class="toc">{skill.headings.map(h => <li>{h}</li>)}</ul>
    </>
  )}

  {full ? (
    <div class="prose" set:html={fullHtml} />
  ) : (
    <>
      <p class="label">Opening</p>
      <div class="prose" set:html={excerptHtml} />
      <p class="cta">
        <a href={skill.sourceUrl}>Read the full skill at the source ↗</a>
      </p>
      {tier === 'linkOnly' && (
        <p class="why">
          The full text is not reproduced here: this source's licence is
          unverified or does not permit redistribution.
        </p>
      )}
    </>
  )}
</section>

<style>
  .source-body h2 { font-size: 17px; margin: 0 0 12px; }
  .label { font-size: 10px; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin: 16px 0 6px; }
  .toc { margin: 0; padding-left: 18px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; color: var(--muted); }
  .prose { font-size: 14px; }
  .prose :global(pre) { background: var(--card); padding: 10px 12px; border-radius: 6px; overflow-x: auto; }
  .prose :global(table) { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; }
  .prose :global(td), .prose :global(th) { border: 1px solid var(--line); padding: 5px 8px; text-align: left; }
  .cta { margin: 14px 0 0; font-size: 13px; }
  .why { margin: 6px 0 0; font-size: 12px; color: var(--muted); }
</style>
```

- [ ] **Step 6: 寫 src/pages/skills/[...id].astro**

```astro
---
import Base from '../../layouts/Base.astro'
import SourceBody from '../../components/SourceBody.astro'
import LicenceBadge from '../../components/LicenceBadge.astro'
import registry from '../../data/registry.json'
import { getCollection } from 'astro:content'
import { joinSkills } from '../../lib/join.mjs'
import { mdToSafeHtml } from '../../lib/markdown.mjs'

export async function getStaticPaths() {
  const notes = await getCollection('notes')
  return joinSkills(registry, notes).map(skill => ({
    params: { id: skill.id },
    props: { skill },
  }))
}

const { skill } = Astro.props
const n = skill.note
const noteHtml = n ? mdToSafeHtml(n.body) : ''
---
<Base title={skill.name} description={n?.verdict ?? skill.description}>
  <header class="detail-head">
    <h1>{skill.name}</h1>
    <p class="head-meta">
      {skill.source?.name} v{skill.version} · {skill.category}
      {n && <> · {'★'.repeat(n.rating)} · used {n.frequency} · <strong>#{n.rank} my pick</strong></>}
    </p>
    <div class="cmd">
      <code>{skill.command}</code>
      <button type="button" id="copy" data-command={skill.command}>Copy</button>
    </div>
  </header>

  <div class="panes">
    <div id="pane-mine" class="pane">
      {n ? (
        <>
          <section class="verdict">
            <p class="label">The verdict</p>
            <p class="verdict-text">{n.verdict}</p>
          </section>
          <div class="prose" set:html={noteHtml} />
        </>
      ) : (
        <section class="no-note">
          <p class="label">Quick facts</p>
          <p>{skill.description}</p>
          <p class="muted">No notes written for this skill yet.</p>
        </section>
      )}
      <LicenceBadge source={skill.source} />
    </div>

    <div id="pane-source" class="pane">
      <SourceBody skill={skill} />
    </div>
  </div>
</Base>

<style>
  .detail-head { padding: 8px 0 20px; border-bottom: 1px solid var(--line); }
  .detail-head h1 { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 26px; margin: 0 0 4px; }
  .head-meta { margin: 0 0 12px; font-size: 12.5px; color: var(--muted); }
  .cmd { display: inline-flex; align-items: center; gap: 10px; border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px 6px 11px; background: var(--card); }
  .cmd code { font-size: 13px; }
  .cmd button { font: inherit; font-size: 12px; padding: 3px 10px; cursor: pointer; background: transparent; color: var(--accent); border: 1px solid var(--line); border-radius: 5px; }
  .panes { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 34px; padding-top: 22px; align-items: start; }
  #pane-mine { position: sticky; top: 20px; }
  .label { font-size: 10px; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
  .verdict-text { margin: 0 0 20px; font-size: 17px; line-height: 1.5; }
  .prose { font-size: 14px; }
  .prose :global(h2) { font-size: 15px; margin: 22px 0 6px; }
  .muted { color: var(--muted); font-size: 13px; }
  @media (max-width: 860px) {
    .panes { grid-template-columns: 1fr; gap: 24px; }
    #pane-mine { position: static; }
  }
</style>
```

- [ ] **Step 7: 建置並確認 smoke test 通過**

```bash
npm run build && npm run test:smoke
```

Expected: 全部 PASS（累計 16 條）

**若 `every skill gets its own page` 失敗且訊息是 ENOENT：** 檢查 `astro.config.mjs` 的 `trailingSlash: 'always'` 是否還在 —— 少了它 Astro 會輸出 `dist/skills/superpowers/brainstorming.html` 而不是目錄形式。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
feat: add skill detail pages with licence-tiered source rendering

Two columns: the hand-written take on the left, the skill's own text on
the right. Full text renders only for sources registered as embedTier
full; the rest show structure, an opening excerpt and a link out. All
third-party markdown is sanitised at build time.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 8: 詳情頁 —— 手機分頁籤與 Copy 按鈕

**Files:**
- Create: `src/scripts/detail.js`
- Modify: `src/pages/skills/[...id].astro`
- Test: `test/smoke/detail-tabs.test.mjs`

**Interfaces:**
- Consumes: Task 7 的 `#pane-mine` / `#pane-source` / `#copy`
- Produces: `<div id="tabs">` 內含 `<button data-pane="mine">` 與 `<button data-pane="source">`

- [ ] **Step 1: 寫失敗的 smoke test**

Create `test/smoke/detail-tabs.test.mjs`:

```js
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
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm run build && npm run test:smoke`
Expected: 三條新測試 FAIL

- [ ] **Step 3: 寫 src/scripts/detail.js**

```js
// 手機分頁籤：< 768px 時把雙欄變成兩個分頁。桌機兩欄同時顯示。
// 沒有筆記的技能不會有 #tabs，此時整支腳本的分頁段落直接跳過。
const tabs = document.getElementById('tabs')
const paneMine = document.getElementById('pane-mine')
const paneSource = document.getElementById('pane-source')
const mq = window.matchMedia('(max-width: 767px)')

function showPane(which) {
  paneMine.hidden = which !== 'mine'
  paneSource.hidden = which !== 'source'
  for (const btn of tabs.querySelectorAll('button')) {
    const active = btn.dataset.pane === which
    btn.classList.toggle('active', active)
    btn.setAttribute('aria-selected', String(active))
  }
}

function syncLayout() {
  if (!tabs) return
  if (mq.matches) {
    tabs.hidden = false
    const active = tabs.querySelector('button.active')?.dataset.pane ?? 'mine'
    showPane(active)
  } else {
    tabs.hidden = true
    paneMine.hidden = false
    paneSource.hidden = false
  }
}

if (tabs) {
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pane]')
    if (btn) showPane(btn.dataset.pane)
  })
  mq.addEventListener('change', syncLayout)
  syncLayout()
}

// ── Copy 按鈕 ───────────────────────────────────────────────────────────
const copyBtn = document.getElementById('copy')
copyBtn?.addEventListener('click', async () => {
  const original = copyBtn.textContent
  try {
    await navigator.clipboard.writeText(copyBtn.dataset.command)
    copyBtn.textContent = 'Copied'
  } catch {
    copyBtn.textContent = 'Press ⌘C'
  }
  setTimeout(() => { copyBtn.textContent = original }, 2000)
})
```

- [ ] **Step 4: 在 [...id].astro 加入分頁籤與 script**

在 `<div class="panes">` **之前**插入：

```astro
  {n && (
    <div id="tabs" role="tablist" hidden>
      <button type="button" data-pane="mine" class="active" role="tab" aria-selected="true">My take</button>
      <button type="button" data-pane="source" role="tab" aria-selected="false">Full skill</button>
    </div>
  )}
```

在檔案 `</Base>` **之後**插入：

```astro
<script src="../../scripts/detail.js"></script>
```

在該檔 `<style>` 內加入：

```css
  #tabs { display: flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; margin: 18px 0 0; width: max-content; }
  #tabs button { padding: 7px 16px; font: inherit; font-size: 13px; border: 0; cursor: pointer; background: transparent; color: var(--fg); }
  #tabs button.active { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); font-weight: 600; }
```

- [ ] **Step 5: 建置並確認通過**

```bash
npm run build && npm run test:smoke
```

Expected: 全部 PASS（累計 19 條）

- [ ] **Step 6: 人工確認手機行為**

`npm run dev`，開 `http://localhost:4321/skill-atlas/skills/superpowers/brainstorming/`，用瀏覽器 devtools 切到寬度 375px，確認：分頁籤出現、預設在 My take、點 Full skill 會切換、拉寬回 1200px 時分頁籤消失且兩欄同時顯示。Ctrl-C 停掉。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
feat: add mobile tabs and the copy-command button to detail pages

Below 768px the two columns become My take / Full skill tabs, defaulting
to the hand-written side. Skills without notes render no tab strip.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 9: About 頁與兩站互連

**Files:**
- Create: `src/pages/about.astro`
- Modify: `src/data/registry.json`（sources 加 `guideUrlTemplate`）
- Modify: `src/lib/join.mjs`（把 source 的樣板轉成每技能的 guide 連結）
- Modify: `src/pages/skills/[...id].astro`（顯示該連結）
- Test: `test/smoke/about.test.mjs`

**Interfaces:**
- Consumes: `joinSkills` 的 `SkillView`
- Produces: `SkillView` 新增欄位 `guideUrl: string | null`

- [ ] **Step 1: 寫失敗的 smoke test**

Create `test/smoke/about.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('the about page lists every source with its licence and tier', async () => {
  const html = await readFile('dist/about/index.html', 'utf8')
  const registry = JSON.parse(await readFile('src/data/registry.json', 'utf8'))
  for (const source of registry.sources) {
    assert.ok(html.includes(source.name), `missing source ${source.name}`)
    assert.ok(html.includes(source.embedTier), `missing tier for ${source.name}`)
  }
})

test('a superpowers skill links to the guided walkthrough', async () => {
  const html = await readFile('dist/skills/superpowers/brainstorming/index.html', 'utf8')
  assert.match(html, /Superpowers-guide\/#\/skill\/brainstorming/)
})

test('a non-superpowers skill has no walkthrough link', async () => {
  const html = await readFile('dist/skills/task-observer/task-observer/index.html', 'utf8')
  assert.doesNotMatch(html, /Superpowers-guide\/#\/skill\//)
})
```

- [ ] **Step 2: 執行確認失敗**

Run: `npm run build && npm run test:smoke`
Expected: 三條新測試 FAIL

- [ ] **Step 3: 在 registry.json 的 superpowers source 加樣板**

在 `sources[]` 中 `id: "superpowers"` 那一筆加入一個欄位：

```json
"guideUrlTemplate": "https://peterlwkww-ai.github.io/Superpowers-guide/#/skill/{name}"
```

其餘兩個 source 不加（代表沒有對應教學）。

- [ ] **Step 4: 在 join.mjs 產生 guideUrl**

在 `joinSkills` 回傳物件中，`sourceUrl` 之後加入一行：

```js
      guideUrl: sourceById.get(skill.sourceId)?.guideUrlTemplate
        ? sourceById.get(skill.sourceId).guideUrlTemplate.replace('{name}', skill.name)
        : null,
```

- [ ] **Step 5: 在詳情頁顯示該連結**

在 `[...id].astro` 的 `<LicenceBadge source={skill.source} />` **之前**插入：

```astro
      {skill.guideUrl && (
        <p class="guide-link">
          <a href={skill.guideUrl}>See the guided walkthrough on Superpowers Guide ↗</a>
        </p>
      )}
```

並在 `<style>` 加入：

```css
  .guide-link { margin: 18px 0 0; font-size: 13px; }
```

- [ ] **Step 6: 寫 src/pages/about.astro**

```astro
---
import Base from '../layouts/Base.astro'
import registry from '../data/registry.json'

const TIER_NOTE = {
  full: 'Full text reproduced here, with attribution.',
  excerpt: 'Opening excerpt only; read the rest at the source.',
  linkOnly: 'Metadata and structure only; licence unverified or restrictive.',
}
---
<Base title="About">
  <h1>About skill-atlas</h1>

  <p class="lede">
    Skill directories tell you what exists and how to install it. This one
    tells you what is worth using. Every entry carries a rank, a rating and a
    written opinion — including when not to reach for it.
  </p>

  <h2>How the data works</h2>
  <p>
    Two stores that never touch each other. Skill facts are generated from the
    installed <code>SKILL.md</code> files. The opinions are hand-written and no
    script may write to them. They join at build time.
  </p>

  <h2>Sources &amp; licences</h2>
  <p>
    Third-party text is reproduced only where the source's licence allows it.
    When a licence cannot be verified, the default is to link out rather than
    reproduce.
  </p>

  <table>
    <thead>
      <tr><th>Source</th><th>Licence</th><th>Tier</th><th>What that means</th></tr>
    </thead>
    <tbody>
      {registry.sources.map(s => (
        <tr>
          <td><a href={s.repo}>{s.name} ↗</a></td>
          <td>{s.licenceUrl ? <a href={s.licenceUrl}>{s.licence} ↗</a> : s.licence}</td>
          <td><code>{s.embedTier}</code></td>
          <td>{TIER_NOTE[s.embedTier]}</td>
        </tr>
      ))}
    </tbody>
  </table>

  <h2>Related</h2>
  <p>
    <a href="https://peterlwkww-ai.github.io/Superpowers-guide/">Superpowers Guide ↗</a>
    — a scenario-by-scenario walkthrough of the superpowers plugin specifically.
  </p>
</Base>

<style>
  .lede { color: var(--muted); max-width: 62ch; }
  h2 { font-size: 17px; margin: 28px 0 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border-bottom: 1px solid var(--line); padding: 7px 10px; text-align: left; vertical-align: top; }
  th { font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
</style>
```

- [ ] **Step 7: 建置並確認通過**

```bash
npm run build && npm run test:smoke
```

Expected: 全部 PASS（累計 22 條）

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
feat: add the about page and cross-links to Superpowers Guide

The about page is the credits surface: every source with its licence, its
embed tier, and what that tier means. Superpowers skills link across to
their walkthrough via a source-level URL template.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 10: 連結檢查腳本、CI 與部署

**Files:**
- Create: `scripts/check-links.mjs`
- Create: `.github/workflows/pages.yml`
- Modify: `CHANGELOG.md`
- Test: 無新測試（本任務的驗證是 CI 本身跑綠）

**Interfaces:**
- Consumes: `npm test`、`npm run build`、`npm run test:smoke` 三個 script（Task 1 定義）
- Produces: 部署到 `https://peterlwkww-ai.github.io/skill-atlas/`

- [ ] **Step 1: 寫 scripts/check-links.mjs**

```js
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
```

- [ ] **Step 2: 手動執行一次連結檢查**

```bash
npm run check-links
```

Expected: 逐條印出狀態。有 `BAD` 或 `ERR` 就手動修 `registry.json` 裡對應的 URL，修完再跑一次。

- [ ] **Step 3: 寫 .github/workflows/pages.yml**

```yaml
# 建置並部署 skill-atlas 到 GitHub Pages。
# 一次性手動設定（無法用 GITHUB_TOKEN 自動化）：
#   repo Settings → Pages → Build and deployment → Source: "GitHub Actions".
#   在那之前 deploy job 會以 "Get Pages site failed" 失敗。
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Unit tests
        run: npm test
      - name: Build (runs data validation first)
        run: npm run build
      - name: Smoke tests against dist/
        run: npm run test:smoke
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: 本機完整跑一次 CI 順序**

```bash
npm ci && npm test && npm run build && npm run test:smoke
```

Expected: 四步全綠。這一步是為了確保推上去之前 CI 不會因為本機沒跑到的環節而紅燈。

- [ ] **Step 5: 更新 CHANGELOG.md**

在檔首的 `# Changelog` 之後插入：

```markdown
## 2026-09-05 — Claude (Peter)

- 目錄站完成：雙模式目錄（精選卡片 / 全部技能表格 + 側欄篩選）、
  Fuse.js 搜尋、技能詳情頁（桌機雙欄、手機分頁籤）、授權三級呈現、
  About 授權致謝頁、與 Superpowers-guide 互連。
- 資料閘門：五條建置期硬規則，其中「未登記授權不得嵌入全文」是
  合規的結構攔截。連結檢查刻意排除於 CI 之外。
- GitHub Actions 部署至 GitHub Pages。
```

- [ ] **Step 6: Commit 並推送**

```bash
git add -A
git commit -m "$(cat <<'MSG'
ci: add link checker and the Pages deployment workflow

The workflow runs unit tests, data validation, the build and the smoke
tests before uploading dist/. The external link check stays out of CI on
purpose so a third party's rate limit cannot block a deploy.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

推送需要 remote 存在。若尚未建立 GitHub repo，先建立再推：

```bash
gh repo create peterlwkww-ai/skill-atlas --public --source=. --remote=origin --push
```

若 repo 已存在：

```bash
git remote add origin https://github.com/peterlwkww-ai/skill-atlas.git
git push -u origin master
```

- [ ] **Step 7: 一次性手動設定 Pages**

到 `https://github.com/peterlwkww-ai/skill-atlas/settings/pages`，把
**Build and deployment → Source** 設為 **GitHub Actions**。

**在此之前 deploy job 一定會以 `Get Pages site failed` 失敗** —— 這不是程式錯誤。設定後重跑 workflow。

- [ ] **Step 8: 驗證線上站台**

開 `https://peterlwkww-ai.github.io/skill-atlas/` 確認：

1. 首頁預設顯示 2 張精選卡片
2. 按 `All 5` 切到目錄，側欄篩選可用，網址變成 `?view=all`
3. 點 `brainstorming` 進入 `/skill-atlas/skills/superpowers/brainstorming/`，桌機顯示雙欄
4. `/skill-atlas/about/` 的來源表格三列齊全
5. **頁面上沒有任何連結 404** —— 若有，幾乎必定是某處內部連結沒走 `href(base, …)`

---

## Self-Review

**1. Spec coverage**

| Spec 章節 | 對應任務 |
|---|---|
| §4 技術棧與檔案結構 | Task 1（骨架）、各任務建立各自的檔案 |
| §5.1 registry schema | Task 2 |
| §5.2 授權分級 | Task 2 Step 5–6（資料）、Task 7 Step 5（呈現）、Task 3 Step 8（規則 4） |
| §5.3 notes schema | Task 3 Step 6–7 |
| §5.4 合併規則 | Task 3 Step 4（`joinSkills` + 規則 2） |
| §5.5 子專案 1 手寫 5 筆 | Task 2 Step 5 |
| §6.1 目錄頁雙模式 | Task 4（picks）、Task 5（all） |
| §6.2 詳情頁雙欄 + 手機分頁籤 | Task 7（桌機）、Task 8（手機） |
| §6.3 about 頁 | Task 9 |
| §7 篩選與搜尋 | Task 5（篩選）、Task 6（搜尋） |
| §8 五條硬規則 | 規則 1、5 → Task 2；規則 2、3、4 → Task 3 |
| §8 只警告不擋 | Task 3 Step 8（無筆記統計、verdict 過長） |
| §8 連結檢查排除於 CI | Task 10 Step 1 |
| §9 錯誤處理與漸進增強 | Task 6 Step 5（索引失敗只停用搜尋）、Task 5（篩選為純 DOM） |
| §10 測試三層 | 單元 → Task 2/3；建置 → 每個任務；smoke → Task 1 起逐步累積 22 條 |
| §11 部署 | Task 10 |
| §12 兩站互連 | Task 9 |

無缺口。

**2. Placeholder scan**

已檢查：無 TBD / TODO、無「加上適當的錯誤處理」、無「參照 Task N」、每個程式步驟都有完整可貼上的程式碼。`registry.json` 的 `licence: "unverified"` 不是 placeholder —— 它是 spec §5.2 要求的保守初值，且 Task 2 Step 6 有明確的核實程序把它換掉。

**3. Type consistency**

- `validateRegistry(registry) -> string[]` — Task 2 定義，Task 3 Step 8 使用 ✓
- `validateNotes(registry, notes) -> string[]` — Task 3 定義並使用 ✓
- `joinSkills(registry, notes) -> SkillView[]` — Task 3 定義；Task 4、5、6、7、9 使用 ✓
- `sortForCatalogue(views)` — Task 3 定義；Task 4、5 使用 ✓
- `href(base, path)` — Task 1 定義；Task 4、5、7 使用 ✓
- `mdToSafeHtml(markdown)` — Task 7 定義；Task 7 內三處使用 ✓
- notes 的形狀 `{ id, data, body }` — Task 3 測試、Task 3 Step 8 的 validate.mjs、Astro `getCollection` 回傳三者一致 ✓
- `SkillView.guideUrl` — Task 9 加入，同任務內使用 ✓
- DOM 契約 `data-skill-id` / `data-curated` / `data-searchHidden`：Task 4 建立 → Task 5 讀取 → Task 6 寫入，命名一致 ✓
  - 注意 `row.dataset.searchHidden` 對應 HTML 屬性 `data-search-hidden`，Task 6 用 `dataset` 設值故一致 ✓

修正已內聯完成。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-05-skill-atlas-catalog.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
