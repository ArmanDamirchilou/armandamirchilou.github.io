/**
 * GitHub Pages has no SPA rewrite: only paths that exist as files return 200.
 * Without this, /twin and /contact fall through to 404.html — the app still
 * renders for humans, but crawlers see HTTP 404 and drop the page.
 *
 * Writing dist/<route>/index.html gives each route a real 200 response with
 * its own title, description and canonical, so it can actually be indexed.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const SITE = 'https://armandamirchilou.github.io';

const ROUTES = [
  {
    path: 'twin',
    title: 'AI Twin — talk to a digital Arman Damirchilou',
    description:
      'A real-time 3D avatar of Arman Damirchilou that answers in his cloned voice: local voice model, LLM reasoning and live facial animation.',
    body: '<h1>Talk to the AI twin of Arman Damirchilou</h1><p>Arman Damirchilou built this interactive 3D avatar to answer questions about his AI projects, experience and plans. The twin combines a conversational model, voice and facial animation.</p><p><a href="/">About Arman Damirchilou</a></p>',
  },
  {
    path: 'contact',
    title: 'Contact Arman Damirchilou — AI Software Engineer',
    description:
      'Get in touch with Arman Damirchilou for AI, machine learning and full-stack engineering work. Based in Tehran, Iran, working with teams worldwide.',
    body: '<h1>Contact Arman Damirchilou</h1><p>For AI projects, research or collaborations, email <a href="mailto:armandamirchilou@gmail.com">armandamirchilou@gmail.com</a>.</p><p><a href="/">About Arman Damirchilou</a></p>',
  },
];

const shell = readFileSync(join(DIST, 'index.html'), 'utf8');

// Escape a string for safe use inside a double-quoted HTML attribute.
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

for (const route of ROUTES) {
  // Pages serves these as directory indexes, so the URL that actually returns
  // 200 has a trailing slash. Canonical must name that exact form.
  const url = `${SITE}/${route.path}/`;
  const title = attr(route.title);
  const desc = attr(route.description);

  const html = shell
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${route.title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[\s\S]*?(")/, `$1${desc}$2`)
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[\s\S]*?(")/, `$1${title}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[\s\S]*?(")/, `$1${desc}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[\s\S]*?(")/, `$1${title}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[\s\S]*?(")/, `$1${desc}$2`);

  // Each route needs its own crawlable body. The React app replaces this
  // fallback when JavaScript loads, while text-only crawlers can still read it.
  const page = html
    .replace(/\s*<link rel="alternate" hreflang="[^"]+" href="[^"]+" \/>/g, '')
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')
    .replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root"><main class="search-fallback">${route.body}</main></div>`);

  const dir = join(DIST, route.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page);
  console.log(`prerendered /${route.path}/`);
}

// Unknown paths still need the app shell so React Router can show a real page.
copyFileSync(join(DIST, 'index.html'), join(DIST, '404.html'));
console.log('wrote 404.html fallback');
