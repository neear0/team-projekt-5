// Lokálny server pre funkcie v api/, aby sa dalo vyvíjať bez Vercel účtu.
// Spúšťa sa cez `pnpm --filter @ooko/api dev`. Na Verceli sa nepoužíva.
import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { error_response, HttpError } from '@ooko/http';

const PORT = Number(process.env.PORT ?? 3000);
const api_dir = new URL('../api/', import.meta.url);

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
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

createServer((req, res) => {
  const started = performance.now();
  const url = new URL(req.url ?? '/', 'http://localhost');
  const name = /^\/api\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? '';
  const method = req.method ?? 'GET';

  load_handler(name, method)
    .then((handler) => handler(to_request(req)))
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
});
