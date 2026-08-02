// Live progress meter for the Chatterbox voice-model download.
//   node voice/download-progress.mjs          → one snapshot
//   node voice/download-progress.mjs --watch   → live bar, updates every 3s
// (or: npm run voice:progress)
import { statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BLOBS = join(HERE, '.hf-cache', 'hub', 'models--ResembleAI--chatterbox', 'blobs');

// Full model is ~2.1 GB across a few files; this is the denominator for %.
const TOTAL_MB = 2100;

// A file only counts when it is FULLY downloaded (a plain blob). ".incomplete"
// files are partial/aborted attempts and must NOT be counted as progress —
// counting them is what produced a false "100%".
function scan() {
  let doneMB = 0;
  let partialMB = 0;
  let incompleteCount = 0;
  try {
    for (const f of readdirSync(BLOBS)) {
      let sz = 0;
      try { sz = statSync(join(BLOBS, f)).size; } catch { continue; }
      if (f.includes('.incomplete')) { partialMB += sz / 1e6; incompleteCount++; }
      else doneMB += sz / 1e6;
    }
  } catch { /* cache dir not created yet */ }
  return { doneMB, partialMB, incompleteCount };
}
function downloadedMB() { return scan().doneMB; }

function human(mins) {
  if (!isFinite(mins) || mins <= 0) return '—';
  if (mins < 60) return `${Math.ceil(mins)} min`;
  if (mins < 1440) return `${(mins / 60).toFixed(1)} h`;
  return `${(mins / 1440).toFixed(1)} days`;
}

function render(mb, speedKBs, etaMin) {
  const pct = Math.min(100, (mb / TOTAL_MB) * 100);
  const N = 32;
  const filled = Math.round((pct / 100) * N);
  const bar = '#'.repeat(filled) + '-'.repeat(N - filled);
  const spd = speedKBs == null ? '' : speedKBs < 0.1 ? '  (stalled)' : `  ${speedKBs.toFixed(0)} KB/s  ETA ${human(etaMin)}`;
  return `[${bar}] ${pct.toFixed(1)}%   ${mb.toFixed(0)} / ${TOTAL_MB} MB${spd}`;
}

const watch = process.argv.includes('--watch');

function statusLine() {
  const { doneMB, partialMB, incompleteCount } = scan();
  if (incompleteCount === 0 && doneMB >= TOTAL_MB - 60) {
    return '\nComplete - all files downloaded. Run: npm run voice:chatterbox';
  }
  if (incompleteCount > 0) {
    return `\nNOT finished: ${incompleteCount} file(s) still unfinished (${partialMB.toFixed(0)} MB of partial data that can't be used yet).\nThe big model files haven't completed. Turn on a VPN, then run: npm run voice:download`;
  }
  return '\nNot complete. Run `npm run voice:download` (use a VPN if it stays stalled).';
}

if (!watch) {
  console.log(render(downloadedMB(), null, null));
  console.log(statusLine());
} else {
  let last = null;
  let lastT = null;
  const tick = () => {
    const mb = downloadedMB();
    const now = Date.now();
    let speed = null;
    let eta = Infinity;
    if (last != null) {
      const dMB = mb - last;
      const dS = (now - lastT) / 1000;
      speed = (dMB * 1000) / dS; // KB/s
      if (speed > 0.1) eta = (TOTAL_MB - mb) / (dMB / dS) / 60; // minutes
    }
    last = mb;
    lastT = now;
    process.stdout.write('\r' + render(mb, speed, eta) + '   ');
    if (mb >= TOTAL_MB - 30) {
      process.stdout.write('\nComplete!\n');
      process.exit(0);
    }
  };
  tick();
  setInterval(tick, 3000);
}
