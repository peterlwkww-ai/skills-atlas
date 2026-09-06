# skill-atlas 設計文件

- **日期：** 2026-09-05
- **狀態：** 待審
- **範圍：** 子專案 1（呈現層 + 內容模型）。子專案 2/3/4 另立 spec。

---

## 1. 這是什麼

一個公開的 **Agent Skills 策展站**。核心主張：市面上的技能目錄（`find-skills`、`SearchSkills`、各家 marketplace）都是**安裝導向的登錄簿** — 告訴你有什麼、怎麼裝。skill-atlas 是**策展導向的評論站** — 告訴你哪些值得用、為什麼、什麼時候別用。

差異點只有一個，而且是唯一不能從別處取得的東西：**作者手寫的使用心得與排名**。所有設計決定都服從這一點。

### 目標

1. 呈現作者的 Top 10 技能，每個都有排名、評分、使用頻率與三段手寫心得。
2. 同時容納一份可查詢的完整技能目錄（現況作者本機有 139 個，未來會更多）。
3. 每個技能有可分享的獨立 URL。
4. 公開發布時，第三方技能的轉載符合各自授權。

### 非目標（明確排除）

- **不做安裝功能。** 安裝交給既有工具，本站只提供指令字串供複製。
- **不做使用者帳號、留言、投票。**
- **不做 i18n。** 英文單語。（`zh-TW` 之後若要加，資料模型不需改，只需增加翻譯層。）
- **不做情境導覽（scenario walkthrough）。** 那是 Superpowers-guide 的角色，兩站互連即可。
- **不做真實對話 transcript 展示。** 每個技能手工整理 transcript 成本過高，已在設計討論中排除。
- **不做技能關係圖（前置／後續／可替代）。** 已在設計討論中排除。

---

## 2. 專案分解

本需求包含四個獨立子系統。**本 spec 只涵蓋子專案 1。**

| # | 子專案 | 內容 | 依賴外部 |
|---|---|---|---|
| 1 | **呈現層 + 內容模型** | Astro 站台、目錄頁、詳情頁、篩選搜尋、資料 schema、授權分級、部署 | 否 |
| 2 | **本機技能匯入** | 掃描 `~/.claude/skills` 與 plugin cache 的 `SKILL.md`，產生 `registry.json` | 否 |
| 3 | **市場自動更新** | 定期抓外部來源，偵測新技能與版本變化，產出待審清單 | 是 |
| 4 | **策展與個人化擴充** | 學習路徑、進階排序、更多手寫內容型別 | 否 |

建議順序 1 → 2 → 4 → 3。子專案 3 最後做：它是唯一需要外部網路與排程的，風險最高（見觀察 #2：未認證輪詢會耗盡額度，並讓失敗看起來像「還沒好」）。

---

## 3. 已確認的決策

| 決策 | 選擇 | 理由 |
|---|---|---|
| 專案落點 | **新 repo `skill-atlas`，與 Superpowers-guide 並存** | 兩站定位不同；舊站專講 superpowers 插件，不受影響 |
| 技術棧 | **Astro 靜態輸出** | 讀者是社群，可分享的單一技能 URL 從加分項變成必要條件；hash router 做不到 |
| 導覽模型 | **單一目錄 + 強篩選**，預設套用「我的精選」 | 一套資料結構撐 10 到 500 筆 |
| 目錄頁版面 | **雙模式**：精選用大卡片，全部用密集表格 + 側欄 | 手寫心得值得專屬版面；查詢用清單該是密集表格 |
| 詳情頁版面 | **雙欄**：左心得、右原文對照 | 心得與原文可對照閱讀 |
| 手機版 | **分頁籤**（My take / Full skill），不塌成長單欄 | 避免決定塌陷順序，且兩塊內容量差距大 |
| 語言 | 英文單語 | 讀者是社群 |
| 深度內容 | **手寫心得 + 原始 SKILL.md 全文** | 已排除 transcript 與關係圖 |
| 資料存放 | **機器產出與手寫內容分兩處** | 匯入腳本會反覆重跑，不能有覆蓋手寫內容的可能 |

---

## 4. 架構

### 技術棧

- **Astro**（`output: 'static'`）— 建置期渲染 Markdown，每技能輸出獨立 HTML
- **Fuse.js** — 前端模糊搜尋，索引在建置期產生
- **無前端框架** — 篩選與搜尋用原生 DOM 操作，複雜度不需要 React/Vue
- **GitHub Pages** — 經 GitHub Actions 部署

