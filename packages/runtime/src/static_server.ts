import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, posix } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

export interface ServedSite {
  /** Adresa koreňa webu, končí lomkou. */
  url: string;
  close(): Promise<void>;
}

/** Cesta z URL na kľúč v mape súborov, napr. `/css/` → `css/index.html`. `null` = mimo webu. */
export function resolve_path(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const normalized = posix.normalize(`/${decoded}`);
  if (!normalized.startsWith('/')) return null;
  const path = normalized.slice(1);
  return path === '' || path.endsWith('/') ? `${path}index.html` : path;
}

/**
 * Naservíruje súbory z pamäte na 127.0.0.1 na náhodnom porte.
 * Kľúče mapy sú cesty bez úvodnej lomky (`index.html`, `css/style.css`).
 */
export async function serve_files(
  files: ReadonlyMap<string, Uint8Array | string>,
): Promise<ServedSite> {
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const path = resolve_path(pathname);
    const body = path === null ? undefined : files.get(path);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
    } else if (path === null || body === undefined) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404');
    } else {
      res.writeHead(200, {
        'content-type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${String(port)}/`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}
