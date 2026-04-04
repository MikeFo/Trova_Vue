import DOMPurify from 'dompurify';

const HTTP_URL_RE = /(https?:\/\/[^\s<]+)/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(s: string): string {
  return escapeHtml(s);
}

/**
 * Plain text and http(s) URLs → safe HTML for v-html (XSS-resistant).
 */
export function formatChatMessageHtml(text: string): string {
  if (!text) return '';
  let html = '';
  let last = 0;
  const re = new RegExp(HTTP_URL_RE.source, HTTP_URL_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    html += escapeHtml(text.slice(last, m.index)).replace(/\n/g, '<br>');
    const rawUrl = m[1];
    try {
      const u = new URL(rawUrl);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        html += `<a href="${escapeHtmlAttr(u.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(rawUrl)}</a>`;
      } else {
        html += escapeHtml(rawUrl).replace(/\n/g, '<br>');
      }
    } catch {
      html += escapeHtml(rawUrl).replace(/\n/g, '<br>');
    }
    last = m.index + rawUrl.length;
  }
  html += escapeHtml(text.slice(last)).replace(/\n/g, '<br>');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}
