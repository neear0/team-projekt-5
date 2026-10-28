import { AiRequest, type AiResponse } from '@ooko/contracts';
import { postHandler } from '@ooko/http';

// Krok 3: AI hodnotenie. Zatiaľ vracia ukážkové dáta v správnom tvare.
export const POST = postHandler(AiRequest, ({ static: staticResult }): Promise<AiResponse> => {
  return Promise.resolve({
    summary: 'Ukážkové hodnotenie, AI zatiaľ nie je zapojená.',
    criteria: [
      {
        id: 'html-validita',
        title: 'Validný HTML5 kód',
        points: 3,
        maxPoints: 5,
        reasoning: 'Validátor našiel chyby, ktoré treba opraviť.',
        findings: staticResult.findings,
      },
    ],
  });
});
