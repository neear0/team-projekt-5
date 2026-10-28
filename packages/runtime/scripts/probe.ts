// Spustí prototyp lokálne a vypíše namerané hodnoty.
// Prehliadač: BROWSER_CHANNEL=msedge|chrome, CHROMIUM_PATH=..., alebo `pnpm exec playwright-core install chromium`.
import { run_probe } from '../src/probe.ts';

console.log(JSON.stringify(await run_probe(), null, 2));
