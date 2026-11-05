import { compile, selectAll } from 'css-select';
import type { AnyNode, Element } from 'domhandler';
import { textContent } from 'domutils';
import type { Linter } from 'eslint';
import selector_parser from 'postcss-selector-parser';
import type { Finding, Rule, RuleResult, Severity } from '@ooko/contracts';
import { case_mismatch, element_line, resolve_link, type Page, type Site } from './site.ts';
import type { ValidationResult } from './validators.ts';

/** Viac nálezov na jedno pravidlo študent aj tak nečíta a zbytočne to zväčšuje odpoveď. */
const MAX_FINDINGS = 30;

export interface LintMessage extends Linter.LintMessage {
  file: string;
}

/** Výsledky nástrojov, ktoré sa spúšťajú raz pre celý web. */
export interface RuleContext {
  site: Site;
  /** Kľúč je cesta k stránke. Chýba, ak rubrika validáciu nepotrebuje. */
  html_validation?: ReadonlyMap<string, ValidationResult>;
  css_validation?: ReadonlyMap<string, ValidationResult>;
  lint?: readonly LintMessage[];
}

type Outcome = Omit<RuleResult, 'criterion_id' | 'rule'>;

function outcome(passed: boolean, message: string, findings: Finding[] = []): Outcome {
  return { passed, message, findings: findings.slice(0, MAX_FINDINGS) };
}

function skipped(message: string): Outcome {
  return { passed: false, skipped: true, message, findings: [] };
}

function finding(
  rule: Rule,
  message: string,
  where: { file?: string; line?: number } = {},
  hint?: string,
  severity: Severity = 'error',
): Finding {
  return {
    tool: 'ooko',
    rule_id: rule.type,
    severity,
    message,
    ...(where.file !== undefined && { file: where.file }),
    ...(where.line !== undefined && { line: where.line }),
    ...(hint !== undefined && { hint }),
  };
}

function at(page: Page, el: Element): { file: string; line: number } {
  return { file: page.path, line: element_line(page, el) };
}

function select(page: Page, selector: string): Element[] {
  return selectAll<AnyNode, Element>(selector, page.dom);
}

function list(items: Iterable<string>): string {
  return [...items].join(', ');
}

const NO_PAGES = outcome(false, 'V repozitári nie je žiadna HTML stránka.');

/**
 * Pravidlo, ktoré sa kontroluje na každej stránke zvlášť. `each_page` = musí platiť všade,
 * `site` = stačí, ak platí aspoň na jednej stránke.
 */
function per_page(
  site: Site,
  scope: 'site' | 'each_page',
  check: (page: Page) => Finding[],
  ok: string,
  fail: (bad_pages: number) => string,
): Outcome {
  if (site.pages.length === 0) return NO_PAGES;
  const problems = site.pages.map((page) => check(page));
  const bad = problems.filter((p) => p.length > 0).length;
  const passed = scope === 'each_page' ? bad === 0 : bad < site.pages.length;
  return outcome(passed, passed ? ok : fail(bad), passed ? [] : problems.flat());
}

// HTML

function check_head(rule: Rule, page: Page): Finding[] {
  const problems: string[] = [];
  if (!/<!doctype\s+html\s*>/i.test(page.source.slice(0, 2000))) problems.push('<!DOCTYPE html>');
  for (const tag of ['html', 'head', 'body'])
    if (select(page, tag).length === 0) problems.push(`<${tag}>`);
  if (select(page, 'meta[charset], meta[http-equiv="content-type" i]').length === 0) {
    problems.push('<meta charset="utf-8">');
  }
  const title = select(page, 'head title, title')[0];
  if (!title || textContent(title).trim() === '') problems.push('neprázdny <title>');
  if (problems.length === 0) return [];
  return [
    finding(
      rule,
      `Stránke chýba: ${list(problems)}.`,
      { file: page.path, line: 1 },
      'Začni stránku kostrou <!DOCTYPE html>, <html lang="sk">, <head> s <meta charset="utf-8"> a <title>, potom <body>.',
    ),
  ];
}

