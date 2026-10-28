import { describe, expect, it } from 'vitest';
import { Report } from './report.ts';

const report = {
  version: 1,
  generated_at: '2026-10-28T08:00:00Z',
  repo_url: 'https://github.com/student/portfolio',
  rubric: { id: 'osobna-stranka', title: 'Osobná stránka' },
  points: 3,
  max_points: 5,
  summary: null,
  ai: null,
  criteria: [
    {
      id: 'layout',
      title: 'Layout',
      points: 3,
      max_points: 3,
      reasoning: 'Používa Grid.',
      findings: [],
    },
  ],
  lighthouse: null,
  findings: [],
};

describe('Report', () => {
  it('prijme report bez AI a bez Lighthouse', () => {
    expect(Report.safeParse(report).success).toBe(true);
  });

  it('odmietne neznámu verziu', () => {
    expect(Report.safeParse({ ...report, version: 2 }).success).toBe(false);
  });

  it('odmietne zlý čas', () => {
    expect(Report.safeParse({ ...report, generated_at: 'včera' }).success).toBe(false);
  });
});
