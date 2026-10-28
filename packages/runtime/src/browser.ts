import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { chromium as playwright, type Browser, type LaunchOptions } from 'playwright-core';

export interface LaunchedBrowser {
  browser: Browser;
  /** Port pre Chrome DevTools Protocol, cezň sa pripája Lighthouse. */
  debugging_port: number;
}

const is_serverless = process.env.VERCEL === '1' && process.platform === 'linux';

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
      args: [...chromium.args, ...args],
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
