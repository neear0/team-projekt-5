// Krok 2: otvorí web študenta v Chromiu, urobí screenshoty, skontroluje prístupnosť cez axe-core,
// zbiera chyby z konzoly a spustí Lighthouse. Potom vyhodnotí pravidlá rubriky pre tento krok.
import { AxeBuilder } from '@axe-core/playwright';
import { element_line, load_site, type Page as SitePage } from '@ooko/analyzer';
import {
  rule_step,
  type Finding,
  type LighthouseScores,
  type Rubric,
  type RuleResult,
  type RuntimeResponse,
  type Screenshot,
} from '@ooko/contracts';
import { selectAll } from 'css-select';
import type { AnyNode, Element } from 'domhandler';
import lighthouse from 'lighthouse';
import type { BrowserContext, Page } from 'playwright-core';
import { launch_browser } from './browser.ts';
import {
  axe_findings,
  console_findings,
  evaluate_runtime_rule,
  type AxeViolation,
  type ConsoleError,
  type RuntimeData,
} from './runtime_rules.ts';
import { resolve_path, serve_files } from './static_server.ts';

export const SCREENSHOT_WIDTHS = [375, 768, 1280] as const;
const MAX_SCREENSHOT_HEIGHT = 2400;
/** Screenshoty idú aj do kroku AI, ktorý má na telo požiadavky limit 4,5 MB. */
const MAX_SCREENSHOT_BYTES = 350_000;
/** axe a konzola sa kontrolujú najviac na toľkých stránkach, Lighthouse iba na úvodnej. */
const MAX_AUDITED_PAGES = 10;
const NAVIGATION_TIMEOUT_MS = 15_000;
/** Na jednu operáciu so stránkou (axe, screenshot). Zacyklený skript študenta inak zasekne krok. */
const PAGE_TIMEOUT_MS = 20_000;
/** Po tomto čase sa ďalšie stránky už nekontrolujú, aby zostal čas na Lighthouse. */
const AUDIT_BUDGET_MS = 120_000;
const MAX_FINDINGS = 200;
const MAX_CONSOLE_ERRORS = 50;

