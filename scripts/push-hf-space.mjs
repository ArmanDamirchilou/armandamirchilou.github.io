/**
 * Pushes the staged Space (dist-space/) to a Hugging Face Space repo.
 *
 *   npm run push:space -- https://huggingface.co/spaces/<user>/<space>
 *
 * Exists because the manual version has one easy-to-miss trap: .gitattributes
 * must be committed BEFORE the voice sample, or git stores the raw 2 MB binary
 * and the Hub refuses the push. A later "fix" commit cannot help, because the
 * bad blob remains in history and the pre-receive hook scans every commit.
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist-space';
const url = process.argv.slice(2).find((a) => !a.startsWith('--'));

if (!url || !/^https:\/\/huggingface\.co\/spaces\/[^/]+\/[^/]+\/?$/.test(url)) {
  console.error('usage: npm run push:space -- https://huggingface.co/spaces/<user>/<space>');
  process.exit(1);
}
if (!existsSync(OUT)) {
  console.error(`${OUT}/ not found — run: npm run build:space`);
  process.exit(1);
}
if (!existsSync(join(OUT, '.gitattributes'))) {
  console.error('.gitattributes missing from the staged Space — rebuild with: npm run build:space');
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { cwd: OUT, stdio: 'inherit' });
const quiet = (cmd) => execSync(cmd, { cwd: OUT, encoding: 'utf8' }).trim();

// Start from a clean history so nothing from a previous attempt leaks in.
rmSync(join(OUT, '.git'), { recursive: true, force: true });

run('git init -q -b main');
run('git lfs install --local');

// Commit the LFS rules on their own first. Everything staged afterwards is
// filtered by them, so the wav becomes a pointer rather than a raw blob.
run('git add .gitattributes');
run('git -c user.email=bot@local -c user.name=space-deploy commit -q -m "Track binaries with LFS"');

run('git add -A');
run('git -c user.email=bot@local -c user.name=space-deploy commit -q -m "Twin backend: Express API + XTTS voice clone"');

// Refuse to push if any raw blob over 100 KB survived (package-lock is text).
const big = quiet('git ls-tree -r -l HEAD')
  .split('\n')
  .map((l) => l.trim().split(/\s+/))
  .filter((p) => Number(p[3]) > 100_000 && !p[4]?.endsWith('package-lock.json'));

if (big.length) {
  console.error('\nAborting — these would be pushed as raw binaries:');
  for (const p of big) console.error(`  ${p[4]} (${p[3]} bytes)`);
  process.exit(1);
}
console.log('\nchecked: no raw binaries, voice sample is an LFS pointer');

run(`git remote add origin ${url.replace(/\/$/, '')}`);
console.log('\npushing (force-replaces the Space\'s empty initial commit)...');
run('git push -f origin main');

console.log('\nDone. Add OPENROUTER_API_KEY in the Space settings, then watch the build.');
