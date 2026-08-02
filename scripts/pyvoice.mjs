// Cross-shell launcher for the Chatterbox venv Python scripts.
// Avoids the Windows "npm + cmd + forward-slash path" bug by letting Node
// resolve and spawn python.exe natively. Usage:
//   node scripts/pyvoice.mjs voice/download_model.py
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const py = join('voice', 'chatterbox-venv', 'Scripts', 'python.exe');
const target = process.argv[2];

if (!target) {
  console.error('Usage: node scripts/pyvoice.mjs <python-script>');
  process.exit(2);
}
if (!existsSync(py)) {
  console.error(`Chatterbox venv Python not found at ${py}.`);
  console.error('The isolated voice environment may be missing — tell me and I can rebuild it.');
  process.exit(1);
}

const res = spawnSync(py, [target, ...process.argv.slice(3)], { stdio: 'inherit' });
process.exit(res.status ?? 1);
