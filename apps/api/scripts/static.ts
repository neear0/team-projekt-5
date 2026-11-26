// Poskladá statické súbory pre Vercel do static/: public/ (prihlásenie, robots.txt)
// a zostavené UI z apps/web/build. Spúšťa sa na konci `pnpm run build` v apps/api.
import { cpSync, existsSync, rmSync } from 'node:fs';

const out = new URL('../static/', import.meta.url);
const web = new URL('../../web/build/', import.meta.url);

rmSync(out, { recursive: true, force: true });
cpSync(new URL('../public/', import.meta.url), out, { recursive: true });
if (!existsSync(web)) throw new Error('Chýba apps/web/build, spusti najprv build UI.');
cpSync(web, out, { recursive: true });
console.log('Statické súbory sú v apps/api/static/');
