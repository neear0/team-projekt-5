import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { max_points } from './rubric.ts';
import { parse_rubric } from './rubric_yaml.ts';

const rubrics_dir = new URL('../../../rubrics/', import.meta.url);

describe('parse_rubric', () => {
  it.each(readdirSync(rubrics_dir).filter((name) => name.endsWith('.yaml')))(
    'ukážková rubrika %s je platná',
    (name) => {
      const result = parse_rubric(readFileSync(new URL(name, rubrics_dir), 'utf8'));
      expect(result).toMatchObject({ success: true, rubric: { id: name.replace('.yaml', '') } });
      if (result.success) expect(max_points(result.rubric)).toBe(20);
    },
  );

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
