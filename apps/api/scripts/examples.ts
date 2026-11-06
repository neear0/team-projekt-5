// Ukážkové odpovede API pre vývoj UI: `pnpm --filter @ooko/api examples`.
// Volá skutočné endpointy (bez servera), GitHub a W3C validátory, výsledok zapíše do docs/examples/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { create_client } from '@ooko/client';
import { parse_rubric } from '@ooko/contracts';
import * as ai from '../api/ai.ts';
import * as health from '../api/health.ts';
import * as runtime from '../api/runtime.ts';
import * as static_step from '../api/static.ts';

const out_dir = new URL('../../../docs/examples/', import.meta.url);
const repo = 'https://github.com/neear0/team-projekt-5/tree';
const examples = [
  // Web projektu, rubriku nespĺňa, veľa nálezov.
  { name: 'web-s-chybami', repo_url: `${repo}/01-web-setup` },
  // Ukážkový web z testov, spĺňa všetky pravidlá.
  {
    name: 'web-bez-chyb',
    repo_url: `${repo}/02-backend/packages/analyzer/test/fixtures/webove-sidlo`,
  },
];

const handlers: Record<string, (request: Request) => Response | Promise<Response>> = {
  '/api/health': () => health.GET(),
  '/api/static': static_step.POST,
  '/api/runtime': runtime.POST,
  '/api/ai': ai.POST,
};

const client = create_client({
  base_url: 'http://ooko.local',
  fetch: (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const handler = handlers[url.pathname];
    if (url.host === 'ooko.local' && handler) return Promise.resolve(handler(request));
    return fetch(request);
  },
});

const parsed = parse_rubric(
  readFileSync(new URL('../../../rubrics/webove-sidlo.yaml', import.meta.url), 'utf8'),
);
if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
const rubric = parsed.rubric;

const write = (name: string, data: unknown) => {
  writeFileSync(new URL(name, out_dir), `${JSON.stringify(data, null, 2)}\n`);
};

mkdirSync(out_dir, { recursive: true });
write('rubric.json', rubric);

for (const { name, repo_url } of examples) {
  const result = await client.analyze({ repo_url, rubric, ai: { provider: 'none' } });
  write(`${name}.static.json`, result.static);
  write(`${name}.runtime.json`, result.runtime);
  write(`${name}.ai.json`, result.ai);
  write(`${name}.report.json`, { ...result.report, generated_at: '2026-11-06T12:00:00.000Z' });
  console.log(`${name}: ${String(result.report.points)} / ${String(result.report.max_points)}`);
}

// Telo chybovej odpovede tak, ako ho vráti server.
const response = await static_step.POST(
  new Request('http://ooko.local/api/static', {
    method: 'POST',
    body: JSON.stringify({ repo_url: 'https://github.com/neear0/neexistuje', rubric }),
  }),
);
write('chyba-404.json', await response.json());
