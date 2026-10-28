import { rule_step, type Rubric, type RuleResult } from '@ooko/contracts';

/** Výsledky pravidiel, kým ich nástroje nevyhodnocujú naozaj. */
export function stub_rule_results(rubric: Rubric, step: 'static' | 'runtime'): RuleResult[] {
  return rubric.criteria.flatMap((criterion) =>
    criterion.rules
      .filter((rule) => rule_step(rule) === step)
      .map((rule) => ({
        criterion_id: criterion.id,
        rule,
        passed: true,
        message: 'Ukážka, pravidlo sa zatiaľ nevyhodnocuje.',
        findings: [],
      })),
  );
}
