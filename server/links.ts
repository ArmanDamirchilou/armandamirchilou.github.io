/**
 * Links in the twin's replies. A reply is plain text with markdown links in
 * it, "[ArmanDamirchilou](https://github.com/ArmanDamirchilou)": the chat
 * shows the label as a link, and the voice and live captions use the label
 * alone, so the twin says "ArmanDamirchilou", never a URL. Shared by the
 * server and the page, like speech.ts.
 */

const MD_LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const BARE_URL = /\bhttps?:\/\/[^\s<>()[\]]+[^\s<>()[\].,!?;:'"]/g;
const EMAIL = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;

/** Only these may become links: web pages, email, and pages on this site. */
export const isSafeHref = (href: string) => /^(https?:\/\/|mailto:|\/(?!\/))/i.test(href);

/** The short name a URL is shown and spoken as: a handle, or the site. */
export function labelFor(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const parts = u.pathname.split('/').filter(Boolean);
    if (/^(github\.com|x\.com|twitter\.com|t\.me)$/.test(host) && parts[0]) return parts[0];
    if (host === 'linkedin.com' && parts[0] === 'in') return 'Arman Damirchilou';
    return host;
  } catch {
    return url;
  }
}

/**
 * Turns bare URLs and email addresses into markdown links, leaving existing
 * links alone: models don't always follow the format they're asked for.
 */
export function linkify(text: string): string {
  const kept: string[] = [];
  const hold = (s: string) => `\u0000${kept.push(s) - 1}\u0000`;
  let out = text.replace(MD_LINK, (m) => hold(m));
  out = out.replace(BARE_URL, (url) => hold(`[${labelFor(url)}](${url})`));
  out = out.replace(EMAIL, (mail) => hold(`[${mail}](mailto:${mail})`));
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
}

/** The reply as it's heard and captioned: every link reduced to its label. */
export const stripLinks = (text: string) => text.replace(MD_LINK, '$1');

export type Segment = { text: string; href?: string };

/** The reply as it's shown: plain runs and links. Unsafe links stay text. */
export function parseLinks(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(MD_LINK)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push(isSafeHref(m[2]) ? { text: m[1], href: m[2] } : { text: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/**
 * What the voice engine is given for a sentence: addresses said the way a
 * person says them ("armandamirchilou at gmail dot com"), handles without
 * the "@". The caption keeps the written form.
 */
export function voiceText(text: string): string {
  return text
    .replace(EMAIL, (mail) => {
      const [user, domain] = mail.split('@');
      return `${user} at ${domain.split('.').join(' dot ')}`;
    })
    .replace(/(^|\s)@(\w+)/g, '$1$2');
}
