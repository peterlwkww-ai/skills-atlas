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

// ── 搜尋 ────────────────────────────────────────────────────────────────
// 索引載入失敗時只停用搜尋框，篩選器仍然可用（spec §9）。
import Fuse from 'fuse.js'

const searchInput = document.getElementById('search')
const cards = [...document.querySelectorAll('#picks .card')]
let fuse = null

function clearSearch() {
  for (const el of [...rows, ...cards]) delete el.dataset.searchHidden
  // 卡片的可見性是這支腳本直接設的，applyFilters() 只管 rows，
  // 所以清空搜尋時必須自己把卡片放回來，否則它們會永遠留在隱藏狀態。
  for (const card of cards) card.hidden = false
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
