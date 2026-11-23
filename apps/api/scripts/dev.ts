// Lokálny server pre funkcie v api/ a súbory v public/, aby sa dalo vyvíjať bez Vercel účtu.
// Spúšťa sa cez `pnpm --filter @ooko/api dev`. Na Verceli sa nepoužíva. Ako na Verceli
// najprv beží middleware.ts (prihlásenie, ak je nastavené APP_PASSWORD).
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { error_response, HttpError } from '@ooko/http';
import middleware, { config as middleware_config } from '../middleware.ts';

const PORT = Number(process.env.PORT ?? 3000);
const api_dir = new URL('../api/', import.meta.url);
const public_dir = new URL('../public/', import.meta.url);
const middleware_matchers = middleware_config.matcher.map((m) => new RegExp('^' + m + '$'));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

type Handler = (request: Request) => Response | Promise<Response>;

async function load_handler(name: string, method: string): Promise<Handler> {
  const file = new URL(`${name}.ts`, api_dir);
  if (!/^[a-z][a-z0-9-]*$/.test(name) || !existsSync(file)) {
    throw new HttpError(404, 'not_found', 'Endpoint neexistuje.');
  }
  const mod = (await import(file.href)) as Record<string, unknown>;
  const handler = mod[method];
  if (typeof handler !== 'function') {
    throw new HttpError(405, 'method_not_allowed', `Metóda ${method} nie je podporovaná.`);
  }
  return handler as Handler;
}

/** Súbor z public/, ako ho servíruje Vercel. */
function serve_public(pathname: string): Response {
  const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const file = new URL(`.${relative}`, public_dir);
  if (!file.href.startsWith(public_dir.href) || !existsSync(file)) {
    return new Response('404', { status: 404 });
  }
  return new Response(readFileSync(file), {
    headers: { 'content-type': MIME[extname(file.pathname)] ?? 'application/octet-stream' },
  });
}

function to_request(req: IncomingMessage): Request {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) for (const v of value) headers.append(key, v);
  }
  const has_body = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method ?? 'GET',
    headers,
    ...(has_body && { body: Readable.toWeb(req) as ReadableStream, duplex: 'half' }),
  });
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key !== 'set-cookie') res.setHeader(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}

createServer((req, res) => {
  const started = performance.now();
  const url = new URL(req.url ?? '/', 'http://localhost');
  const name = /^\/api\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? '';
  const method = req.method ?? 'GET';
  const request = to_request(req);

  const run = async (): Promise<Response> => {
    if (middleware_matchers.some((m) => m.test(url.pathname))) {
      const blocked = await middleware(request);
      if (blocked) return blocked;
    }
    if (!url.pathname.startsWith('/api/')) return serve_public(url.pathname);
    return (await load_handler(name, method))(request);
  };

  run()
    .catch(error_response)
    .then((response) => send(res, response))
    .then(() => {
      const ms = Math.round(performance.now() - started);
      console.log(`${method} ${url.pathname} ${String(res.statusCode)} ${String(ms)} ms`);
    })
    .catch((err: unknown) => {
      console.error(err);
    });
}).listen(PORT, () => {
  console.log(`API beží na http://localhost:${String(PORT)}/api/health`);
  if (process.env.APP_PASSWORD) {
    console.log(`Prihlásenie: http://localhost:${String(PORT)}/login.html`);
  }
});
