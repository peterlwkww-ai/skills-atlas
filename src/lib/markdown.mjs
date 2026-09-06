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
    // rel 和 target 必須列在這裡：sanitize-html 會把 transformTags 產出的屬性
    // 再過一次 allowedAttributes，沒列到的會被靜默剝掉，下面那條 transform 就形同虛設。
    allowedAttributes: { a: ['href', 'title', 'rel', 'target'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, rel: 'nofollow noopener', target: '_blank' },
      }),
    },
  })
}