async function with_timeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${what} trvalo dlhšie ako ${String(Math.round(ms / 1000))} s.`));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function message_of(err: unknown): string {
  return err instanceof Error ? (err.message.split('\n')[0] ?? err.message) : String(err);
}

function info(rule_id: string, message: string, file?: string): Finding {
  return {
    tool: 'chromium',
    rule_id,
    severity: 'warning',
    message,
    ...(file !== undefined && { file }),
  };
}

/** Úvodná stránka: `index.html` v koreni, inak stránka najbližšie ku koreňu. */
export function entry_page(paths: readonly string[]): string | null {
  if (paths.includes('index.html')) return 'index.html';
  const depth = (p: string) => p.split('/').length;
  return [...paths].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b))[0] ?? null;
}

/** Meranie trvania fáz kroku 2, zapisuje sa do logu funkcie (Vercel → Logs). */
export type Timings = Record<string, number>;

function stopwatch(timings: Timings): (name: string) => void {
  let last = performance.now();
  return (name) => {
    const now = performance.now();
    timings[name] = Math.round(now - last);
    last = now;
  };
}

function page_url(base: string, path: string): string {
  return new URL(path.split('/').map(encodeURIComponent).join('/'), base).href;
}

/** Riadok v zdrojáku pre prvok, ktorý axe označil selektorom. */
function locate(page: SitePage | undefined, target: unknown[]): number | undefined {
  const selector = target[0];
  if (!page || target.length !== 1 || typeof selector !== 'string') return undefined;
  try {
    const el = selectAll<AnyNode, Element>(selector, page.dom)[0];
    return el ? element_line(page, el) : undefined;
  } catch {
    return undefined;
  }
}

async function take_screenshot(page: Page, url: string, width: number): Promise<Screenshot> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS });
  // Výraz beží v prehliadači, ako reťazec nepotrebuje DOM typy.
  const full_height = await with_timeout(
    page.evaluate<number>('document.fonts.ready.then(() => document.documentElement.scrollHeight)'),
    PAGE_TIMEOUT_MS,
    'Načítanie stránky',
  );
  const clip = {
    x: 0,
    y: 0,
    width,
    height: Math.max(1, Math.min(full_height, MAX_SCREENSHOT_HEIGHT)),
  };
  let image: Buffer | undefined;
  for (const quality of [60, 35]) {
    image = await page.screenshot({
      type: 'jpeg',
      quality,
      fullPage: true,
      clip,
      timeout: PAGE_TIMEOUT_MS,
    });
    if (image.byteLength <= MAX_SCREENSHOT_BYTES) break;
  }
  return { width, mime_type: 'image/jpeg', data: (image ?? Buffer.alloc(0)).toString('base64') };
}

interface AuditResult {
  audited_pages: string[];
  violations: AxeViolation[];
  console_errors: ConsoleError[];
  findings: Finding[];
}

async function audit_pages(
  context: BrowserContext,
  base_url: string,
  paths: readonly string[],
  site_pages: ReadonlyMap<string, SitePage>,
  repo_paths: ReadonlySet<string>,
  timings: Timings,
): Promise<AuditResult> {
  const result: AuditResult = {
    audited_pages: [],
    violations: [],
    console_errors: [],
    findings: [],
  };
  const started = performance.now();

  /** Cesta v repozitári pre URL z nášho servera, inak `null` (externý zdroj). */
  const repo_path = (url: string): string | null =>
    url.startsWith(base_url) ? resolve_path(new URL(url).pathname) : null;

  for (const path of paths) {
    if (performance.now() - started > AUDIT_BUDGET_MS) {
      result.findings.push(
        info(
          'runtime.time_limit',
          `Stránky od ${path} ďalej sa pre nedostatok času nekontrolovali.`,
        ),
      );
      break;
    }

    const lap = stopwatch(timings);
    const page = await context.newPage();
    const push_error = (error: Omit<ConsoleError, 'page'>) => {
      if (result.console_errors.length < MAX_CONSOLE_ERRORS)
        result.console_errors.push({ page: path, ...error });
    };
    /** Chyba so súborom a riadkom (od 1), ak pochádza zo súboru v repozitári. */
    const push_located = (message: string, url: string, line: number, column: number) => {
      const source = url ? repo_path(url) : null;
      if (source !== null && repo_paths.has(source)) {
        push_error({
          message,
          file: source,
          ...(line >= 1 && { line }),
          ...(column >= 1 && { column }),
        });
      } else {
        push_error({ message });
      }
    };
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const location = msg.location();
      let message = msg.text();
      if (message.startsWith('Failed to load resource') && location.url) {
        message += ` (${repo_path(location.url) ?? location.url})`;
      }
      push_located(message, location.url, location.lineNumber + 1, location.columnNumber + 1);
    });
    page.on('pageerror', (err) => {
      // Prvý riadok stacku z nášho servera, napr. `at http://127.0.0.1:1234/script.js:2:1`.
      const frame = (err.stack ?? '')
        .split('\n')
        .map((l) => /(https?:\/\/\S+?):(\d+):(\d+)\)?$/.exec(l.trim()))
        .find((m) => m?.[1]?.startsWith(base_url));
      push_located(
        `Nezachytená chyba: ${message_of(err)}`,
        frame?.[1] ?? '',
        Number(frame?.[2] ?? 0),
        Number(frame?.[3] ?? 0),
      );
    });

    try {
      try {
        await page.goto(page_url(base_url, path), {
          waitUntil: 'load',
          timeout: NAVIGATION_TIMEOUT_MS,
        });
        lap(`load ${path}`);
      } catch (err) {
        lap(`load ${path}`);
        // Stránka sa mohla čiastočne načítať (napr. visí externý zdroj), axe ju aj tak skúsi.
        result.findings.push(
          info('runtime.load', `Stránka ${path} sa nenačítala celá: ${message_of(err)}`, path),
        );
      }
      const axe = await with_timeout(
        new AxeBuilder({ page }).analyze(),
        PAGE_TIMEOUT_MS,
        'Kontrola prístupnosti',
      );
      lap(`axe ${path}`);
      result.audited_pages.push(path);
      for (const v of axe.violations) {
        // Prvky vo vnorených rámoch (PDF, YouTube, mapa) nie sú kód študenta.
        const nodes = v.nodes.filter((node) => node.target.length === 1);
        if (nodes.length === 0) continue;
        result.violations.push({
          page: path,
          rule_id: v.id,
          impact: v.impact ?? 'minor',
          help: v.help,
          help_url: v.helpUrl,
          nodes: nodes.map((node) => {
            const line = locate(site_pages.get(path), node.target);
            return {
              target: String(node.target[0]),
              html: node.html,
              ...(line !== undefined && { line }),
            };
          }),
        });
      }
    } catch (err) {
      result.findings.push(
        info(
          'runtime.audit',
          `Stránku ${path} sa nepodarilo skontrolovať: ${message_of(err)}`,
          path,
        ),
      );
    } finally {
      // Zaseknutá stránka (nekonečný cyklus v skripte) sa nemusí zavrieť, nečakáme na ňu.
      await with_timeout(page.close({ runBeforeUnload: false }), 5_000, 'Zatvorenie stránky').catch(
        () => undefined,
      );
    }
  }
  return result;
}

