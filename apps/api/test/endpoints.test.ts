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
import * as staticStep from '../api/static.ts';

const repoUrl = 'https://github.com/neear0/team-projekt-5';

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
    const staticResult = StaticResponse.parse(
      await (await staticStep.POST(post({ repoUrl }))).json(),
    );
    const runtimeResult = RuntimeResponse.parse(
      await (await runtime.POST(post({ repoUrl }))).json(),
    );

    const res = await ai.POST(
      post({ ai: { provider: 'none' }, static: staticResult, runtime: runtimeResult }),
    );
    expect(res.status).toBe(200);
    AiResponse.parse(await res.json());
  });

  it.each([
    ['static', staticStep.POST],
    ['runtime', runtime.POST],
  ])('%s odmietne URL mimo GitHubu', async (_, handler) => {
    const res = await handler(post({ repoUrl: 'https://example.com/repo' }));
    expect(res.status).toBe(400);
    const body = ErrorBody.parse(await res.json());
    expect(body.error.issues?.[0]?.path).toBe('repoUrl');
  });
});
