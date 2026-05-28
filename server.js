const express    = require('express');
const https      = require('https');
const http       = require('http');
const path       = require('path');
const url        = require('url');

const app  = express();
const PORT = process.env.PORT || 3300;

// ── Crash guard ───────────────────────────────────────────────────────────────
process.on('uncaughtException',  err => console.error('[UncaughtException]',  err.message));
process.on('unhandledRejection', err => console.error('[UnhandledRejection]', err));

// ── Manual proxy (avoids http-proxy-middleware fingerprinting) ─────────────────
const API_TARGETS = [
  'https://api.2embed.cc',
  'https://api.2embed.skin',   // fallback 1
];

// Rotate index so if first fails we try next
let targetIdx = 0;

function proxyRequest(req, res, targetBase) {
  const parsed   = url.parse(targetBase);
  const isHttps  = parsed.protocol === 'https:';
  const reqPath  = req.url.replace(/^\/api/, '') || '/';
  const options  = {
    hostname: parsed.hostname,
    port:     parsed.port || (isHttps ? 443 : 80),
    path:     reqPath,
    method:   'GET',
    headers: {
      'Accept':          'application/json',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer':         'https://www.2embed.cc/',
      'Origin':          'https://www.2embed.cc',
    },
    timeout: 12000,
  };

  const proto = isHttps ? https : http;

  const proxyReq = proto.request(options, (proxyRes) => {
    if (proxyRes.statusCode === 403 || proxyRes.statusCode === 429) {
      // Try next target
      const nextIdx = (API_TARGETS.indexOf(targetBase) + 1) % API_TARGETS.length;
      if (nextIdx !== API_TARGETS.indexOf(targetBase)) {
        return proxyRequest(req, res, API_TARGETS[nextIdx]);
      }
    }

    res.status(proxyRes.statusCode || 200);
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');

    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy Error] ${targetBase}${reqPath}: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: 'API unavailable', detail: err.message });
    }
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) res.status(504).json({ error: 'Gateway timeout' });
  });

  proxyReq.end();
}

// OPTIONS preflight
app.options('/api/*path', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

// API proxy route
app.get('/api/*path', (req, res) => {
  proxyRequest(req, res, API_TARGETS[0]);
});

// ── Serve static files ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  izleyebilirsin → http://localhost:${PORT}`);
  console.log(`🔀  Proxy: /api/* → ${API_TARGETS[0]}`);
});
