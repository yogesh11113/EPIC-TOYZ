/**
 * Local development server for Epic Toyz.
 * Serves static files and executes Vercel-style /api/*.js serverless functions locally.
 * Loads environment variables from .env.local in the project root.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);

function loadEnvLocal() {
  const envPath = path.join(ROOT_DIR, '.env.local');
  if (!fs.existsSync(envPath)) return false;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
  return true;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function enhanceResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const envLoaded = loadEnvLocal();

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = decodeURIComponent(urlObj.pathname);

    // Handle /api/* serverless functions
    if (pathname.startsWith('/api/')) {
      const fnName = pathname.replace(/^\/api\//, '').replace(/\.js$/, '');
      const fnPath = path.join(ROOT_DIR, 'api', `${fnName}.js`);
      if (!fs.existsSync(fnPath)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: `API route /api/${fnName} not found` }));
        return;
      }

      req.query = Object.fromEntries(urlObj.searchParams.entries());
      const rawBody = await readRequestBody(req);
      if (rawBody) {
        try { req.body = JSON.parse(rawBody); } catch { req.body = rawBody; }
      } else {
        req.body = {};
      }

      // Clear require cache in dev so API edits take effect immediately
      delete require.cache[require.resolve(fnPath)];
      const handler = require(fnPath);
      await handler(req, enhanceResponse(res));
      return;
    }

    // Serve static files
    let relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let filePath = path.resolve(ROOT_DIR, relPath);
    if (!filePath.startsWith(ROOT_DIR)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('[dev-server] Error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`[EpicToyz Dev Server] Running at http://localhost:${PORT}`);
  console.log(`[EpicToyz Dev Server] .env.local loaded: ${envLoaded ? 'YES' : 'NO (create .env.local in project root)'}`);
});
