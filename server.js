const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app  = express();
const PORT = process.env.PORT || 3300;

// ── Crash guard ───────────────────────────────────────────────────────────────
process.on('uncaughtException',  err => console.error('[UncaughtException]',  err.message));
process.on('unhandledRejection', err => console.error('[UnhandledRejection]', err));

// ── CORS proxy for 2embed.cc API ──────────────────────────────────────────────
app.use(
  '/api',
  createProxyMiddleware({
    target: 'https://api.2embed.cc',
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    on: {
      proxyRes: (proxyRes) => {
        proxyRes.headers['access-control-allow-origin']  = '*';
        proxyRes.headers['access-control-allow-methods'] = 'GET,OPTIONS';
        proxyRes.headers['access-control-allow-headers'] = 'Content-Type';
      },
      error: (err, req, res) => {
        console.error('[Proxy Error]', err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Upstream API unavailable', detail: err.message });
        }
      },
    },
  })
);

// ── Serve static files (HTML, CSS, JS, images) ───────────────────────────────
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
}));

// ── SPA fallback — serve index.html for all unknown routes ───────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  izleyebilirsin → http://localhost:${PORT}`);
  console.log(`🔀  Proxy: /api/* → https://api.2embed.cc/*`);
});
