/**
 * Points the live site at a backend URL by rewriting public/backend.json.
 *
 * A dev tunnel hands out a new hostname every restart, so this exists to make
 * re-pointing a one-liner instead of a rebuild.
 *
 *   npm run twin:url -- https://abc-def.loca.lt
 *   npm run twin:url -- --clear            # back to the offline notice
 *   npm run twin:url -- <url> --push       # commit and deploy too
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const FILE = 'public/backend.json';
const args = process.argv.slice(2);
const push = args.includes('--push');
const clear = args.includes('--clear');
const url = args.find((a) => !a.startsWith('--'));

if (!clear && !url) {
  console.error('usage: npm run twin:url -- <url|--clear> [--push]');
  process.exit(1);
}

if (url && !/^https:\/\/[^\s/]+$/i.test(url.replace(/\/+$/, ''))) {
  console.error(`refusing to set a malformed backend URL: ${url}`);
  console.error('expected something like https://abc-def.loca.lt');
  process.exit(1);
}

const next = clear ? null : url.replace(/\/+$/, '');
const current = JSON.parse(readFileSync(FILE, 'utf8'));

if (current.url === next) {
  console.log(`backend.json already set to ${next ?? 'null'} — nothing to do`);
  process.exit(0);
}

writeFileSync(FILE, `${JSON.stringify({ ...current, url: next }, null, 2)}\n`);
console.log(`backend.json -> ${next ?? 'null (offline)'}`);

if (push) {
  execSync(`git add ${FILE}`, { stdio: 'inherit' });
  execSync(`git commit -m "Point twin at ${next ?? 'no backend'}"`, { stdio: 'inherit' });
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('pushed — Pages will redeploy in about a minute');
}
