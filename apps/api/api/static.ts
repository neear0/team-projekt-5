import { StaticRequest, type StaticResponse } from '@ooko/contracts';
import { post_handler } from '@ooko/http';
import { stub_rule_results } from '../lib/stub.ts';

// Krok 1: statická analýza. Zatiaľ vracia ukážkové dáta v správnom tvare.
export const POST = post_handler(StaticRequest, ({ rubric }): Promise<StaticResponse> => {
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
    rule_results: stub_rule_results(rubric, 'static'),
  });
});
