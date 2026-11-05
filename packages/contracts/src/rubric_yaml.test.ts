import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { max_points } from './rubric.ts';
import { parse_rubric } from './rubric_yaml.ts';

const rubrics_dir = new URL('../../../rubrics/', import.meta.url);

/** Koľko bodov má mať každá ukážková rubrika. */
const expected_points: Record<string, number> = {
  'formular.yaml': 20,
  'osobna-stranka.yaml': 20,
  'webove-sidlo.yaml': 100,
};

function load(name: string) {
  const result = parse_rubric(readFileSync(new URL(name, rubrics_dir), 'utf8'));
  if (!result.success) throw new Error(JSON.stringify(result.issues));
  return result.rubric;
}

describe('parse_rubric', () => {
  it.each(readdirSync(rubrics_dir).filter((name) => name.endsWith('.yaml')))(
    'ukážková rubrika %s je platná',
    (name) => {
      const rubric = load(name);
      expect(rubric.id).toBe(name.replace('.yaml', ''));
      expect(max_points(rubric)).toBe(expected_points[name]);
    },
  );

  it('webové sídlo má dve časti po 50 bodov', () => {
    const totals = new Map<string | undefined, number>();
    for (const c of load('webove-sidlo.yaml').criteria) {
      totals.set(c.group, (totals.get(c.group) ?? 0) + c.points);
    }
    expect(Object.fromEntries(totals)).toEqual({ '1. časť: HTML5': 50, '2. časť: CSS3': 50 });
  });

  it('chybu syntaxe vráti s riadkom', () => {
    const result = parse_rubric('version: 1\ncriteria:\n  - id: [\n');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]?.line).toBeGreaterThan(1);
  });

  it('chybu v obsahu vráti s cestou k poľu', () => {
    const result = parse_rubric(
      'version: 1\nid: x\ntitle: X\ncriteria:\n  - id: a\n    title: A\n    points: -1\n    ai: A\n',
    );
    expect(result).toMatchObject({ success: false, issues: [{ path: 'criteria.0.points' }] });
  });
});
