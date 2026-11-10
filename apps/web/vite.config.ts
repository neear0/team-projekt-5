import { sveltekit } from '@sveltejs/kit/vite';
import { defaultClientConditions, defineConfig } from 'vite';

// Balíky z packages/ sa čítajú zo zdrojákov (podmienka "source"), bez buildu po každej zmene.
// API zatiaľ nemá CORS, preto proxy na lokálny server z `pnpm --filter @ooko/api dev`.
export default defineConfig({
  plugins: [sveltekit()],
  resolve: { conditions: ['source', ...defaultClientConditions] },
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
