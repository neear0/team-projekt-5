import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse_rubric, type Rubric, type Rule, type RuleResult } from '@ooko/contracts';
import { describe, expect, it } from 'vitest';
import { analyze_static } from '../src/analyze.ts';

const fixture_dir = new URL('fixtures/webove-sidlo/', import.meta.url);
const rubrics_dir = new URL('../../../rubrics/', import.meta.url);

function load_fixture(): Map<string, Uint8Array> {
  const root = fixture_dir.pathname.replace(/^\/([A-Z]:)/, '$1');
  const files = new Map<string, Uint8Array>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.set(relative(root, path).split('\\').join('/'), readFileSync(path));
    }
  };
  walk(root);
  return files;
}

function load_rubric(name: string): Rubric {
  const result = parse_rubric(readFileSync(new URL(name, rubrics_dir), 'utf8'));
  if (!result.success) throw new Error(JSON.stringify(result.issues));
  return result.rubric;
}

const text = (s: string) => new TextEncoder().encode(s);
const read = (files: Map<string, Uint8Array>, path: string) =>
  new TextDecoder().decode(files.get(path));

/** W3C validátory bez siete: HTML s `<b>` bez konca a CSS s `colr` vráti ako chybu. */
const fake_fetch: typeof fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : input.toString();
  if (url.startsWith('https://validator.w3.org/')) {
    const html = typeof init?.body === 'string' ? init.body : '';
    const messages = html.includes('<b>chyba')
      ? [{ type: 'error', lastLine: 3, firstColumn: 1, message: 'Unclosed element “b”.' }]
      : [];
    return Promise.resolve(Response.json({ messages }));
  }
  if (url.startsWith('https://jigsaw.w3.org/')) {
    const css = (init?.body as FormData).get('text') as string;
    const errors = css.includes('colr')
      ? [{ line: 1, message: "Property “colr” doesn't exist :" }]
      : [];
    return Promise.resolve(Response.json({ cssvalidation: { errors, warnings: [] } }));
  }
  throw new Error(`neočakávaná požiadavka ${url}`);
};

async function run(files: Map<string, Uint8Array>, rubric = load_rubric('webove-sidlo.yaml')) {
  return analyze_static(files, rubric, { fetch: fake_fetch });
}

function result_of(results: RuleResult[], type: Rule['type']): RuleResult {
  const found = results.find((r) => r.rule.type === type);
  if (!found) throw new Error(`pravidlo ${type} nie je vo výsledku`);
  return found;
}

