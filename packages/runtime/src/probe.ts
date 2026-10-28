// Prototyp etapy 1: overí, či Chromium, axe-core a Lighthouse pobežia vo Vercel Function,
// a zmeria, ako dlho trvajú. Po rozhodnutí sa nahradí skutočným krokom 2.
import { freemem, totalmem } from 'node:os';
import { AxeBuilder } from '@axe-core/playwright';
import type { LighthouseScores } from '@ooko/contracts';
import lighthouse from 'lighthouse';
import { launch_browser } from './browser.ts';
import { serve_files } from './static_server.ts';

const TEST_PAGE = `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ooko: testovacia stránka</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header><h1>Testovacia stránka</h1></header>
  <main>
    <p class="slaby-kontrast">Text so slabým kontrastom.</p>
    <img src="obrazok.svg" width="200" height="100">
    <form><input type="text" name="meno"><button>Odoslať</button></form>
    <section class="mriezka">${'<div>Blok</div>'.repeat(6)}</section>
  </main>
</body>
</html>`;

const TEST_CSS = `body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 960px; padding: 16px; }
.slaby-kontrast { color: #bbb; background: #fff; }
.mriezka { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.mriezka div { background: #dde; height: 300px; }`;

const TEST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#89a"/></svg>`;

export const SCREENSHOT_WIDTHS = [375, 768, 1440] as const;
const MAX_SCREENSHOT_HEIGHT = 3000;

export interface ProbeResult {
  cold_start: boolean;
  serverless: boolean;
  browser_version: string;
  timings_ms: {
    launch: number;
    screenshots: number;
    axe: number;
    lighthouse: number;
    total: number;
  };
  screenshots: { width: number; height: number; bytes: number }[];
  axe: { violations: number; rules: string[] };
  lighthouse: { scores: LighthouseScores } | { error: string };
  memory: { total_mb: number; min_free_mb: number; node_rss_mb: number };
}

let invocations = 0;

function mb(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}

function score(value: number | null | undefined): number {
  return Math.round((value ?? 0) * 100);
}

export async function run_probe(): Promise<ProbeResult> {
  const cold_start = invocations++ === 0;
  const started = performance.now();
  let min_free = freemem();
  const lap = (() => {
    let last = started;
    return () => {
      min_free = Math.min(min_free, freemem());
      const now = performance.now();
      const ms = Math.round(now - last);
      last = now;
      return ms;
    };
  })();

  const site = await serve_files(
    new Map([
      ['index.html', TEST_PAGE],
      ['style.css', TEST_CSS],
      ['obrazok.svg', TEST_SVG],
    ]),
  );

  const { browser, debugging_port } = await launch_browser();
  try {
    const launch = lap();

    const context = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await context.newPage();
    const screenshots: ProbeResult['screenshots'] = [];
    for (const width of SCREENSHOT_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(site.url, { waitUntil: 'load', timeout: 15_000 });
      // Výraz beží v prehliadači, ako reťazec nepotrebuje DOM typy.
      const full_height = await page.evaluate<number>('document.documentElement.scrollHeight');
      const height = Math.min(full_height, MAX_SCREENSHOT_HEIGHT);
      const image = await page.screenshot({
        type: 'jpeg',
        quality: 70,
        fullPage: true,
        clip: { x: 0, y: 0, width, height },
      });
      screenshots.push({ width, height, bytes: image.byteLength });
    }
    const screenshots_ms = lap();

    const axe_result = await new AxeBuilder({ page }).analyze();
    const axe_ms = lap();
    await context.close();

    let lighthouse_result: ProbeResult['lighthouse'];
    try {
      const run = await lighthouse(site.url, {
        port: debugging_port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      });
      const categories = run?.lhr.categories;
      if (!categories) throw new Error('Lighthouse nevrátil výsledok.');
      lighthouse_result = {
        scores: {
          performance: score(categories.performance?.score),
          accessibility: score(categories.accessibility?.score),
          best_practices: score(categories['best-practices']?.score),
          seo: score(categories.seo?.score),
        },
      };
    } catch (err) {
      lighthouse_result = { error: err instanceof Error ? err.message : String(err) };
    }
    const lighthouse_ms = lap();

    return {
      cold_start,
      serverless: process.env.VERCEL === '1',
      browser_version: browser.version(),
      timings_ms: {
        launch,
        screenshots: screenshots_ms,
        axe: axe_ms,
        lighthouse: lighthouse_ms,
        total: Math.round(performance.now() - started),
      },
      screenshots,
      axe: {
        violations: axe_result.violations.length,
        rules: axe_result.violations.map((v) => v.id),
      },
      lighthouse: lighthouse_result,
      memory: {
        total_mb: mb(totalmem()),
        min_free_mb: mb(min_free),
        node_rss_mb: mb(process.memoryUsage().rss),
      },
    };
  } finally {
    await browser.close();
    await site.close();
  }
}