function check_meta(rule: Rule & { type: 'html.meta' }, page: Page): Finding[] {
  const missing = rule.names.filter((name) =>
    select(page, `meta[name="${name}" i]`).every((el) => (el.attribs.content ?? '').trim() === ''),
  );
  if (missing.length === 0) return [];
  return [
    finding(
      rule,
      `Chýbajú meta informácie: ${list(missing)}.`,
      { file: page.path, line: 1 },
      `Doplň do <head> napr. <meta name="${missing[0] ?? 'description'}" content="…">.`,
    ),
  ];
}

function check_favicon(rule: Rule, site: Site, page: Page): Finding[] {
  const icons = select(page, 'link[rel]').filter((el) =>
    (el.attribs.rel ?? '').toLowerCase().split(/\s+/).includes('icon'),
  );
  if (icons.length === 0) {
    return [
      finding(
        rule,
        'Stránka nemá favicon.',
        { file: page.path, line: 1 },
        'Doplň do <head> <link rel="icon" href="images/favicon.ico">.',
      ),
    ];
  }
  for (const el of icons) {
    const target = resolve_link(page.path, el.attribs.href ?? '');
    if (target?.kind === 'external' || (target?.kind === 'local' && site.paths.has(target.path)))
      return [];
  }
  const href = icons[0]?.attribs.href ?? '';
  return [
    finding(
      rule,
      `Súbor faviconu „${href}“ neexistuje.`,
      at(page, icons[0] as Element),
      'Skontroluj cestu a veľké/malé písmená v názve súboru.',
    ),
  ];
}

function heading_levels(page: Page): Set<number> {
  const levels = new Set<number>();
  for (const el of select(page, 'h1, h2, h3, h4, h5, h6')) levels.add(Number(el.name.slice(1)));
  return levels;
}

const ENTITY = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi;

function count_entities(page: Page): number {
  const without_code = page.source.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');
  return without_code.match(ENTITY)?.length ?? 0;
}

const NOT_LABELLED_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

function has_label(page: Page, el: Element): boolean {
  if (el.attribs['aria-label']?.trim() || el.attribs['aria-labelledby']?.trim()) return true;
  for (let p = el.parent; p; p = p.parent) if ('name' in p && p.name === 'label') return true;
  const id = el.attribs.id;
  return id !== undefined && select(page, 'label[for]').some((l) => l.attribs.for === id);
}

const LINK_ATTRIBUTES: [string, string][] = [
  ['a[href]', 'href'],
  ['area[href]', 'href'],
  ['link[href]', 'href'],
  ['img[src]', 'src'],
  ['script[src]', 'src'],
  ['source[src]', 'src'],
  ['audio[src]', 'src'],
  ['video[src]', 'src'],
  ['video[poster]', 'poster'],
  ['iframe[src]', 'src'],
  ['track[src]', 'src'],
];

function has_anchor(page: Page, fragment: string): boolean {
  if (fragment === '' || fragment.toLowerCase() === 'top') return true;
  return select(page, '[id], a[name]').some(
    (el) => el.attribs.id === fragment || el.attribs.name === fragment,
  );
}

