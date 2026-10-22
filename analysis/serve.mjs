/* analysis/serve.mjs — the local server the MV and the verification harness need.

   Two jobs `python -m http.server` cannot do:
   - byte ranges, without which an <audio> element cannot seek, and the player scrubs by seeking;
   - accepting a POST, so a frame the page rendered can be written straight to disk. The built-in
     browser's screenshot returns a stale compositor frame on a hidden page, so the evidence images
     are canvas.toBlob'd by the page itself and posted here.

   Node only, no dependencies. Run from anywhere; it serves the repository it lives in.

     node analysis/serve.mjs            # http://127.0.0.1:8773/index.html
     node analysis/serve.mjs 9000       # another port

   Captured frames land in the OS temp dir, not in the repository: analysis/verify.js posts to
   /save-<name>, and <name> is a bare filename.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(tmpdir(), 'world-execute-me-capture');
const PORT = Number(process.argv[2] || 8773);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.css': 'text/css', '.svg': 'image/svg+xml' };

await mkdir(OUT, { recursive: true });

createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url.startsWith('/save-')) {
      const name = path.basename(req.url.slice(6));           /* no traversal: one flat file */
      const chunks = [];
      for await (const c of req) chunks.push(c);
      await writeFile(path.join(OUT, name), Buffer.concat(chunks));
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); res.end('saved ' + name);
      return;
    }
    const p = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, p === '/' ? 'index.html' : p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('outside the repository'); return; }
    const st = await stat(file);
    const send = (code, start, end, extra) => {
      res.writeHead(code, { 'Accept-Ranges': 'bytes',
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Content-Length': String(end - start + 1), 'Access-Control-Allow-Origin': '*', ...extra });
      if (req.method !== 'HEAD') createReadStream(file, { start, end }).pipe(res);
    };
    const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (r && r[1]) send(206, +r[1], r[2] ? +r[2] : st.size - 1,
      { 'Content-Range': `bytes ${r[1]}-${r[2] || st.size - 1}/${st.size}` });
    else if (r && r[2]) send(206, st.size - +r[2], st.size - 1,
      { 'Content-Range': `bytes ${st.size - +r[2]}-${st.size - 1}/${st.size}` });
    else send(200, 0, st.size - 1);
  } catch (e) { res.writeHead(404); res.end(String(e.message)); }
}).listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}/index.html  (captures -> ${OUT})`));
