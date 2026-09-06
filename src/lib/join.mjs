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

  // 規則 3：rank 唯一。型別先驗 —— notes 由人手寫，YAML 裡的 `rank: "1"`
  // 和 `rank: 1` 是同一個名次，但 Map 鍵不會自動轉型，會讓重複悄悄溜過。
  const seenRank = new Map()
  for (const note of notes) {
    const rank = note.data?.rank
    if (rank === undefined) {
      errors.push(`note "${note.id}": missing required frontmatter field "rank"`)
      continue
    }
    if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 1) {
      errors.push(
        `note "${note.id}": rank must be an integer >= 1, got ${JSON.stringify(rank)} ` +
        `(${typeof rank}) — quote-free numbers only in frontmatter`)
      continue
    }
    if (seenRank.has(rank)) {
      errors.push(`duplicate rank ${rank}: "${seenRank.get(rank)}" and "${note.id}"`)
      continue
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
    const source = sourceById.get(skill.sourceId) ?? null
    return {
      id: skill.id,
      name: skill.name,
      command: skill.command,
      source,
      version: skill.version,
      category: skill.category,
      description: skill.description,
      headings: skill.headings ?? [],
      bodyExcerpt: skill.bodyExcerpt,
      bodyMarkdown: skill.bodyMarkdown ?? null,
      sourceUrl: skill.sourceUrl,
      guideUrl: source?.guideUrlTemplate
        ? source.guideUrlTemplate.replace('{name}', skill.name)
        : null,
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