function score(value: number | null | undefined): number {
  return Math.round((value ?? 0) * 100);
}

async function run_lighthouse(
  url: string,
  port: number,
): Promise<{ scores: LighthouseScores | null; error: string | null }> {
  try {
    const run = await lighthouse(url, {
      port,
      output: 'json',
      logLevel: 'error',
      maxWaitForLoad: 30_000,
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });
    const categories = run?.lhr.categories;
    if (!categories) throw new Error('Lighthouse nevrátil výsledok.');
    const runtime_error = run.lhr.runtimeError;
    if (runtime_error) throw new Error(runtime_error.message);
    return {
      scores: {
        performance: score(categories.performance?.score),
        accessibility: score(categories.accessibility?.score),
        best_practices: score(categories['best-practices']?.score),
        seo: score(categories.seo?.score),
      },
      error: null,
    };
  } catch (err) {
    return { scores: null, error: message_of(err) };
  }
}

/** Krok 2: runtime analýza súborov repozitára podľa rubriky. */
export async function analyze_runtime(
  repo_files: ReadonlyMap<string, Uint8Array>,
  rubric: Rubric,
): Promise<RuntimeResponse> {
  const site = load_site(repo_files);
  const page_paths = site.pages.map((p) => p.path);
  const entry = entry_page(page_paths);

  const rules = rubric.criteria.flatMap((criterion) =>
    criterion.rules
      .filter((rule) => rule_step(rule) === 'runtime')
      .map((rule) => ({ criterion, rule })),
  );

  let data: RuntimeData = {
    audited_pages: [],
    violations: [],
    console_errors: [],
    lighthouse: null,
    lighthouse_error: 'V repozitári nie je žiadna HTML stránka.',
  };
  const screenshots: Screenshot[] = [];
  const findings: Finding[] = [];

  const timings: Timings = {};
  const started = performance.now();
  const lap = stopwatch(timings);

  if (entry !== null) {
    const audited = [entry, ...page_paths.filter((p) => p !== entry)].slice(0, MAX_AUDITED_PAGES);
    if (page_paths.length > audited.length) {
      findings.push(
        info(
          'runtime.page_limit',
          `Prehliadač skontroloval prvých ${String(audited.length)} stránok z ${String(page_paths.length)}.`,
        ),
      );
    }

    const served = await serve_files(repo_files);
    const { browser, debugging_port } = await launch_browser();
    lap('launch');
    try {
      const entry_url = page_url(served.url, entry);
      const context = await browser.newContext({ deviceScaleFactor: 1 });
      context.setDefaultTimeout(PAGE_TIMEOUT_MS);

      const shot_page = await context.newPage();
      try {
        for (const width of SCREENSHOT_WIDTHS) {
          screenshots.push(await take_screenshot(shot_page, entry_url, width));
          lap(`screenshot ${String(width)}`);
        }
      } catch (err) {
        findings.push(
          info('runtime.screenshot', `Screenshot sa nepodarilo urobiť: ${message_of(err)}`, entry),
        );
      } finally {
        await with_timeout(
          shot_page.close({ runBeforeUnload: false }),
          5_000,
          'Zatvorenie stránky',
        ).catch(() => undefined);
      }

      const audit = await audit_pages(
        context,
        served.url,
        audited,
        new Map(site.pages.map((p) => [p.path, p])),
        site.paths,
        timings,
      );
      lap('audit');
      await with_timeout(context.close(), 5_000, 'Zatvorenie prehliadača').catch(() => undefined);

      const lh = await run_lighthouse(entry_url, debugging_port);
      lap('lighthouse');
      if (lh.error !== null) {
        findings.push(info('lighthouse.error', `Lighthouse nedobehol: ${lh.error}`, entry));
      }

      findings.push(...audit.findings);
      data = {
        audited_pages: audit.audited_pages,
        violations: audit.violations,
        console_errors: audit.console_errors,
        lighthouse: lh.scores,
        lighthouse_error: lh.error,
      };
    } finally {
      await browser.close().catch(() => undefined);
      await served.close();
    }
  }

  timings.total = Math.round(performance.now() - started);
  console.info(
    JSON.stringify({ step: 'runtime', pages: data.audited_pages.length, timings_ms: timings }),
  );

  findings.push(...axe_findings(data.violations), ...console_findings(data.console_errors));

  const rule_results: RuleResult[] = rules.map(({ criterion, rule }) => ({
    criterion_id: criterion.id,
    rule,
    ...evaluate_runtime_rule(rule, data),
  }));

  return {
    screenshots,
    lighthouse: data.lighthouse,
    findings: findings.slice(0, MAX_FINDINGS),
    rule_results,
  };
}
