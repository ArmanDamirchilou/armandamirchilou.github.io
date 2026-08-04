/**
 * Assembles a self-contained Hugging Face Space in dist-space/.
 *
 * A Space needs its Dockerfile and README at ITS repo root, and this project's
 * root is the website. Rather than polluting the site repo, we stage exactly
 * the backend files the image needs and push that folder as the Space.
 *
 * It also picks up voice/arman_voice_sample.wav, which .gitignore keeps out of
 * the website repo but the voice clone cannot work without.
 *
 *   node scripts/build-hf-space.mjs
 */
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Same backend, two targets: a Hugging Face Space or a Liara Docker app. They
// differ only in the deploy manifest and the port, so the staging is shared.
const target = process.argv.includes('--liara') ? 'liara' : 'hf-space';
const OUT = target === 'liara' ? 'dist-liara' : 'dist-space';
const SPACE = join('deploy', target);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Deploy-root files. The Space needs a README carrying HF's YAML frontmatter;
// Liara needs liara.json instead. start.sh is shared.
const rootFiles =
  target === 'liara' ? ['Dockerfile', 'liara.json'] : ['Dockerfile', 'README.md'];
for (const f of rootFiles) {
  cpSync(join(SPACE, f), join(OUT, f));
}
cpSync(join('deploy', 'hf-space', 'start.sh'), join(OUT, 'start.sh'));

// Backend source and the data it reads at runtime.
for (const f of ['package.json', 'package-lock.json', 'tsconfig.server.json']) {
  cpSync(f, join(OUT, f));
}
cpSync('server', join(OUT, 'server'), { recursive: true });
cpSync('personality', join(OUT, 'personality'), { recursive: true });

// Only the pieces of voice/ the container actually runs — never the 6.9 GB
// venv or the HF model cache sitting next to them.
mkdirSync(join(OUT, 'voice'), { recursive: true });
cpSync(join('voice', 'clone_server.py'), join(OUT, 'voice', 'clone_server.py'));
cpSync(join('voice', 'requirements.txt'), join(OUT, 'requirements.txt'));

const sample = join('voice', 'arman_voice_sample.wav');
if (existsSync(sample)) {
  cpSync(sample, join(OUT, 'voice', 'arman_voice_sample.wav'));
  console.log('included voice sample');
} else {
  console.warn('WARNING: voice/arman_voice_sample.wav missing — the Space will fall back to Edge TTS');
}

// The image installs Python deps from requirements.txt at the root; strip the
// commented-out GPU install instructions so nothing misleads a later reader.
const reqs = readFileSync(join(OUT, 'requirements.txt'), 'utf8')
  .split('\n')
  .filter((l) => !l.startsWith('#'))
  .join('\n')
  .trim();
writeFileSync(join(OUT, 'requirements.txt'), `${reqs}\n`);

// Keep the Space repo from carrying build output or local env files.
writeFileSync(join(OUT, '.gitignore'), 'node_modules/\ndist-server/\npublic/audio/\n.env\n');

// The Hub rejects raw binaries. This must exist BEFORE the wav is staged, or
// git commits the real 2 MB file and the push is refused — and no later commit
// can fix it, because the blob stays in history.
writeFileSync(
  join(OUT, '.gitattributes'),
  '*.wav filter=lfs diff=lfs merge=lfs -text\n' +
    '*.bin filter=lfs diff=lfs merge=lfs -text\n' +
    '*.pth filter=lfs diff=lfs merge=lfs -text\n' +
    '*.onnx filter=lfs diff=lfs merge=lfs -text\n'
);

console.log(
  target === 'liara'
    ? `\nStaged in ${OUT}/ — deploy it with:\n  cd ${OUT} && liara deploy --app <your-app-name>`
    : `\nSpace staged in ${OUT}/ — push that folder to your Space remote.`
);