function broken_links(rule: Rule, site: Site): Finding[] {
  const pages = new Map(site.pages.map((p) => [p.path, p]));
  const problems: Finding[] = [];
  for (const page of site.pages) {
    for (const [selector, attribute] of LINK_ATTRIBUTES) {
      for (const el of select(page, selector)) {
        const value = el.attribs[attribute] ?? '';
        const target = resolve_link(page.path, value);
        if (!target || target.kind === 'external') continue;
        if (target.kind === 'fragment') {
          if (!has_anchor(page, target.fragment)) {
            problems.push(
              finding(
                rule,
                `Kotva „${value}“ nemá cieľ, na stránke nie je id="${target.fragment}".`,
                at(page, el),
                'Pridaj id k elementu, na ktorý má odkaz skočiť.',
              ),
            );
          }
          continue;
        }
        if (!site.paths.has(target.path)) {
          const other = case_mismatch(site.paths, target.path);
          problems.push(
            finding(
              rule,
              `Odkaz „${value}“ vedie na neexistujúci súbor ${target.path}.`,
              at(page, el),
              other
                ? `Súbor sa volá ${other}. GitHub Pages rozlišuje veľké a malé písmená.`
                : 'Skontroluj názov súboru a priečinok, cesta sa počíta od aktuálnej stránky.',
            ),
          );
          continue;
        }
        const target_page = pages.get(target.path);
        if (target.fragment && target_page && !has_anchor(target_page, target.fragment)) {
          problems.push(
            finding(
              rule,
              `Kotva „${value}“ nemá cieľ, na stránke ${target.path} nie je id="${target.fragment}".`,
              at(page, el),
            ),
          );
        }
      }
    }
  }
  return problems;
}

function unreachable_pages(rule: Rule & { type: 'site.pages_reachable' }, site: Site): Outcome {
  const pages = new Map(site.pages.map((p) => [p.path, p]));
  if (!pages.has(rule.start)) return outcome(false, `Chýba úvodná stránka ${rule.start}.`);
  const seen = new Set([rule.start]);
  const queue = [rule.start];
  while (queue.length > 0) {
    const page = pages.get(queue.shift() as string);
    if (!page) continue;
    for (const el of select(page, 'a[href], area[href]')) {
      const target = resolve_link(page.path, el.attribs.href ?? '');
      if (target?.kind !== 'local' || seen.has(target.path) || !pages.has(target.path)) continue;
      seen.add(target.path);
      queue.push(target.path);
    }
  }
  const missing = [...pages.keys()].filter((p) => !seen.has(p));
  return outcome(
    missing.length === 0,
    missing.length === 0
      ? `Na všetky stránky (${String(pages.size)}) sa dá prekliknúť z ${rule.start}.`
      : `Na ${String(missing.length)} z ${String(pages.size)} stránok sa nedá prekliknúť z ${rule.start}.`,
    missing.map((p) =>
      finding(
        rule,
        `Na stránku ${p} nevedie žiadny odkaz z navigácie.`,
        { file: p },
        'Pridaj odkaz na stránku do menu (<nav>) na úvodnej stránke.',
      ),
    ),
  );
}

// CSS

const VENDOR = /^-(webkit|moz|ms|o)-/;

function external_styles(site: Site) {
  return site.styles.filter((s) => !s.inline);
}

function in_keyframes(node: { parent?: unknown }): boolean {
  for (
    let p = node.parent as { type?: string; name?: string; parent?: unknown } | undefined;
    p;
    p = p.parent as typeof p
  ) {
    if (p.type === 'atrule' && p.name?.toLowerCase().endsWith('keyframes')) return true;
  }
  return false;
}

type SelectorKind =
  'type' | 'class' | 'id' | 'attribute' | 'pseudo_class' | 'pseudo_element' | 'universal';
const KIND_NAMES: Record<SelectorKind, string> = {
  type: 'element (napr. p)',
  class: 'trieda (.trieda)',
  id: 'id (#id)',
  attribute: 'atribút ([type=text])',
  pseudo_class: 'pseudotrieda (:hover)',
  pseudo_element: 'pseudoelement (::before)',
  universal: 'univerzálny (*)',
};
const LEGACY_PSEUDO_ELEMENTS = new Set([':before', ':after', ':first-line', ':first-letter']);

