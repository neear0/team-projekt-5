import { AiRequest, type AiResponse } from '@ooko/contracts';
import { post_handler } from '@ooko/http';

// Krok 3: AI hodnotenie. Zatiaľ vracia ukážkové dáta v správnom tvare.
export const POST = post_handler(AiRequest, ({ static: static_result }): Promise<AiResponse> => {
  return Promise.resolve({
    summary: 'Ukážkové hodnotenie, AI zatiaľ nie je zapojená.',
    criteria: [
      {
        id: 'html-validita',
        title: 'Validný HTML5 kód',
        points: 3,
        max_points: 5,
        reasoning: 'Validátor našiel chyby, ktoré treba opraviť.',
        findings: static_result.findings,
      },
    ],
  });
});
