// Qubators Miner desktop shell: serves the bundled app over local HTTP
// (so login / progress / certificates in localStorage keep working offline).
const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'app');
const LIVE = 'https://chidiwokocha401-beep.github.io/qubators-miner/qubators-miner.html';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/') p = '/qubators-miner.html';
        const f = path.normalize(path.join(ROOT, p));
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'
        });
        fs.createReadStream(f).pipe(res);
      } catch (e) {
        res.writeHead(500);
        res.end('Error');
      }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv.address().port));
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    autoHideMenuBar: true,
    backgroundColor: '#0b0f14',
    title: 'Qubators Miner'
  });
  const bundled = path.join(ROOT, 'qubators-miner.html');
  if (fs.existsSync(bundled)) {
    const port = await startServer();
    win.loadURL('http://127.0.0.1:' + port + '/qubators-miner.html');
  } else {
    win.loadURL(LIVE);
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
