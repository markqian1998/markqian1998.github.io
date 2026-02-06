import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5174;

const serveFile = async (res, filePath) => {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf'
    };
    res.writeHead(200, { 'Content-Type': typeMap[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
};

const fetchStooq = async (symbol) => {
  const urls = [
    `https://stooq.pl/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`,
    `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'text/csv'
        }
      });
      if (!res.ok) continue;
      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) continue;
      const row = lines[1];
      const cells = row.split(',');
      if (cells.length < 8) continue;
      const close = Number(cells[6]);
      const open = Number(cells[4]);
      if (!Number.isFinite(close) || !Number.isFinite(open)) continue;
      const change = close - open;
      const changePct = open ? (change / open) * 100 : 0;
      return { symbol, price: close, change, changePct };
    } catch {
      continue;
    }
  }
  return null;
};

const proxyStooq = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const symbols = (url.searchParams.get('symbols') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!symbols.length) {
    res.writeHead(400);
    res.end('Missing symbols');
    return;
  }
  try {
    const quotes = await Promise.all(symbols.map(fetchStooq));
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({ quotes: quotes.filter(Boolean) }));
  } catch {
    res.writeHead(502);
    res.end('Proxy error');
  }
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/stooq') {
    return proxyStooq(req, res);
  }

  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.join(__dirname, filePath);
  return serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
});
