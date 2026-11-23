import type { Rule } from '@ooko/contracts';
import { describe, expect, it } from 'vitest';
import { entry_page } from './analyze.ts';
import { evaluate_runtime_rule, type AxeViolation, type RuntimeData } from './runtime_rules.ts';

const violation = (impact: AxeViolation['impact'], rule_id = 'image-alt'): AxeViolation => ({
  page: 'index.html',
  rule_id,
  impact,
  help: 'Images must have alternative text',
  help_url: 'https://dequeuniversity.com/rules/axe/4.14/image-alt',
  nodes: [{ target: 'img', html: '<img src="a.png">', line: 7 }],
});

const data = (overrides: Partial<RuntimeData> = {}): RuntimeData => ({
  audited_pages: ['index.html'],
  violations: [],
  console_errors: [],
  lighthouse: { performance: 95, accessibility: 80, best_practices: 100, seo: 90 },
  lighthouse_error: null,
  ...overrides,
});

const axe_rule = (min_impact: 'minor' | 'serious', max = 0): Rule => ({
  type: 'axe.max_violations',
  min_impact,
  max,
});

describe('axe.max_violations', () => {
  it('bez porušení prejde', () => {
    expect(evaluate_runtime_rule(axe_rule('serious'), data())).toMatchObject({ passed: true });
  });

  it('nepočíta porušenia pod zvolenou závažnosťou', () => {
    const result = evaluate_runtime_rule(
      axe_rule('serious'),
      data({ violations: [violation('moderate', 'heading-order')] }),
    );
    expect(result.passed).toBe(true);
  });

  it('porušenie vráti ako nález so slovenskou hláškou a riadkom', () => {
    const result = evaluate_runtime_rule(
      axe_rule('serious'),
      data({ violations: [violation('critical')] }),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('1 porušenie');
    expect(result.findings).toMatchObject([
      {
        tool: 'axe',
        rule_id: 'image-alt',
        severity: 'error',
        file: 'index.html',
        line: 7,
        message: expect.stringContaining('Obrázok nemá alternatívny text.') as string,
      },
    ]);
  });

  it('toleruje `max` porušení', () => {
    const result = evaluate_runtime_rule(
      axe_rule('minor', 1),
      data({ violations: [violation('minor')] }),
    );
    expect(result).toMatchObject({ passed: true, findings: [] });
  });

  it('bez stránok neprejde', () => {
    expect(evaluate_runtime_rule(axe_rule('serious'), data({ audited_pages: [] }))).toMatchObject({
      passed: false,
    });
  });
});

describe('lighthouse.min_score', () => {
  const rule: Rule = { type: 'lighthouse.min_score', category: 'accessibility', min: 90 };

  it('porovná skóre s minimom', () => {
    expect(evaluate_runtime_rule(rule, data())).toMatchObject({
      passed: false,
      findings: [{ tool: 'lighthouse', rule_id: 'lighthouse.min_score' }],
    });
    expect(evaluate_runtime_rule({ ...rule, min: 80 }, data())).toMatchObject({ passed: true });
  });

  it('keď Lighthouse nedobehol, pravidlo sa preskočí', () => {
    const result = evaluate_runtime_rule(
      rule,
      data({ lighthouse: null, lighthouse_error: 'timeout' }),
    );
    expect(result).toMatchObject({ passed: false, skipped: true });
    expect(result.message).toContain('timeout');
  });
});

describe('runtime.no_console_errors', () => {
  const rule: Rule = { type: 'runtime.no_console_errors' };

  it('chyby v konzole sú nálezy', () => {
    const result = evaluate_runtime_rule(
      rule,
      data({
        console_errors: [
          { page: 'index.html', message: 'x is not defined', file: 'script.js', line: 3 },
          { page: 'index.html', message: 'Nezachytená chyba: y' },
        ],
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toBe('V konzole sú 2 chyby.');
    expect(result.findings.map((f) => [f.file, f.line])).toEqual([
      ['script.js', 3],
      ['index.html', undefined],
    ]);
  });

  it('prázdna konzola prejde', () => {
    expect(evaluate_runtime_rule(rule, data())).toMatchObject({ passed: true });
  });
});

describe('entry_page', () => {
  it.each([
    [['a.html', 'index.html'], 'index.html'],
    [['web/index.html', 'b.html'], 'b.html'],
    [['web/x.html', 'web/a.html'], 'web/a.html'],
    [[], null],
  ])('%j → %s', (paths, expected) => {
    expect(entry_page(paths)).toBe(expected);
  });
});
