import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve_path, serve_files, type ServedSite } from './static_server.ts';

describe('resolve_path', () => {
  it.each([
    ['/', 'index.html'],
    ['/css/style.css', 'css/style.css'],
    ['/podstranka/', 'podstranka/index.html'],
    ['/obr%C3%A1zky/m%C4%8Dka.png', 'obrázky/mčka.png'],
    ['/../../etc/passwd', 'etc/passwd'],
    ['/a/%2e%2e/%2e%2e/b.html', 'b.html'],
  ])('%s → %s', (input, expected) => {
    expect(resolve_path(input)).toBe(expected);
  });

  it.each(['/%E0%A4%A', '/a%00.html'])('odmietne %s', (input) => {
    expect(resolve_path(input)).toBeNull();
  });
});

describe('serve_files', () => {
  let site: ServedSite;

  beforeAll(async () => {
    site = await serve_files(
      new Map([
        ['index.html', '<h1>Ahoj</h1>'],
        ['css/style.css', 'h1 { color: red; }'],
      ]),
    );
  });

  afterAll(() => site.close());

  it('počúva iba na 127.0.0.1', () => {
    expect(site.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  });

  it('vráti index.html so správnym typom', async () => {
    const res = await fetch(site.url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toBe('<h1>Ahoj</h1>');
  });

  it('vráti CSS', async () => {
    const res = await fetch(new URL('css/style.css', site.url));
    expect(res.headers.get('content-type')).toBe('text/css; charset=utf-8');
  });

  it('neznámy súbor je 404', async () => {
    const res = await fetch(new URL('chyba.html', site.url));
    expect(res.status).toBe(404);
  });

  it('POST nie je povolený', async () => {
    const res = await fetch(site.url, { method: 'POST' });
    expect(res.status).toBe(405);
  });
});
