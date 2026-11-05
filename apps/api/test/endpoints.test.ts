import {
  AiResponse,
  ErrorBody,
  HealthResponse,
  RuntimeResponse,
  StaticResponse,
} from '@ooko/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { make_tar_gz } from '../../../packages/analyzer/test/tar.ts';
import * as ai from '../api/ai.ts';
import * as health from '../api/health.ts';
import * as runtime from '../api/runtime.ts';
import * as static_step from '../api/static.ts';

const repo_url = 'https://github.com/student/web';
const missing_repo_url = 'https://github.com/student/neexistuje';

// GitHub a W3C validátor bez siete.
beforeEach(() => {
  vi.stubGlobal('fetch', (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.startsWith('https://codeload.github.com/student/web/')) {
      const html =
        '<!DOCTYPE html>\n<html lang="sk"><head><title>Web</title></head><body></body></html>';
      return Promise.resolve(new Response(make_tar_gz({ 'index.html': html })));
    }
    if (url.startsWith('https://codeload.github.com/')) {
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    }
    if (url.startsWith('https://validator.w3.org/'))
      return Promise.resolve(Response.json({ messages: [] }));
    return Promise.reject(new Error(`neočakávaná požiadavka ${url}`));
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});
const rubric = {
  version: 1,
  id: 'test',
  title: 'Testovacia rubrika',
  criteria: [
    { id: 'html', title: 'HTML', points: 2, rules: [{ type: 'html.valid' }] },
    { id: 'pristupnost', title: 'Prístupnosť', points: 3, rules: [{ type: 'axe.max_violations' }] },
    { id: 'vizual', title: 'Vizuál', points: 1, ai: 'Posúď vizuál.' },
  ],
};

function post(body: unknown): Request {
  return new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('API', () => {
  it('health', async () => {
    const res = health.GET();
    expect(res.status).toBe(200);
    HealthResponse.parse(await res.json());
  });

  it('celý reťazec static → runtime → ai drží tvar kontraktov', async () => {
    const static_result = StaticResponse.parse(
      await (await static_step.POST(post({ repo_url, rubric }))).json(),
    );
    const runtime_result = RuntimeResponse.parse(
      await (await runtime.POST(post({ repo_url, rubric }))).json(),
    );

    const res = await ai.POST(
      post({ ai: { provider: 'none' }, rubric, static: static_result, runtime: runtime_result }),
    );
    expect(res.status).toBe(200);
    const ai_result = AiResponse.parse(await res.json());
    expect(ai_result.criteria.map((c) => [c.id, c.points])).toEqual([
      ['html', 2],
      ['pristupnost', 3],
      ['vizual', 0],
    ]);
  });

  it('static stiahne repozitár a vyhodnotí pravidlá', async () => {
    const res = await static_step.POST(post({ repo_url, rubric }));
    expect(res.status).toBe(200);
    const body = StaticResponse.parse(await res.json());
    expect(body.files.map((f) => f.path)).toEqual(['index.html']);
    expect(body.rule_results).toMatchObject([{ criterion_id: 'html', passed: true }]);
  });

  it('static vráti 404, ak repozitár neexistuje', async () => {
    const res = await static_step.POST(post({ repo_url: missing_repo_url, rubric }));
    expect(res.status).toBe(404);
    expect(ErrorBody.parse(await res.json()).error.code).toBe('not_found');
  });

  it.each([
    ['static', static_step.POST],
    ['runtime', runtime.POST],
  ])('%s odmietne URL mimo GitHubu', async (_, handler) => {
    const res = await handler(post({ repo_url: 'https://example.com/repo', rubric }));
    expect(res.status).toBe(400);
    const body = ErrorBody.parse(await res.json());
    expect(body.error.issues?.[0]?.path).toBe('repo_url');
  });
});
