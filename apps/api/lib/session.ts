// Prihlásenie jedným heslom (APP_PASSWORD). Po prihlásení dostane prehliadač cookie
// `v1.<platnosť>.<podpis>`, podpis je HMAC-SHA256 kľúčom odvodeným z hesla. Zmena hesla
// teda odhlási všetkých. Bez databázy a bez závislostí, beží v middleware aj vo funkciách.
import type { webcrypto } from 'node:crypto';

export const SESSION_COOKIE = 'ooko_session';
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

export type AuthConfig =
  | { mode: 'disabled' } // lokálny vývoj bez hesla
  | { mode: 'misconfigured' } // Vercel bez APP_PASSWORD: radšej nič nepustiť
  | { mode: 'password'; password: string };

export function auth_config(env: Record<string, string | undefined> = process.env): AuthConfig {
  const password = env.APP_PASSWORD;
  if (password) return { mode: 'password', password };
  return env.VERCEL === '1' ? { mode: 'misconfigured' } : { mode: 'disabled' };
}

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function from_base64url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function signing_key(password: string): Promise<webcrypto.CryptoKey> {
  // Kľúč z hesla a pevného účelu, aby podpis cookie nebol to isté ako odtlačok hesla.
  const material = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`ooko-session:${password}`),
  );
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function create_session(password: string, now = Date.now()): Promise<string> {
  const payload = `v1.${String(now + SESSION_MAX_AGE_S * 1000)}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signing_key(password),
    encoder.encode(payload),
  );
  return `${payload}.${base64url(signature)}`;
}

export async function verify_session(
  token: string,
  password: string,
  now = Date.now(),
): Promise<boolean> {
  const [version, expires, signature] = token.split('.');
  if (version !== 'v1' || !expires || !signature || !/^\d+$/.test(expires)) return false;
  if (Number(expires) <= now) return false;
  const bytes = from_base64url(signature);
  if (!bytes) return false;
  // crypto.subtle.verify porovnáva v konštantnom čase.
  return crypto.subtle.verify(
    'HMAC',
    await signing_key(password),
    bytes,
    encoder.encode(`${version}.${expires}`),
  );
}

/** Porovnanie hesla bez úniku cez čas: porovnávajú sa odtlačky rovnakej dĺžky. */
export async function password_matches(input: string, password: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(input)),
    crypto.subtle.digest('SHA-256', encoder.encode(password)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function read_cookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export function session_cookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${String(SESSION_MAX_AGE_S)}; HttpOnly; Secure; SameSite=Lax`;
}

export function clear_session_cookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/** `true` = požiadavka môže pokračovať. */
export async function is_authenticated(request: Request, config = auth_config()): Promise<boolean> {
  if (config.mode === 'disabled') return true;
  if (config.mode === 'misconfigured') return false;
  const token = read_cookie(request, SESSION_COOKIE);
  return token !== null && verify_session(token, config.password);
}
