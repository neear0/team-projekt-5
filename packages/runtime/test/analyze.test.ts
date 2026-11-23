// Integračný test so skutočným prehliadačom. Beží iba, keď je nastavený BROWSER_CHANNEL
// (`chrome`, `msedge`) alebo CHROMIUM_PATH, napr. `BROWSER_CHANNEL=msedge pnpm test`.
import { parse_rubric, type Rubric } from '@ooko/contracts';
import { describe, expect, it } from 'vitest';
import { analyze_runtime } from '../src/analyze.ts';

const has_browser = Boolean(process.env.BROWSER_CHANNEL ?? process.env.CHROMIUM_PATH);

const text = (s: string) => new TextEncoder().encode(s);

const files = new Map<string, Uint8Array>([
  [
    'index.html',
    text(`<!DOCTYPE html>
<html lang="sk">
<head><meta charset="utf-8"><title>Test</title><link rel="stylesheet" href="style.css"></head>
<body>
  <main>
    <h1>Test</h1>
    <img src="obrazok.svg">
    <a href="druha.html">Druhá</a>
  </main>
  <script src="script.js"></script>
</body>
</html>`),
  ],
  [
    'druha.html',
    text(`<!DOCTYPE html>
<html lang="sk"><head><meta charset="utf-8"><title>Druhá</title></head>
<body><main><h1>Druhá</h1><p>Bez chýb.</p></main></body></html>`),
  ],
  ['style.css', text('body { font-family: sans-serif; }')],
  ['script.js', text('// komentár\nneexistujuca_funkcia();\n')],
  [
    'obrazok.svg',
    text(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    ),
  ],
]);

const parsed = parse_rubric(`
version: 1
id: test
title: Test
criteria:
  - id: pristupnost
    title: Prístupnosť
    points: 2
    rules:
      - type: axe.max_violations
      - type: lighthouse.min_score
        category: seo
        min: 0
  - id: konzola
    title: Konzola
    points: 1
    rules:
      - type: runtime.no_console_errors
`);
if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
const rubric: Rubric = parsed.rubric;

describe.skipIf(!has_browser)('analyze_runtime v prehliadači', () => {
  it('urobí screenshoty, nájde chyby a spustí Lighthouse', { timeout: 120_000 }, async () => {
    const result = await analyze_runtime(files, rubric);

    expect(result.screenshots.map((s) => s.width)).toEqual([375, 768, 1280]);
    for (const s of result.screenshots) expect(s.data.length).toBeGreaterThan(100);
    expect(result.lighthouse).not.toBeNull();

    const [axe, lh, console_rule] = result.rule_results;
    expect(axe).toMatchObject({ criterion_id: 'pristupnost', passed: false });
    expect(axe?.findings).toContainEqual(
      expect.objectContaining({ rule_id: 'image-alt', file: 'index.html', line: 7 }),
    );
    expect(lh).toMatchObject({ passed: true });
    expect(console_rule).toMatchObject({ criterion_id: 'konzola', passed: false });
    expect(console_rule?.findings).toContainEqual(
      expect.objectContaining({ file: 'script.js', line: 2 }),
    );
  });
});
