// Krok 3: AI hodnotenie kritérií s pokynom pre AI a celkové zhodnotenie.
import type { AiRequest, AiResponse, Finding } from '@ooko/contracts';
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from 'ai';
import { to_ai_error } from './errors.ts';
import { build_prompt, INSTRUCTIONS } from './prompt.ts';
import { create_model, model_name } from './providers.ts';
import { AiOutput } from './schema.ts';
import { score_criteria, type AiCriterionScore } from './score.ts';

/** Funkcia má 300 s, zvyšok je rezerva na odpoveď. */
const TIMEOUT_MS = 240_000;
const MAX_FINDINGS_PER_CRITERION = 15;
const MAX_TEXT = 1_000;

export interface EvaluateOptions {
  /** Namiesto modelu z `req.ai`, napr. v testoch. */
  model?: LanguageModel;
  timeout_ms?: number;
}

const text = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s).trim();

/** Súbor a riadok od modelu platia iba vtedy, keď v repozitári naozaj sú. */
function location(
  file_lines: ReadonlyMap<string, number>,
  file: string | null,
  line: number | null,
): { file?: string; line?: number } {
  if (file === null) return {};
  const path = file.replace(/^\.?\//, '');
  const lines = file_lines.get(path);
  if (lines === undefined) return {};
  const ok = line !== null && Number.isInteger(line) && line >= 1 && line <= lines;
  return { file: path, ...(ok && { line }) };
}

function to_result(
  output: AiOutput,
  ai_ids: ReadonlySet<string>,
  file_lines: ReadonlyMap<string, number>,
): { summary: string; scores: Map<string, AiCriterionScore>; findings: Finding[] } {
  const scores = new Map<string, AiCriterionScore>();
  for (const c of output.criteria) {
    if (!ai_ids.has(c.id) || scores.has(c.id)) continue;
    const percent = Number.isFinite(c.percent)
      ? Math.round(Math.min(Math.max(c.percent, 0), 100))
      : 0;
    scores.set(c.id, {
      percent,
      reasoning: text(c.reasoning),
      findings: c.findings.slice(0, MAX_FINDINGS_PER_CRITERION).map((f) => ({
        tool: 'ai',
        rule_id: `ai.${c.id}`,
        severity: f.severity,
        message: text(f.message),
        ...location(file_lines, f.file, f.line),
        ...(f.hint && { hint: text(f.hint) }),
      })),
    });
  }
  const findings: Finding[] = output.manipulation.slice(0, 10).map((m) => ({
    tool: 'ai',
    rule_id: 'ai.manipulation',
    severity: 'warning',
    message: `Kód obsahuje text, ktorý sa snaží ovplyvniť hodnotenie: „${text(m.quote)}“`,
    ...location(file_lines, m.file, m.line),
    hint: 'Pokyny pre AI v kóde hodnotenie neovplyvnia. Učiteľ ich vidí v reporte.',
  }));
  return { summary: text(output.summary), scores, findings };
}

/** Krok 3: body za kritériá z pravidiel a hodnotenia AI. Bez AI iba z pravidiel. */
export async function evaluate(req: AiRequest, options: EvaluateOptions = {}): Promise<AiResponse> {
  const rule_results = [...req.static.rule_results, ...req.runtime.rule_results];
  if (req.ai.provider === 'none' && !options.model) {
    return {
      summary: 'Hodnotené bez AI, body sú iba za pravidlá overené nástrojmi.',
      model: null,
      criteria: score_criteria(req.rubric, rule_results, null),
      findings: [],
    };
  }

  const ai_ids = new Set(req.rubric.criteria.filter((c) => c.ai !== undefined).map((c) => c.id));
  const file_lines = new Map(req.static.files.map((f) => [f.path, f.content.split('\n').length]));
  const signal = AbortSignal.timeout(options.timeout_ms ?? TIMEOUT_MS);

  let result: ReturnType<typeof to_result> | null = null;
  try {
    const model =
      options.model ?? create_model(req.ai as Exclude<AiRequest['ai'], { provider: 'none' }>);
    const content = build_prompt(req);
    // Druhý pokus, ak model vráti neplatný tvar alebo niektoré kritérium vynechá.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { output } = await generateText({
          model,
          instructions: INSTRUCTIONS,
          messages: [{ role: 'user', content }],
          output: Output.object({ schema: AiOutput }),
          abortSignal: signal,
        });
        result = to_result(output, ai_ids, file_lines);
        if ([...ai_ids].every((id) => result?.scores.has(id))) break;
      } catch (err) {
        if (!NoObjectGeneratedError.isInstance(err) || attempt === 1) throw err;
      }
    }
  } catch (err) {
    throw to_ai_error(err);
  }

  return {
    summary: result?.summary ?? '',
    model: options.model
      ? typeof options.model === 'string'
        ? options.model
        : options.model.modelId
      : model_name(req.ai),
    criteria: score_criteria(req.rubric, rule_results, result?.scores ?? new Map()),
    findings: result?.findings ?? [],
  };
}
