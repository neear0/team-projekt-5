import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HttpError, MAX_BODY_BYTES, post_handler } from './index.ts';

const handler = post_handler(z.object({ name: z.string() }), ({ name }) => {
  if (name === 'chyba') throw new Error('tajné');
  if (name === 'nenajdene') throw new HttpError(404, 'not_found', 'Nenašlo sa.');
  return Promise.resolve({ hello: name });
});

function post(body: string): Request {
  return new Request('http://localhost/api/test', { method: 'POST', body });
}

describe('post_handler', () => {
  it('vráti výsledok ako JSON', async () => {
    const res = await handler(post('{"name":"Ooko"}'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ hello: 'Ooko' });
  });

  it('neplatný JSON je 400', async () => {
    const res = await handler(post('{'));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'bad_request' } });
  });

  it('zlé polia vráti v issues', async () => {
    const res = await handler(post('{"name":1}'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { issues: { path: string }[] } };
    expect(body.error.issues[0]?.path).toBe('name');
  });

  it('HttpError zachová status a kód', async () => {
    const res = await handler(post('{"name":"nenajdene"}'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Nenašlo sa.' } });
  });

  it('neočakávaná chyba je 500 bez detailov', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await handler(post('{"name":"chyba"}'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('tajné');
    log.mockRestore();
  });

  it('príliš veľké telo je 413', async () => {
    const res = await handler(post(`{"name":"${'a'.repeat(MAX_BODY_BYTES)}"}`));
    expect(res.status).toBe(413);
  });
});
