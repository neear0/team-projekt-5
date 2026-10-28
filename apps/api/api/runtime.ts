import { RuntimeRequest, type RuntimeResponse } from '@ooko/contracts';
import { post_handler } from '@ooko/http';

// Krok 2: runtime analýza. Zatiaľ vracia ukážkové dáta v správnom tvare.
export const POST = post_handler(RuntimeRequest, (): Promise<RuntimeResponse> => {
  return Promise.resolve({
    screenshots: [],
    lighthouse: { performance: 90, accessibility: 80, best_practices: 100, seo: 90 },
    findings: [
      {
        tool: 'ukazka',
        rule_id: 'image-alt',
        severity: 'error',
        message: 'Obrázok nemá alternatívny text.',
        file: 'index.html',
        line: 12,
        hint: 'Pridaj k <img> atribút alt s popisom obrázka.',
      },
    ],
  });
});
