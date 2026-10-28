import { StaticRequest, type StaticResponse } from '@ooko/contracts';
import { post_handler } from '@ooko/http';

// Krok 1: statická analýza. Zatiaľ vracia ukážkové dáta v správnom tvare.
export const POST = post_handler(StaticRequest, (): Promise<StaticResponse> => {
  return Promise.resolve({
    files: [{ path: 'index.html', content: '<!DOCTYPE html>\n<html lang="sk">\n</html>\n' }],
    findings: [
      {
        tool: 'ukazka',
        rule_id: 'html.missing-title',
        severity: 'error',
        message: 'Stránka nemá element <title>.',
        file: 'index.html',
        line: 2,
        hint: 'Doplň do <head> element <title> s názvom stránky.',
      },
    ],
  });
});
