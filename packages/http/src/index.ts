import type { ErrorBody, ErrorCode } from '@ooko/contracts';
import { z } from 'zod';

// Chybové hlášky z validácie vstupu po slovensky.
z.config(z.locales.sk());

/** Vercel aj tak viac neprijme, lokálne to strážime sami. */
export const MAX_BODY_BYTES = 4.5 * 1024 * 1024;

type Issue = NonNullable<ErrorBody['error']['issues']>[number];

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly issues: Issue[] | undefined;

  constructor(status: number, code: ErrorCode, message: string, issues?: Issue[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error_response(err: unknown): Response {
  if (err instanceof HttpError) {
    const body: ErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.issues && { issues: err.issues }),
      },
    };
    return json(body, { status: err.status });
  }
  // Telo požiadavky nelogujeme, môže obsahovať API kľúč.
  console.error(err);
  const body: ErrorBody = { error: { code: 'internal', message: 'Neočakávaná chyba servera.' } };
  return json(body, { status: 500 });
}

async function read_json(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) {
    throw new HttpError(413, 'payload_too_large', 'Požiadavka je príliš veľká.');
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
    throw new HttpError(413, 'payload_too_large', 'Požiadavka je príliš veľká.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'bad_request', 'Telo požiadavky nie je platný JSON.');
  }
}

/**
 * POST endpoint: prečíta JSON, overí ho schémou a výsledok `run` vráti ako JSON.
 * Chyby premení na jednotný tvar `ErrorBody`.
 */
export function post_handler<S extends z.ZodType>(
  schema: S,
  run: (input: z.output<S>, request: Request) => Promise<unknown>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const parsed = schema.safeParse(await read_json(request));
      if (!parsed.success) {
        throw new HttpError(
          400,
          'bad_request',
          'Neplatná požiadavka.',
          parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        );
      }
      return json(await run(parsed.data, request));
    } catch (err) {
      return error_response(err);
    }
  };
}