function selector_kinds(site: Site): Set<SelectorKind> {
  const kinds = new Set<SelectorKind>();
  const processor = selector_parser((selectors) => {
    selectors.walk((node) => {
      if (node.type === 'tag') kinds.add('type');
      else if (node.type === 'class') kinds.add('class');
      else if (node.type === 'id') kinds.add('id');
      else if (node.type === 'attribute') kinds.add('attribute');
      else if (node.type === 'universal') kinds.add('universal');
      else if (node.type === 'pseudo') {
        const value = node.value.toLowerCase();
        kinds.add(
          value.startsWith('::') || LEGACY_PSEUDO_ELEMENTS.has(value)
            ? 'pseudo_element'
            : 'pseudo_class',
        );
      }
    });
  });
  for (const style of site.styles) {
    style.root?.walkRules((rule) => {
      if (in_keyframes(rule)) return;
      try {
        processor.processSync(rule.selector);
      } catch {
        // Neplatný selektor nahlási validátor.
      }
    });
  }
  return kinds;
}

function property_matches(prop: string, wanted: string): boolean {
  const p = prop.toLowerCase().replace(VENDOR, '');
  return p === wanted || p.startsWith(`${wanted}-`);
}

function used_properties(
  site: Site,
  selector_includes: readonly string[] | undefined,
): Set<string> {
  const props = new Set<string>();
  for (const style of site.styles) {
    style.root?.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) return;
      if (selector_includes) {
        const parent = decl.parent as { type?: string; selector?: string } | undefined;
        const selector = parent?.type === 'rule' ? (parent.selector ?? '').toLowerCase() : '';
        if (!selector_includes.every((s) => selector.includes(s.toLowerCase()))) return;
      }
      props.add(decl.prop.toLowerCase());
    });
  }
  return props;
}

function linked_styles(page: Page): string[] {
  return select(page, 'link[rel][href]')
    .filter((el) => (el.attribs.rel ?? '').toLowerCase().split(/\s+/).includes('stylesheet'))
    .map((el) => resolve_link(page.path, el.attribs.href ?? ''))
    .flatMap((t) => (t?.kind === 'local' ? [t.path] : []));
}

function validation_outcome(
  rule: Rule & { max_errors: number },
  results: ReadonlyMap<string, ValidationResult> | undefined,
  what: string,
): Outcome {
  if (!results || results.size === 0) return outcome(false, `Web nemá žiadny ${what} súbor.`);
  if ([...results.values()].some((r) => r === null)) {
    return skipped(
      'Validátor W3C teraz neodpovedá, pravidlo sa nevyhodnotilo. Skús analýzu zopakovať.',
    );
  }
  const errors = [...results.values()].flatMap((r) => r?.errors ?? []);
  const passed = errors.length <= rule.max_errors;
  const files = count(results.size, 'súbor', 'súbory', 'súborov');
  const tolerance = rule.max_errors > 0 ? `, tolerancia je ${String(rule.max_errors)}` : '';
  return outcome(
    passed,
    errors.length === 0
      ? `Validátor nenašiel chyby (${files}).`
      : `Validátor našiel ${count(errors.length, 'chybu', 'chyby', 'chýb')} (${files})${tolerance}.`,
    passed ? [] : errors,
  );
}

/** Číslo so správnym tvarom slova: 1 chybu, 2 chyby, 5 chýb. */
export function count(n: number, one: string, few: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
}

// JS

function lint_findings(rule: Rule, messages: readonly LintMessage[]): Finding[] {
  return messages.map((m) => ({
    tool: 'eslint',
    rule_id: m.ruleId ?? 'js.syntax',
    severity: m.severity === 2 ? 'error' : 'warning',
    message: m.message,
    file: m.file,
    ...(m.line > 0 && { line: m.line }),
    ...(m.column > 0 && { column: m.column }),
    ...(rule.type === 'js.no_var' && { hint: 'Použi const, a let iba ak sa hodnota mení.' }),
  }));
}

