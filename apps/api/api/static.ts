import { StaticRequest, type StaticResponse } from '@ooko/contracts';
import { postHandler } from '@ooko/http';

// Krok 1: statická analýza. Zatiaľ vracia ukážkové dáta v správnom tvare.
export const POST = postHandler(StaticRequest, (): Promise<StaticResponse> => {
  return Promise.resolve({
    files: [{ path: 'index.html', content: '<!DOCTYPE html>\n<html lang="sk">\n</html>\n' }],
    findings: [
      {
        tool: 'ukazka',
        ruleId: 'html.missing-title',
        severity: 'error',
        message: 'Stránka nemá element <title>.',
        file: 'index.html',
        line: 2,
        hint: 'Doplň do <head> element <title> s názvom stránky.',
      },
    ],
  });
});
