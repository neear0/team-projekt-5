import { AiRequest, type AiResponse } from '@ooko/contracts';
import { post_handler } from '@ooko/http';

// Krok 3: AI hodnotenie. Zatiaľ AI nevolá: body za pravidlá počíta z výsledkov krokov 1 a 2,
// kritériá iba pre AI dostanú 0 bodov.
export const POST = post_handler(AiRequest, (req): Promise<AiResponse> => {
  const rule_results = [...req.static.rule_results, ...req.runtime.rule_results];

  return Promise.resolve({
    summary: 'Ukážkové hodnotenie, AI zatiaľ nie je zapojená.',
    criteria: req.rubric.criteria.map((criterion) => {
      const results = rule_results.filter((r) => r.criterion_id === criterion.id);
      const passed = results.filter((r) => r.passed).length;
      return {
        id: criterion.id,
        title: criterion.title,
        points: results.length > 0 ? (criterion.points * passed) / results.length : 0,
        max_points: criterion.points,
        reasoning:
          results.length > 0
            ? `Splnené pravidlá: ${String(passed)} z ${String(results.length)}.`
            : 'Kritérium hodnotí AI, tá zatiaľ nie je zapojená.',
        findings: results.flatMap((r) => r.findings),
      };
    }),
  });
});
