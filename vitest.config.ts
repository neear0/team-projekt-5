import { defineConfig } from 'vitest/config';

// Balíky z workspace sa v testoch berú zo zdrojákov, nie z buildnutého dist/.
const conditions = ['source'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions, externalConditions: conditions } },
  test: {
    include: ['{apps,packages}/*/{src,api,test}/**/*.test.ts'],
  },
});
