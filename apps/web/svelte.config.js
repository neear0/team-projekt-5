import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // UI sú statické stránky, všetka logika beží v prehliadači a volá /api. Build ich pribalí
    // do Vercel projektu apps/api (scripts/static.ts), takže UI aj API sú na jednej adrese
    // za tým istým prihlásením (middleware.ts) a netreba CORS.
    adapter: adapter({ pages: 'build', assets: 'build', strict: true }),
  },
};

export default config;