describe('analyze_static: webové sídlo', () => {
  it('správny web splní všetky statické pravidlá rubriky', async () => {
    const result = await run(load_fixture());
    const failed = result.rule_results.filter((r) => !r.passed);
    expect(failed.map((r) => `${r.criterion_id} ${r.rule.type}: ${r.message}`)).toEqual([]);
    expect(result.findings).toEqual([]);
    expect(result.files.map((f) => f.path)).toContain('style/style.css');
  });

  it('pravidlá kroku 2 nevyhodnocuje', async () => {
    const result = await run(load_fixture(), load_rubric('formular.yaml'));
    expect(result.rule_results.some((r) => r.rule.type.startsWith('axe.'))).toBe(false);
  });

  it('nájde mŕtvy odkaz a poradí pri veľkých písmenách', async () => {
    const files = load_fixture();
    files.set(
      'index.html',
      text(read(files, 'index.html').replace('images/logo.png', 'images/Logo.png')),
    );
    const broken = result_of((await run(files)).rule_results, 'html.no_broken_links');
    expect(broken.passed).toBe(false);
    expect(broken.findings[0]).toMatchObject({ file: 'index.html', line: 15 });
    expect(broken.findings[0]?.hint).toMatch(/images\/logo\.png/);
  });

  it('nájde kotvu bez cieľa', async () => {
    const files = load_fixture();
    files.set('index.html', text(read(files, 'index.html').replace('id="trasy"', 'id="cesty"')));
    const broken = result_of((await run(files)).rule_results, 'html.no_broken_links');
    expect(broken.findings[0]?.message).toMatch(/#trasy/);
  });

  it('stránka bez odkazu z menu je nedosiahnuteľná', async () => {
    const files = load_fixture();
    files.set('skryta.html', files.get('kontakty.html') as Uint8Array);
    const reachable = result_of((await run(files)).rule_results, 'site.pages_reachable');
    expect(reachable.passed).toBe(false);
    expect(reachable.findings.map((f) => f.file)).toEqual(['skryta.html']);
  });

  it('meta a favicon sa kontrolujú na každej stránke', async () => {
    const files = load_fixture();
    files.set(
      'tatry.html',
      text(
        read(files, 'tatry.html')
          .replace(/<meta name="author"[^>]*>/, '')
          .replace(/<link rel="icon"[^>]*>/, ''),
      ),
    );
    const results = (await run(files)).rule_results;
    expect(result_of(results, 'html.meta').findings).toMatchObject([
      { file: 'tatry.html', message: expect.stringMatching(/author/) as unknown },
    ]);
    expect(result_of(results, 'html.favicon').passed).toBe(false);
  });

  it('chýbajúci element a obrázková mapa', async () => {
    const files = load_fixture();
    files.set('index.html', text(read(files, 'index.html').replace(/<\/?mark>/g, '')));
    files.set('tatry.html', text(read(files, 'tatry.html').replace(' usemap="#mapa"', '')));
    const results = (await run(files)).rule_results;
    const tags = results.filter((r) => r.rule.type === 'html.uses_tags' && !r.passed);
    expect(tags.map((r) => r.message)).toEqual(['Na webe chýbajú elementy: <mark>.']);
    const map = results.find(
      (r) => r.rule.type === 'html.selector' && r.rule.selector === 'img[usemap]',
    );
    expect(map?.passed).toBe(false);
  });

  it('druhý CSS súbor a <style> porušia pravidlo jedného súboru', async () => {
    const files = load_fixture();
    files.set('style/extra.css', text('p { color: red; }'));
    files.set(
      'kontakty.html',
      text(
        read(files, 'kontakty.html').replace('</head>', '<style>p { margin: 0 }</style></head>'),
      ),
    );
    const single = result_of((await run(files)).rule_results, 'css.single_file');
    expect(single.passed).toBe(false);
    expect(single.findings.map((f) => f.file)).toEqual(['style/extra.css', 'kontakty.html']);
  });

  it('validátory: chyby sa rátajú, nedostupný validátor pravidlo preskočí', async () => {
    const files = load_fixture();
    files.set('galeria.html', text(read(files, 'galeria.html').replace('<h2>', '<b>chyba<h2>')));
    files.set('style/style.css', text(`body { colr: red; }\n${read(files, 'style/style.css')}`));
    const results = (await run(files)).rule_results;
    expect(result_of(results, 'html.valid')).toMatchObject({
      passed: false,
      findings: [{ file: 'galeria.html', line: 3 }],
    });
    expect(result_of(results, 'css.valid')).toMatchObject({
      passed: false,
      findings: [{ file: 'style/style.css' }],
    });

    const offline = await analyze_static(load_fixture(), load_rubric('webove-sidlo.yaml'), {
      fetch: () => Promise.reject(new Error('offline')),
    });
    expect(result_of(offline.rule_results, 'html.valid')).toMatchObject({
      passed: false,
      skipped: true,
    });
  });

  it('CSS pravidlá: druhy selektorov, vlastnosti a efekt na obrázku', async () => {
    const files = load_fixture();
    const css = read(files, 'style/style.css')
      .replace(/#menu/g, 'nav')
      .replace('img:hover', '.foto:hover');
    files.set('style/style.css', text(css));
    const results = (await run(files)).rule_results;
    expect(result_of(results, 'css.selector_kinds')).toMatchObject({
      passed: false,
      message: expect.stringMatching(/id/) as unknown,
    });
    const hover = results.find(
      (r) => r.rule.type === 'css.uses_properties' && r.rule.selector_includes,
    );
    expect(hover?.passed).toBe(false);
  });

  it('nečitateľné CSS nahlási s riadkom', async () => {
    const files = load_fixture();
    files.set('style/style.css', text('body {\n  color: red;\n'));
    const result = await run(files);
    expect(result.findings).toMatchObject([{ tool: 'postcss', file: 'style/style.css', line: 1 }]);
  });
});

describe('analyze_static: JavaScript', () => {
  const rubric = load_rubric('formular.yaml');

  it('var, inline udalosti a chyby ESLintu', async () => {
    const files = load_fixture();
    files.set(
      'script.js',
      text('var x = 1;\nif (x == 1) { x = x }\nfunction f() { return; x++; }\n'),
    );
    files.set('index.html', text(read(files, 'index.html').replace('<h1>', '<h1 onclick="f()">')));
    const results = (await run(files, rubric)).rule_results;
    expect(result_of(results, 'js.no_var')).toMatchObject({
      passed: false,
      findings: [{ file: 'script.js', line: 1 }],
    });
    expect(result_of(results, 'js.no_errors').findings.map((f) => f.rule_id)).toContain(
      'no-unreachable',
    );
    expect(result_of(results, 'js.no_inline_handlers')).toMatchObject({
      passed: false,
      findings: [{ file: 'index.html' }],
    });
  });

  it('modul s import sa dá prečítať', async () => {
    const files = load_fixture();
    files.set('script.js', text("import { a } from './a.js';\nconsole.log(a);\n"));
    const results = (await run(files, rubric)).rule_results;
    expect(result_of(results, 'js.no_errors').passed).toBe(true);
  });
});
