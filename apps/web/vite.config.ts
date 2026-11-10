import { sveltekit } from '@sveltejs/kit/vite';
import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite';

// Balíky z packages/ sa čítajú zo zdrojákov (podmienka "source"), bez buildu po každej zmene.
// SvelteKit stránky renderuje aj na serveri (SSR), preto treba podmienku "source" pridať
// aj do ssr.resolve.conditions, nestačí len resolve.conditions pre klienta.
// API zatiaľ nemá CORS, preto proxy na lokálny server z `pnpm --filter @ooko/api dev`.
export default defineConfig({
  plugins: [sveltekit()],
  resolve: { conditions: ['source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
