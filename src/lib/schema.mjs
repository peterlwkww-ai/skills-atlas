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
