import { describe, expect, it } from 'vitest';
import { max_points, Rubric, rule_step } from './rubric.ts';

const rubric = {
  version: 1,
  id: 'osobna-stranka',
  title: 'Osobná stránka',
  criteria: [
    {
      id: 'layout',
      title: 'Layout',
      points: 3,
      rules: [{ type: 'css.uses_layout', any_of: ['flex', 'grid'] }],
    },
    { id: 'vizual', title: 'Vizuál', points: 2, ai: 'Posúď čitateľnosť a kontrast.' },
  ],
};

describe('Rubric', () => {
  it('doplní predvolené hodnoty pravidiel', () => {
    const parsed = Rubric.parse({
      ...rubric,
      criteria: [{ id: 'html', title: 'HTML', points: 1, rules: [{ type: 'html.valid' }] }],
    });
    expect(parsed.criteria[0]?.rules).toEqual([{ type: 'html.valid', max_errors: 0 }]);
  });

  it('spočíta body', () => {
    expect(max_points(Rubric.parse(rubric))).toBe(5);
  });

  it('kritérium bez pravidiel aj bez AI neprejde', () => {
    const result = Rubric.safeParse({
      ...rubric,
      criteria: [{ id: 'prazdne', title: 'Prázdne', points: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('odmietne rovnaké id kritérií', () => {
    const result = Rubric.safeParse({
      ...rubric,
      criteria: [rubric.criteria[0], rubric.criteria[0]],
    });
    expect(result.success).toBe(false);
  });

  it('odmietne neznáme pravidlo', () => {
    const result = Rubric.safeParse({
      ...rubric,
      criteria: [{ id: 'x', title: 'X', points: 1, rules: [{ type: 'css.uses_tables' }] }],
    });
    expect(result.success).toBe(false);
  });

  it('doplní scope podľa pravidla', () => {
    const parsed = Rubric.parse({
      ...rubric,
      criteria: [
        {
          id: 'html',
          title: 'HTML',
          points: 1,
          rules: [
            { type: 'html.meta', names: ['description'] },
            { type: 'html.uses_tags', tags: ['q'] },
          ],
        },
      ],
    });
    expect(parsed.criteria[0]?.rules).toEqual([
      { type: 'html.meta', names: ['description'], scope: 'each_page' },
      { type: 'html.uses_tags', tags: ['q'], scope: 'site' },
    ]);
  });

  it('odmietne neznámy scope', () => {
    const result = Rubric.safeParse({
      ...rubric,
      criteria: [
        { id: 'x', title: 'X', points: 1, rules: [{ type: 'html.favicon', scope: 'all' }] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('odmietne neplatnú CSS vlastnosť', () => {
    const result = Rubric.safeParse({
      ...rubric,
      criteria: [
        {
          id: 'x',
          title: 'X',
          points: 1,
          rules: [{ type: 'css.uses_properties', properties: ['Margin Top'] }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('nové pravidlá sa vyhodnocujú v statickom kroku', () => {
    expect(rule_step({ type: 'site.pages_reachable', start: 'index.html' })).toBe('static');
    expect(rule_step({ type: 'css.valid', max_errors: 0 })).toBe('static');
  });

  it('odmietne preklep v názve poľa', () => {
    const result = Rubric.safeParse({
      ...rubric,
      criteria: [{ id: 'x', title: 'X', points: 1, rules: [{ type: 'html.valid', max_error: 3 }] }],
    });
    expect(result.success).toBe(false);
  });
});
