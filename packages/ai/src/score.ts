// Body za kritériá z výsledkov pravidiel a (voliteľne) z hodnotenia AI.
// Merateľné veci určujú nástroje, AI má v kritériu s pravidlami iba jeden diel.
import type { CriterionResult, Finding, Rubric, RuleResult } from '@ooko/contracts';

/** Hodnotenie jedného kritéria od AI. */
export interface AiCriterionScore {
  /** Ako veľmi je kritérium splnené, 0–100. */
  percent: number;
  reasoning: string;
  findings: Finding[];
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Kritérium má diel za každé overené pravidlo a jeden diel za pokyn pre AI, ak AI beží.
 * Preskočené pravidlá (nedostupný validátor …) sa nerátajú, body za ne študent nestratí.
 * `ai = null`: AI nebeží, kritériá iba pre AI majú 0 bodov.
 * Kritérium, ktoré AI vo výsledku vynechala, má jej diel rovnako ako bez AI.
 */
export function score_criteria(
  rubric: Rubric,
  rule_results: readonly RuleResult[],
  ai: ReadonlyMap<string, AiCriterionScore> | null,
): CriterionResult[] {
  return rubric.criteria.map((criterion) => {
    const results = rule_results.filter((r) => r.criterion_id === criterion.id);
    const checked = results.filter((r) => !r.skipped);
    const passed = checked.filter((r) => r.passed).length;
    const ai_score = criterion.ai !== undefined ? ai?.get(criterion.id) : undefined;

    const shares = checked.length + (ai_score ? 1 : 0);
    const earned = passed + (ai_score ? Math.min(Math.max(ai_score.percent, 0), 100) / 100 : 0);

    const reasons: string[] = [];
    if (results.length > 0) {
      const skipped = results.length - checked.length;
      reasons.push(
        `Splnené pravidlá: ${String(passed)} z ${String(checked.length)}.` +
          (skipped > 0 ? ` Nedalo sa overiť: ${String(skipped)}.` : ''),
      );
    }
    if (ai_score) reasons.push(ai_score.reasoning);
    else if (criterion.ai !== undefined && checked.length === 0) {
      reasons.push(
        ai === null
          ? 'Kritérium hodnotí AI, tá nie je zapnutá.'
          : 'AI toto kritérium nevyhodnotila.',
      );
    }

    let points: number;
    if (shares > 0) points = (criterion.points * earned) / shares;
    // Všetky pravidlá preskočené a AI nehodnotí: nič sa nedalo overiť, body sa nestrhávajú.
    else if (results.length > 0) points = criterion.points;
    else points = 0;

    return {
      id: criterion.id,
      title: criterion.title,
      ...(criterion.group !== undefined && { group: criterion.group }),
      points: round(points),
      max_points: criterion.points,
      reasoning: reasons.join(' '),
      findings: [...results.flatMap((r) => r.findings), ...(ai_score?.findings ?? [])],
    };
  });
}