### 檔案結構

```
skill-atlas/
├─ src/
│  ├─ data/
│  │  └─ registry.json            # 機器產出的事實。永不手改。
│  ├─ content/
│  │  ├─ config.ts                # Astro content collection + Zod schema
│  │  └─ notes/
│  │     └─ <source>--<name>.md   # 手寫心得。機器永不觸碰。
│  ├─ components/
│  │  ├─ SkillCard.astro          # 精選模式的大卡片
│  │  ├─ SkillRow.astro           # 目錄模式的密集列
│  │  ├─ FilterPanel.astro        # 側欄篩選器
│  │  ├─ LicenceBadge.astro       # 出處與授權標示
│  │  └─ SourceBody.astro         # 原始 SKILL.md 區塊（含三種授權狀態）
│  ├─ layouts/
│  │  └─ Base.astro
│  ├─ lib/
│  │  ├─ join.ts                  # registry × notes 的合併邏輯
│  │  └─ licence.ts               # 授權分級判斷
│  └─ pages/
│     ├─ index.astro              # 目錄頁（雙模式）
│     ├─ skills/[...id].astro     # 詳情頁
│     └─ about.astro              # 站台說明 + 完整出處與授權致謝
├─ scripts/
│  ├─ validate.mjs                # 建置前資料驗證
│  └─ check-links.mjs             # 手動執行，不進 CI
├─ test/
│  ├─ validate.test.mjs
│  └─ fixtures/                   # 刻意壞掉的資料，驗證每條規則真的會擋
├─ .github/workflows/pages.yml
├─ CHANGELOG.md
└─ README.md
```

**檔名注意：** notes 檔名用 `<source>--<name>.md`（雙連字號），不用 `/`，因為 Astro content collection 的 slug 不適合承載來源分隔語意。檔名不是對接鍵；frontmatter 的 `skill:` 才是。

---

## 5. 資料模型

### 5.1 `src/data/registry.json`

```json
{
  "generatedAt": "2026-09-05",
  "sources": [
    {
      "id": "superpowers",
      "name": "Superpowers",
      "repo": "https://github.com/obra/superpowers",
      "licence": "MIT",
      "licenceUrl": "https://github.com/obra/superpowers/blob/main/LICENSE",
      "embedTier": "full"
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
      "description": "You MUST use this before any creative work…",
      "headings": ["Three Paths", "Anti-Pattern", "Red Flags", "Checklist"],
      "bodyExcerpt": "# Brainstorming Ideas Into Designs\n\nHelp turn ideas into…",
      "bodyMarkdown": "# Brainstorming Ideas Into Designs\n\n…（完整內文）",
      "sizeBytes": 15456,
      "sourceUrl": "https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md"
    }
  ]
}
```

**欄位規則**

| 欄位 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | `<sourceId>/<name>`。來源前綴避免不同來源的同名技能撞號。 |
| `name` / `command` | 是 | `command` 是使用者要複製的字串 |
| `sourceId` | 是 | 必須存在於 `sources[]` |
| `version` | 是 | 同一技能存在多版本時取最新（作者本機同時有 superpowers 6.2.0 與 6.3.0） |
| `description` | 是 | SKILL.md frontmatter 的 `description` |
| `headings` | 是 | 從內文抽出的 `##` 標題。**不能轉載全文時，這是讀者判斷技能份量的唯一依據。** |
| `bodyExcerpt` | 是 | **前 40 行或前 2000 字元，取先到者**，並在最後一個完整段落邊界截斷。任何授權等級都顯示（合理引用範圍）。 |
| `bodyMarkdown` | 是（可為 `null`） | 欄位必須存在。僅 `embedTier: "full"` 時填內容，其餘必須是 `null`。 |
| `sourceUrl` | 是 | 指回原始 SKILL.md |

### 5.2 授權分級

`sources[].embedTier` 三個值，由匯入腳本讀該來源根目錄的 `LICENSE` 決定：

| tier | 條件 | 頁面呈現 |
|---|---|---|
| `full` | 明確的開放授權（MIT / Apache-2.0 / CC BY 等） | 顯示 `bodyMarkdown` 全文，頁尾自動附署名與授權 |
| `excerpt` | 授權允許節錄但不允許完整轉載 | 顯示 `description` + `headings` + `bodyExcerpt` + 原文連結 |
| `linkOnly` | **查不到授權，或授權禁止轉載** | 顯示 `description` + `headings` + 原文連結 |

