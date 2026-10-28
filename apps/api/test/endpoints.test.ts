import {
  AiResponse,
  ErrorBody,
  HealthResponse,
  RuntimeResponse,
  StaticResponse,
} from '@ooko/contracts';
import { describe, expect, it } from 'vitest';
import * as ai from '../api/ai.ts';
import * as health from '../api/health.ts';
import * as runtime from '../api/runtime.ts';
import * as static_step from '../api/static.ts';

const repo_url = 'https://github.com/neear0/team-projekt-5';
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
