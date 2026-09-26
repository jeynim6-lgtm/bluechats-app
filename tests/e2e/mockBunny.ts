/**
 * Minimal in-memory stand-in for the Bunny.net Storage API, used by the E2E tests.
 * Implements the parts the app relies on: AccessKey auth, PUT (with optional SHA-256 Checksum),
 * GET (with Range), DELETE and directory listing.
 */
import http from 'node:http';
import crypto from 'node:crypto';

export function startMockBunny(port: number, zone: string, accessKey: string) {
  const files = new Map<string, Buffer>();
  const stats = { puts: 0, gets: 0, deletes: 0, rejected: 0 };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const [, reqZone, ...rest] = decodeURIComponent(url.pathname).split('/');
    const path = rest.join('/');

    if (req.headers.accesskey !== accessKey || reqZone !== zone) {
      stats.rejected++;
      res.writeHead(401).end(JSON.stringify({ HttpCode: 401, Message: 'Unauthorized' }));
      return;
    }

    if (req.method === 'PUT') {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const checksum = req.headers.checksum as string | undefined;
        if (checksum && crypto.createHash('sha256').update(body).digest('hex').toUpperCase() !== checksum) {
          res.writeHead(400).end(JSON.stringify({ HttpCode: 400, Message: 'Checksum mismatch' }));
          return;
        }
        files.set(path, body);
        stats.puts++;
        res.writeHead(201).end(JSON.stringify({ HttpCode: 201, Message: 'File uploaded.' }));
      });
      return;
    }

    if (req.method === 'GET') {
      stats.gets++;
      if (!path) {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify([...files.keys()].map((k) => ({ ObjectName: k }))));
        return;
      }
      const file = files.get(path);
      if (!file) {
        res.writeHead(404).end(JSON.stringify({ HttpCode: 404, Message: 'Object Not Found' }));
        return;
      }
      const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Number(range[2]) : file.length - 1;
        res.writeHead(206, {
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${file.length}`,
          'Content-Type': 'application/octet-stream',
        });
        res.end(file.subarray(start, end + 1));
        return;
      }
      res.writeHead(200, { 'Content-Length': file.length, 'Content-Type': 'application/octet-stream' }).end(file);
      return;
    }

    if (req.method === 'DELETE') {
      stats.deletes++;
      const existed = files.delete(path);
      res.writeHead(existed ? 200 : 404).end();
      return;
    }

    res.writeHead(405).end();
  });

  return new Promise<{ close: () => void; files: Map<string, Buffer>; stats: typeof stats }>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({ close: () => server.close(), files, stats }));
  });
}
