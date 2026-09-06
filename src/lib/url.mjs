// Pages project site 的 base 是 /skill-atlas。所有內部連結都要經過這裡，
// 不要在 template 裡自己拼 '/'，那在 Pages 上會 404。
export function href(base, path) {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : `/${path}`
  const joined = `${b}${p}`
  return joined.endsWith('/') ? joined : `${joined}/`
}