**預設值是 `linkOnly`。** 匯入腳本在無法判定授權時不得猜測。

署名格式（`full` 與 `excerpt` 共用，由 `LicenceBadge.astro` 產生）：

> *task-observer by Eoghan Henn — CC BY 4.0 · [source ↗](…)*

### 5.3 `src/content/notes/<source>--<name>.md`

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

The classification step is the whole value…

## When NOT to use it

When you already know the exact line to change…

## Gotchas I hit

Thought "bounded" meant I could skip the approval gate. It does not.
```

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `skill` | string | 是 | **對接鍵。** 必須解析到 registry 中的技能。 |
| `rank` | int ≥ 1 | 是 | 精選排名。跨所有 notes 唯一。 |
| `rating` | int 1–5 | 是 | |
| `frequency` | enum | 是 | `daily` / `weekly` / `monthly` / `rare` |
| `tags` | string[] | 否（預設 `[]`） | 自由標籤，用於篩選 |
| `verdict` | string | 是 | 一句話結論。顯示在目錄卡片與詳情頁最上方。 |

**「有筆記」的定義：** notes 目錄下存在一個 `skill:` 指向該技能的檔案。因為 `rank` 必填，**每個有筆記的技能都是精選技能** — 沒有「有心得但不進排名」的中間狀態。若日後需要，那是子專案 4 的事。

內文固定三個 `##` 小節（`Why it's in my top 10` / `When NOT to use it` / `Gotchas I hit`）。schema 不強制小節存在 — 允許只寫其中一兩節。

### 5.4 合併規則（`src/lib/join.ts`）

- **有技能、無筆記** → 渲染為參考卡（無心得區塊、無排名徽章）。**正常狀況**，139 個技能大多如此。
- **有筆記、技能不存在** → **建置失敗**。這是真的錯誤。

### 5.5 子專案 1 的資料範圍

`registry.json` 在子專案 1 **手寫**，只包含 10 個精選技能與其來源。schema 完全定死。

理由：作者現在要的成品就是「10 個技能的深度介紹站」，手寫 10 筆是最短路徑；這份手寫資料之後直接成為子專案 2 匯入腳本的測試 fixture，不是重工。

---

## 6. 頁面

### 6.1 目錄頁 `/`

**雙模式，用頂部切換器切換。**

**模式 A — My picks（預設）**

- 兩欄大卡片網格
- 每張卡：排名徽章、技能名、評分、`verdict` 全文、`來源 v版本 · 頻率 · 標籤`
- 無篩選側欄（10 筆不需要）
- 有搜尋框

**模式 B — All skills**

- 左側篩選欄（sticky）+ 右側密集表格
- 篩選維度：`source`（多選）、`rating`（≥ N）、`frequency`（多選）、`tags`（多選）、`has notes`（開關）
- 每列：技能名、來源、評分、`verdict` 或截斷的 `description`
- 精選技能在此模式**不顯示排名徽章**（避免與排序衝突）

模式狀態寫入 URL query（`/?view=all`），可分享、可加書籤。

### 6.2 詳情頁 `/skills/<source>/<name>/`

**桌機：雙欄**

| 左欄（sticky） | 右欄 |
|---|---|
| 標題、來源、版本、評分、排名徽章 | **Full SKILL.md**（依授權等級呈現三種狀態之一） |
| 指令 + Copy 按鈕 | |
| **The verdict** | |
| **Why it's in my top 10** | |
| **When NOT to use it** | |
| **Gotchas I hit** | |
| Quick facts（分類、標籤、頻率） | |
| 出處與授權標示 | |

**手機（< 768px）：分頁籤**

- 兩個分頁：`My take` / `Full skill`
- 預設開在 `My take`
- 標題區（名稱、指令 + Copy、評分、排名）在分頁籤上方，兩個分頁共用

**無筆記的技能**：左欄只有標題區、Quick facts 與授權標示，心得四塊不渲染；手機不顯示分頁籤，改為單欄依序呈現標題區 → Quick facts → 技能內容區塊（該區塊依授權等級可能是全文、節錄或僅章節目錄，見 §5.2）。

### 6.3 `/about`

站台目的說明、資料來源與更新方式、**完整的來源與授權致謝表**（每個 source 一列：名稱、repo 連結、授權、embedTier）。

---

## 7. 篩選與搜尋

