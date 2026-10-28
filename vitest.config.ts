import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['source'],
  },
  test: {
    include: ['{apps,packages}/*/{src,api,test}/**/*.test.ts'],
  },
});
