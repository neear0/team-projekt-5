import type { Rubric, RuntimeResponse, StaticResponse } from '@ooko/contracts';
import { describe, expect, it } from 'vitest';
import { ApiError, create_client, type Step } from './client.ts';
import { github_line_url, group_criteria } from './report.ts';

const rubric: Rubric = {
  version: 1,
  id: 'test',
  title: 'Test',
  criteria: [
    {
      id: 'a',
      title: 'A',
      group: 'HTML',
      points: 2,
      rules: [{ type: 'html.valid', max_errors: 0 }],
    },
    { id: 'b', title: 'B', points: 1, rules: [], ai: 'Posúď.' },
  ],
};

const static_result: StaticResponse = {
  files: [],
  findings: [{ tool: 'postcss', rule_id: 'css.syntax', severity: 'error', message: 'x' }],
  rule_results: [],
};
const runtime_result: RuntimeResponse = {
  screenshots: [],
  lighthouse: null,
  findings: [],
  rule_results: [],
};

function fake(routes: Record<string, () => Response | Promise<Response>>): typeof fetch {
  return (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    const path = new URL(url, 'http://localhost').pathname;
    const route = routes[path];
    return route ? Promise.resolve(route()) : Promise.reject(new TypeError('fetch failed'));
  };
}

const ok_routes = {
  '/api/static': () => Response.json(static_result),
  '/api/runtime': () => Response.json(runtime_result),
  '/api/ai': () =>
    Response.json({
      summary: 'Dobré.',
      criteria: [
        {
          id: 'a',
          title: 'A',
          group: 'HTML',
          points: 1.333333,
          max_points: 2,
          reasoning: '',
          findings: [],
        },
        { id: 'b', title: 'B', points: 1, max_points: 1, reasoning: '', findings: [] },
      ],
    }),
};

describe('create_client', () => {
  it('analyze prejde tri kroky a poskladá report', async () => {
    const client = create_client({ base_url: 'https://api.test/', fetch: fake(ok_routes) });
    const progress: string[] = [];
    const result = await client.analyze(
      {
        repo_url: 'https://github.com/s/w',
        rubric,
        ai: { provider: 'google', model: 'gemini', api_key: 'tajne' },
      },
      { on_progress: (step: Step, state) => progress.push(`${step} ${state}`) },
    );
    expect(progress.slice(-2)).toEqual(['ai running', 'ai done']);
    expect(result.report).toMatchObject({
      points: 2.33,
      max_points: 3,
      summary: 'Dobré.',
      ai: { provider: 'google', model: 'gemini' },
      findings: [{ rule_id: 'css.syntax' }],
    });
    expect(JSON.stringify(result.report)).not.toContain('tajne');
    expect(group_criteria(result.report.criteria).map((g) => [g.title, g.points])).toEqual([
      ['HTML', 1.33],
      [null, 1],
    ]);
  });

  it('chybu servera vráti ako ApiError s kódom a poliami', async () => {
    const client = create_client({
      fetch: fake({
        '/api/static': () =>
          Response.json(
            {
              error: {
                code: 'bad_request',
                message: 'Neplatná požiadavka.',
                issues: [{ path: 'repo_url', message: 'Zlá adresa.' }],
              },
            },
            { status: 400 },
          ),
      }),
    });
    const err = await client.static_step({ repo_url: 'x', rubric }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'bad_request', issues: [{ path: 'repo_url' }] });
  });

  it('rozlíši výpadok siete, timeout Vercelu a zrušenie', async () => {
    const offline = create_client({ fetch: fake({}) });
    await expect(offline.health()).rejects.toMatchObject({ code: 'network', status: null });

    const slow = create_client({
      fetch: fake({ '/api/runtime': () => new Response('<html>timeout</html>', { status: 504 }) }),
    });
    await expect(slow.runtime_step({ repo_url: 'x', rubric })).rejects.toMatchObject({
      code: 'timeout',
    });

    const controller = new AbortController();
    controller.abort();
    const client = create_client({ fetch: fake(ok_routes) });
    await expect(
      client.analyze(
        { repo_url: 'https://github.com/s/w', rubric, ai: { provider: 'none' } },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ code: 'aborted' });
  });

  it('odpoveď v zlom tvare neprejde', async () => {
    const client = create_client({ fetch: fake({ '/api/health': () => Response.json({}) }) });
    await expect(client.health()).rejects.toMatchObject({ code: 'bad_response' });
  });
});

describe('github_line_url', () => {
  it('pridá vetvu, priečinok a riadok', () => {
    expect(github_line_url('https://github.com/s/w', 'index.html', 36)).toBe(
      'https://github.com/s/w/blob/HEAD/index.html#L36',
    );
    expect(github_line_url('https://github.com/s/w/tree/main/web', 'style.css')).toBe(
      'https://github.com/s/w/blob/main/web/style.css',
    );
  });
});