- **搜尋**：Fuse.js，索引在建置期產生為 `/search-index.json`，欄位為 `name`、`description`、`verdict`、`tags`，`threshold: 0.3`
- **篩選**：純 DOM 操作，對已渲染的元素加 `hidden` 屬性。不重新請求資料。
- 篩選與搜尋可疊加；搜尋結果仍受篩選條件限制。

---

## 8. 驗證（`scripts/validate.mjs`，於 `astro build` 前執行）

### 會擋下建置的五條硬規則

1. `registry.json` 每筆技能符合 schema；`id` 必須是 `<sourceId>/<name>` 格式且全域唯一。
2. 每個 note 的 `skill:` 必須解析到 registry 中的技能。
3. `rank` 在所有 notes 中唯一。
4. **`bodyMarkdown` 非 `null` 時，該技能所屬 source 的 `embedTier` 必須為 `"full"`。**
5. 每個 source 必須有 `repo`、`licence`、`embedTier` 三個欄位，且 `embedTier` 為三個列舉值之一。`licenceUrl` 在 `embedTier` 為 `full` 或 `excerpt` 時必填（署名需要指向授權條文）；`linkOnly` 時可為 `null` — 該等級的成因往往正是查不到授權檔。

規則 4 是本專案的合規核心：**把授權正確性做成建置期的結構攔截，不依賴人記得。** 想放全文卻沒登記授權，CI 直接紅燈。

### 只警告、不擋建置

- 技能無對應筆記（正常狀況，僅統計輸出）
- `verdict` 超過 120 字元（版面會爆，但不是錯誤）

### 刻意排除於建置流程之外

`sourceUrl` 的連結存活檢查放在 `scripts/check-links.mjs`，**手動執行，不進 CI**。

理由（觀察 #2 的教訓）：讓外部 HTTP 請求成為建置的阻塞條件，遲早會因為對方限流或暫時性故障而讓站台無法部署，而且失敗訊息會看起來像資料錯誤而非網路問題。

---

## 9. 錯誤處理與漸進增強

- 站台為靜態輸出，**停用 JS 時目錄頁仍完整可讀**（所有項目在建置期已渲染進 HTML），僅失去篩選與搜尋。
- `search-index.json` 載入失敗時，搜尋框停用並顯示提示，**篩選器仍可用**（純 DOM 操作，不依賴索引）。
- 找不到的技能 URL → Astro 404 頁，附回目錄頁連結。

---

## 10. 測試

| 層級 | 內容 |
|---|---|
| 單元 | `node --test test/validate.test.mjs` — 對 `test/fixtures/` 中**刻意壞掉的資料**逐條驗證五條硬規則真的會擋（不是假設它會擋） |
| 建置 | `astro build` 成功 = 主要關卡 |
| Smoke | build 後檢查 `dist/` 中 registry 的每個技能都有對應 HTML 檔，且精選技能的頁面含其 `verdict` 字串 |

CI 順序：`node --test` → `node scripts/validate.mjs` → `astro build` → smoke → deploy。

---

## 11. 部署

`.github/workflows/pages.yml`，與 Superpowers-guide 同一 pattern：

```
checkout → setup-node → npm ci → node --test → node scripts/validate.mjs
→ astro build → smoke check → upload-pages-artifact → deploy-pages
```

**手動前置步驟（一次性）：** 到 repo Settings → Pages，將 Source 設為 "GitHub Actions"。

---

## 12. 與 Superpowers-guide 的關係

兩站並存，各自獨立部署：

- **Superpowers-guide** — superpowers 插件的情境導覽教學（7 個情境、14 個技能）
- **skill-atlas** — 跨來源的技能策展目錄

互連方式：

- 兩站頁尾互放連結
- skill-atlas 上 `sourceId === "superpowers"` 的技能，若在 Superpowers-guide 有對應頁面，詳情頁加一條「See the guided walkthrough ↗」連結（對應關係用 source 層級的 URL 樣板產生，不需逐技能維護）

---

## 13. 未決的假設（實作時若判斷有誤，回報而非自行改變）

1. **repo 名稱 `skill-atlas`** — 提議值，作者未明確確認。改名只影響 repo 與部署 URL，不影響任何設計。
2. **Top 10 的實際名單與心得內容** — 尚未產出。實作時先用 5 筆佔位資料把版面做出來，內容由作者填寫。
3. **`headings` 只抽 `##` 層級** — 若某些 SKILL.md 的主要結構在 `###`，需在子專案 2 調整抽取深度。
