import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { chromium as playwright, type Browser, type LaunchOptions } from 'playwright-core';

export interface LaunchedBrowser {
  browser: Browser;
  /** Port pre Chrome DevTools Protocol, cezň sa pripája Lighthouse. */
  debugging_port: number;
}

const is_serverless = process.env.VERCEL === '1' && process.platform === 'linux';

/**
 * Prepínače z `@sparticuz/chromium`, ktoré vynechávame:
 * - `--single-process`: Lighthouse sa zasekne pri otvorení vlastnej stránky (timeout 30 s).
 * - SwiftShader (emulácia GPU na CPU): na 1 vCPU kreslí `backdrop-filter`, `filter` a tiene
 *   mnohonásobne pomalšie než softvérové vykresľovanie (`--disable-gpu`).
 * - `--disable-web-security`, `--allow-running-insecure-content`: v prehliadači beží JS študenta,
 *   same-origin policy musí platiť.
 */
const DROPPED_ARGS = new Set([
  '--single-process',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--in-process-gpu',
  '--disable-web-security',
  '--allow-running-insecure-content',
]);

/** Prepínače pre Chromium na Verceli. */
export function serverless_args(chromium_args: readonly string[]): string[] {
  return [...chromium_args.filter((arg) => !DROPPED_ARGS.has(arg)), '--disable-gpu'];
}

/** Voľný port na 127.0.0.1. Vo Fluid compute môže bežať viac požiadaviek naraz, pevný port by kolidoval. */
async function free_port(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/**
 * Na Verceli spustí Chromium z `@sparticuz/chromium`.
 * Lokálne `CHROMIUM_PATH` (cesta k prehliadaču), `BROWSER_CHANNEL` (`chrome`, `msedge`)
 * alebo Chromium z `pnpm exec playwright-core install chromium`.
 */
export async function launch_browser(): Promise<LaunchedBrowser> {
  const debugging_port = await free_port();
  const args = [`--remote-debugging-port=${String(debugging_port)}`];
  let options: LaunchOptions;

  if (is_serverless) {
    const { default: chromium } = await import('@sparticuz/chromium');
    options = {
      args: [...serverless_args(chromium.args), ...args],
      executablePath: await chromium.executablePath(),
    };
  } else if (process.env.CHROMIUM_PATH) {
    options = { args, executablePath: process.env.CHROMIUM_PATH };
  } else if (process.env.BROWSER_CHANNEL) {
    options = { args, channel: process.env.BROWSER_CHANNEL };
  } else {
    options = { args };
  }

  return { browser: await playwright.launch(options), debugging_port };
}