/** Vyhodnotí jedno statické pravidlo rubriky. Pravidlá kroku 2 (axe, lighthouse, runtime) sem nepatria. */
export function evaluate_rule(rule: Rule, ctx: RuleContext): Outcome {
  const { site } = ctx;
  switch (rule.type) {
    case 'file.exists': {
      const path = rule.path.replace(/^\.?\/+/, '');
      if (site.paths.has(path)) return outcome(true, `Súbor ${path} existuje.`);
      const other = case_mismatch(site.paths, path);
      return outcome(false, `V repozitári chýba súbor ${path}.`, [
        finding(
          rule,
          `Chýba súbor ${path}.`,
          {},
          other
            ? `Súbor sa volá ${other}. GitHub Pages rozlišuje veľké a malé písmená.`
            : undefined,
        ),
      ]);
    }

    case 'site.min_pages': {
      const count = site.pages.length;
      return outcome(
        count >= rule.min,
        `Web má ${String(count)} HTML stránok, treba aspoň ${String(rule.min)}.`,
      );
    }

    case 'site.pages_reachable':
      return unreachable_pages(rule, site);

    case 'html.valid':
      return validation_outcome(rule, ctx.html_validation, 'HTML');

    case 'html.head':
      return per_page(
        site,
        rule.scope,
        (p) => check_head(rule, p),
        'Stránky majú správnu kostru, kódovanie a title.',
        (n) => `Kostra, kódovanie alebo title chýba na ${String(n)} stránkach.`,
      );

    case 'html.meta':
      return per_page(
        site,
        rule.scope,
        (p) => check_meta(rule, p),
        `Meta informácie (${list(rule.names)}) sú vyplnené.`,
        (n) => `Meta informácie chýbajú na ${String(n)} stránkach.`,
      );

    case 'html.favicon':
      return per_page(
        site,
        rule.scope,
        (p) => check_favicon(rule, site, p),
        'Favicon je nastavený.',
        (n) => `Favicon chýba na ${String(n)} stránkach.`,
      );

    case 'html.heading_levels': {
      if (site.pages.length === 0) return NO_PAGES;
      if (rule.scope === 'site') {
        const levels = new Set(site.pages.flatMap((p) => [...heading_levels(p)]));
        const used = [...levels].sort().map((l) => `h${String(l)}`);
        return outcome(
          levels.size >= rule.min,
          `Nadpisy sú použité v ${String(levels.size)} úrovniach (${list(used) || 'žiadne'}), treba aspoň ${String(rule.min)}.`,
        );
      }
      return per_page(
        site,
        'each_page',
        (p) =>
          heading_levels(p).size >= rule.min
            ? []
            : [
                finding(
                  rule,
                  `Stránka má nadpisy iba v ${String(heading_levels(p).size)} úrovniach.`,
                  { file: p.path },
                ),
              ],
        `Každá stránka má nadpisy aspoň v ${String(rule.min)} úrovniach.`,
        (n) => `Málo úrovní nadpisov na ${String(n)} stránkach.`,
      );
    }

    case 'html.entities': {
      if (site.pages.length === 0) return NO_PAGES;
      if (rule.scope === 'site') {
        const total = site.pages.reduce((sum, p) => sum + count_entities(p), 0);
        return outcome(
          total >= rule.min,
          `Web obsahuje ${String(total)} špeciálnych symbolov zapísaných entitou, treba aspoň ${String(rule.min)}.`,
          total >= rule.min
            ? []
            : [
                finding(
                  rule,
                  'Na webe nie sú špeciálne symboly zapísané entitou.',
                  {},
                  'Použi napr. &copy; v pätičke alebo &euro;, &rarr;, &hearts;.',
                ),
              ],
        );
      }
      return per_page(
        site,
        'each_page',
        (p) =>
          count_entities(p) >= rule.min
            ? []
            : [finding(rule, 'Stránka nemá špeciálne symboly zapísané entitou.', { file: p.path })],
        'Každá stránka obsahuje špeciálne symboly.',
        (n) => `Špeciálne symboly chýbajú na ${String(n)} stránkach.`,
      );
    }

    case 'html.label_for_inputs':
      return per_page(
        site,
        'each_page',
        (p) =>
          select(p, 'input, select, textarea')
            .filter(
              (el) =>
                !(
                  el.name === 'input' &&
                  NOT_LABELLED_TYPES.has((el.attribs.type ?? 'text').toLowerCase())
                ),
            )
            .filter((el) => !has_label(p, el))
            .map((el) =>
              finding(
                rule,
                `Pole <${el.name}${el.attribs.name ? ` name="${el.attribs.name}"` : ''}> nemá <label>.`,
                at(p, el),
                'Pridaj <label for="id-pola"> a poľu rovnaké id.',
              ),
            ),
        'Každé pole formulára má <label>.',
        (n) => `Polia bez <label> sú na ${String(n)} stránkach.`,
      );

    case 'html.uses_tags': {
      if (site.pages.length === 0) return NO_PAGES;
      if (rule.scope === 'site') {
        const used = new Set(
          site.pages.flatMap((p) => rule.tags.filter((t) => select(p, t).length > 0)),
        );
        const missing = rule.tags.filter((t) => !used.has(t));
        return outcome(
          missing.length === 0,
          missing.length === 0
            ? `Web používa všetky elementy (${list(rule.tags)}).`
            : `Na webe chýbajú elementy: ${list(missing.map((t) => `<${t}>`))}.`,
          missing.map((t) => finding(rule, `Na žiadnej stránke nie je element <${t}>.`)),
        );
      }
      return per_page(
        site,
        'each_page',
        (p) => {
          const missing = rule.tags.filter((t) => select(p, t).length === 0);
          return missing.length === 0
            ? []
            : [
                finding(rule, `Stránke chýbajú elementy: ${list(missing.map((t) => `<${t}>`))}.`, {
                  file: p.path,
                }),
              ];
        },
        `Každá stránka používa elementy ${list(rule.tags)}.`,
        (n) => `Elementy chýbajú na ${String(n)} stránkach.`,
      );
    }

    case 'html.selector': {
      if (site.pages.length === 0) return NO_PAGES;
      try {
        compile(rule.selector);
      } catch {
        return skipped(`Selektor „${rule.selector}“ v rubrike je neplatný, oprav rubriku.`);
      }
      const what = rule.label ?? `selektor ${rule.selector}`;
      const counts = site.pages.map((p) => ({ page: p, count: select(p, rule.selector).length }));
      if (rule.scope === 'site') {
        const total = counts.reduce((sum, c) => sum + c.count, 0);
        return outcome(
          total >= rule.min,
          `${what}: nájdené ${String(total)}×, treba aspoň ${String(rule.min)}×.`,
          total >= rule.min ? [] : [finding(rule, `Na webe chýba: ${what}.`)],
        );
      }
      const bad = counts.filter((c) => c.count < rule.min);
      return outcome(
        bad.length === 0,
        bad.length === 0
          ? `${what}: je na každej stránke.`
          : `${what}: chýba na ${String(bad.length)} stránkach.`,
        bad.map((c) =>
          finding(
            rule,
            `Na stránke chýba: ${what} (${String(c.count)}×, treba ${String(rule.min)}×).`,
            { file: c.page.path },
          ),
        ),
      );
    }

    case 'html.img_alt': {
      if (site.pages.length === 0) return NO_PAGES;
      const problems = site.pages.flatMap((p) =>
        select(p, 'img:not([alt])').map((el) =>
          finding(
            rule,
            `Obrázok ${el.attribs.src ?? ''} nemá atribút alt.`,
            at(p, el),
            'Doplň alt s popisom obrázka, pri čisto dekoratívnom alt="".',
          ),
        ),
      );
      return outcome(
        problems.length === 0,
        problems.length === 0
          ? 'Všetky obrázky majú alt.'
          : `${String(problems.length)} obrázkov nemá alt.`,
        problems,
      );
    }

    case 'html.no_broken_links': {
      if (site.pages.length === 0) return NO_PAGES;
      const problems = broken_links(rule, site);
      return outcome(
        problems.length === 0,
        problems.length === 0
          ? 'Všetky odkazy a cesty k súborom fungujú.'
          : `${String(problems.length)} odkazov alebo ciest vedie nikam.`,
        problems,
      );
    }

    case 'css.valid':
      return validation_outcome(rule, ctx.css_validation, 'CSS');

    case 'css.single_file': {
      const path = rule.path.replace(/^\.?\/+/, '');
      const problems: Finding[] = [];
      const files = external_styles(site).map((s) => s.path);
      if (!files.includes(path))
        problems.push(
          finding(
            rule,
            `Chýba súbor ${path}.`,
            {},
            case_mismatch(site.paths, path)
              ? `Súbor sa volá ${String(case_mismatch(site.paths, path))}.`
              : undefined,
          ),
        );
      for (const other of files.filter((f) => f !== path))
        problems.push(
          finding(rule, `Navyše CSS súbor ${other}, všetko CSS má byť v ${path}.`, { file: other }),
        );
      for (const page of site.pages) {
        if (!linked_styles(page).includes(path))
          problems.push(
            finding(
              rule,
              `Stránka nepripája ${path}.`,
              { file: page.path },
              `Doplň do <head> <link rel="stylesheet" href="…${path}">, cesta sa počíta od stránky.`,
            ),
          );
        for (const el of select(page, 'style'))
          problems.push(finding(rule, 'CSS v <style> má byť presunuté do súboru.', at(page, el)));
      }
      return outcome(
        problems.length === 0,
        problems.length === 0
          ? `Všetko CSS je v ${path} a pripájajú ho všetky stránky.`
          : `CSS nie je iba v ${path}.`,
        problems,
      );
    }

    case 'css.comments': {
      let count = 0;
      for (const style of site.styles)
        style.root?.walkComments(() => {
          count++;
        });
      return outcome(
        count >= rule.min,
        `CSS má ${String(count)} komentárov, treba aspoň ${String(rule.min)}.`,
        count >= rule.min
          ? []
          : [
              finding(
                rule,
                'CSS má málo komentárov.',
                {},
                'Nad každú časť (hlavička, menu, obsah, pätička) napíš komentár /* … */.',
              ),
            ],
      );
    }

    case 'css.selector_kinds': {
      const kinds = selector_kinds(site);
      const missing = rule.kinds.filter((k) => !kinds.has(k));
      return outcome(
        missing.length === 0,
        missing.length === 0
          ? 'CSS používa všetky požadované druhy selektorov.'
          : `V CSS chýbajú selektory: ${list(missing.map((k) => KIND_NAMES[k]))}.`,
        missing.map((k) => finding(rule, `V CSS nie je selektor typu ${KIND_NAMES[k]}.`)),
      );
    }

    case 'css.uses_properties': {
      const props = used_properties(site, rule.selector_includes);
      const found = rule.properties.filter((w) => [...props].some((p) => property_matches(p, w)));
      const passed =
        rule.match === 'all' ? found.length === rule.properties.length : found.length > 0;
      const where = rule.selector_includes
        ? ` v pravidlách so selektorom obsahujúcim ${list(rule.selector_includes)}`
        : '';
      const missing = rule.properties.filter((w) => !found.includes(w));
      return outcome(
        passed,
        passed
          ? `CSS používa ${list(found)}${where}.`
          : rule.match === 'all'
            ? `V CSS chýbajú vlastnosti${where}: ${list(missing)}.`
            : `CSS nepoužíva${where} ani jednu z vlastností ${list(rule.properties)}.`,
        passed
          ? []
          : [
              finding(
                rule,
                rule.match === 'all'
                  ? `Chýbajú vlastnosti${where}: ${list(missing)}.`
                  : `Chýba niektorá z vlastností${where}: ${list(rule.properties)}.`,
              ),
            ],
      );
    }

    case 'css.uses_layout': {
      const values = new Set<string>();
      for (const style of site.styles)
        style.root?.walkDecls(/^display$/i, (d) => void values.add(d.value.trim().toLowerCase()));
      const found = rule.any_of.filter((k) => values.has(k) || values.has(`inline-${k}`));
      return outcome(
        found.length > 0,
        found.length > 0
          ? `Layout používa ${list(found)}.`
          : `Layout nepoužíva ${rule.any_of.join(' ani ')}.`,
        found.length > 0
          ? []
          : [
              finding(
                rule,
                'V CSS nie je display: flex ani display: grid.',
                {},
                'Rozlož stránku cez Flexbox alebo Grid namiesto float a position.',
              ),
            ],
      );
    }

    case 'css.media_queries': {
      let count = 0;
      for (const style of site.styles)
        style.root?.walkAtRules(/^media$/i, () => {
          count++;
        });
      return outcome(
        count >= rule.min,
        `CSS má ${String(count)} media queries, treba aspoň ${String(rule.min)}.`,
      );
    }

    case 'css.custom_properties': {
      let defined = 0;
      let used = 0;
      for (const style of site.styles) {
        style.root?.walkDecls((d) => {
          if (d.prop.startsWith('--')) defined++;
          if (d.value.includes('var(--')) used++;
        });
      }
      const passed = defined > 0 && used > 0;
      return outcome(
        passed,
        passed
          ? `CSS definuje ${String(defined)} premenných a používa ich ${String(used)}×.`
          : 'CSS nedefinuje alebo nepoužíva vlastné premenné (--farba, var(--farba)).',
      );
    }

    case 'css.no_inline_styles': {
      const problems = site.pages.flatMap((p) =>
        select(p, '[style]').map((el) =>
          finding(
            rule,
            `Element <${el.name}> má atribút style.`,
            at(p, el),
            'Presuň štýl do CSS súboru a elementu daj triedu.',
          ),
        ),
      );
      return outcome(
        problems.length === 0,
        problems.length === 0
          ? 'HTML nemá atribúty style.'
          : `${String(problems.length)} elementov má atribút style.`,
        problems,
      );
    }

    case 'js.no_inline_handlers': {
      const problems = site.pages.flatMap((p) =>
        select(p, '*').flatMap((el) =>
          Object.keys(el.attribs)
            .filter((a) => /^on[a-z]+$/i.test(a))
            .map((a) =>
              finding(
                rule,
                `Element <${el.name}> má ${a} v HTML.`,
                at(p, el),
                `V skripte použi element.addEventListener('${a.slice(2).toLowerCase()}', …).`,
              ),
            ),
        ),
      );
      return outcome(
        problems.length === 0,
        problems.length === 0
          ? 'Udalosti sa pripájajú v skripte.'
          : `${String(problems.length)} udalostí je zapísaných priamo v HTML.`,
        problems,
      );
    }

    case 'js.no_var': {
      if (site.scripts.length === 0) return outcome(true, 'Web nemá JavaScript.');
      const messages = (ctx.lint ?? []).filter((m) => m.ruleId === 'no-var');
      return outcome(
        messages.length === 0,
        messages.length === 0
          ? 'Premenné sú cez let a const.'
          : `${String(messages.length)}× použité var.`,
        lint_findings(rule, messages),
      );
    }

    case 'js.no_errors': {
      if (site.scripts.length === 0) return outcome(true, 'Web nemá JavaScript.');
      const messages = (ctx.lint ?? []).filter((m) => m.severity === 2 && m.ruleId !== 'no-var');
      return outcome(
        messages.length === 0,
        messages.length === 0
          ? 'ESLint nenašiel chyby.'
          : `ESLint našiel ${count(messages.length, 'chybu', 'chyby', 'chýb')}.`,
        lint_findings(rule, messages),
      );
    }

    case 'axe.max_violations':
    case 'lighthouse.min_score':
    case 'runtime.no_console_errors':
      return skipped('Pravidlo vyhodnocuje krok 2 (prehliadač).');

    default:
      rule satisfies never;
      return skipped('Neznáme pravidlo.');
  }
}
