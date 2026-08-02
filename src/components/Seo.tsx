import { useEffect } from 'react';

const SITE = 'https://armandamirchilou.github.io';

function setMeta(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/**
 * Keeps the document title, description and canonical URL in step with the
 * active route. The build pre-renders a real HTML file per route for crawlers
 * that don't run JS; this handles client-side navigation for the ones that do.
 */
export function Seo({ title, description, path }: { title: string; description: string; path: string }) {
  useEffect(() => {
    // Pages serves sub-routes as directory indexes; canonical must match the
    // trailing-slash URL that actually returns 200, not the client-side form.
    const url = path === '/' ? `${SITE}/` : `${SITE}${path}/`;
    document.title = title;

    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', url);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }, [title, description, path]);

  return null;
}
