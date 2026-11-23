import { StaticRequest } from '@ooko/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as login from '../api/login.ts';
import * as logout from '../api/logout.ts';
import * as static_step from '../api/static.ts';
import middleware from '../middleware.ts';
import {
  create_session,
  password_matches,
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  verify_session,
} from '../lib/session.ts';

const PASSWORD = 'dlhe-testovacie-heslo';

afterEach(() => {
  vi.unstubAllEnvs();
});

const request = (path: string, init: RequestInit & { cookie?: string } = {}) =>
  new Request(`https://ooko.example${path}`, {
    ...init,
    headers: { ...(init.cookie && { cookie: `${SESSION_COOKIE}=${init.cookie}` }) },
  });

describe('session', () => {
  it('platí so správnym heslom a do vypršania', async () => {
    const now = 1_800_000_000_000;
    const token = await create_session(PASSWORD, now);
    expect(await verify_session(token, PASSWORD, now + 1000)).toBe(true);
    expect(await verify_session(token, 'ine-heslo', now + 1000)).toBe(false);
    expect(await verify_session(token, PASSWORD, now + SESSION_MAX_AGE_S * 1000 + 1)).toBe(false);
  });

  it('odmietne upravenú platnosť aj nezmysel', async () => {
    const token = await create_session(PASSWORD);
    const [v, expires, sig] = token.split('.');
    const forged = `${v ?? ''}.${String(Number(expires) + 1e9)}.${sig ?? ''}`;
    expect(await verify_session(forged, PASSWORD)).toBe(false);
    expect(await verify_session('v1.1.%%%', PASSWORD)).toBe(false);
    expect(await verify_session('', PASSWORD)).toBe(false);
  });

  it('porovná heslo', async () => {
    expect(await password_matches(PASSWORD, PASSWORD)).toBe(true);
    expect(await password_matches('dlhe-testovacie-hesl', PASSWORD)).toBe(false);
  });
});

describe('middleware', () => {
  it('bez APP_PASSWORD lokálne pustí všetko', async () => {
    expect(await middleware(request('/api/static'))).toBeUndefined();
  });

  it('na Verceli bez APP_PASSWORD nepustí nič', async () => {
    vi.stubEnv('VERCEL', '1');
    expect((await middleware(request('/api/static')))?.status).toBe(503);
  });

  it('stránku presmeruje na prihlásenie, API vráti 401', async () => {
    vi.stubEnv('APP_PASSWORD', PASSWORD);
    const page = await middleware(request('/report?id=1'));
    expect(page?.status).toBe(302);
    expect(page?.headers.get('location')).toBe(
      'https://ooko.example/login.html?next=%2Freport%3Fid%3D1',
    );
    const api = await middleware(request('/api/static'));
    expect(api?.status).toBe(401);
    expect(await api?.json()).toMatchObject({ error: { code: 'unauthorized' } });
  });

  it('s platnou cookie pustí ďalej', async () => {
    vi.stubEnv('APP_PASSWORD', PASSWORD);
    const cookie = await create_session(PASSWORD);
    expect(await middleware(request('/api/static', { cookie }))).toBeUndefined();
  });
});

describe('prihlásenie', () => {
  const post = (body: unknown, cookie?: string) =>
    new Request('https://ooko.example/api/x', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie && { cookie: `${SESSION_COOKIE}=${cookie}` }),
      },
      body: JSON.stringify(body),
    });

  it('správne heslo nastaví cookie, s ňou prejde aj endpoint', async () => {
    vi.stubEnv('APP_PASSWORD', PASSWORD);
    const res = await login.POST(post({ password: PASSWORD }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/HttpOnly; Secure; SameSite=Lax/);
    const token = /ooko_session=([^;]+)/.exec(cookie)?.[1] ?? '';

    // Endpoint sám overí cookie (druhá vrstva za middleware). Telo je zámerne neplatné,
    // prihlásenie prešlo, ak príde 400 a nie 401.
    const body = { repo_url: 'x' } satisfies Partial<StaticRequest>;
    expect((await static_step.POST(post(body))).status).toBe(401);
    expect((await static_step.POST(post(body, token))).status).toBe(400);
  });

  it('zlé heslo vráti 401 bez cookie', async () => {
    vi.stubEnv('APP_PASSWORD', PASSWORD);
    const res = await login.POST(post({ password: 'zle' }));
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('odhlásenie zmaže cookie', () => {
    expect(logout.POST().headers.get('set-cookie')).toMatch(/ooko_session=; Path=\/; Max-Age=0/);
  });
});
