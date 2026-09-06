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
