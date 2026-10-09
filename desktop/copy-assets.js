// Copies the web app files into desktop/app/ (run by CI and local devs).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dest = path.join(__dirname, 'app');
fs.mkdirSync(path.join(dest, 'icons'), { recursive: true });
for (const f of ['qubators-miner.html', 'manifest.webmanifest', 'sw.js']) {
  fs.copyFileSync(path.join(root, f), path.join(dest, f));
}
for (const f of fs.readdirSync(path.join(root, 'icons'))) {
  if (f.endsWith('.png')) fs.copyFileSync(path.join(root, 'icons', f), path.join(dest, 'icons', f));
}
console.log('assets copied to desktop/app/');
