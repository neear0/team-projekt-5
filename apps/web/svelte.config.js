import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Rovnaký región a runtime ako Vercel Functions v apps/api, pozri README bod 6.
    // adapter-vercel ešte nevie odvodiť Node 24 z lokálnej verzie, treba ho uviesť explicitne.
    adapter: adapter({ regions: ['fra1'], runtime: 'nodejs24.x' }),
  },
};

export default config;
