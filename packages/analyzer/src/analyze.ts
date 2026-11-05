import js from '@eslint/js';
import { Linter } from 'eslint';
import globals from 'globals';
import {
  rule_step,
  type Rubric,
  type RuleResult,
  type SourceFile,
  type StaticResponse,
} from '@ooko/contracts';
import { evaluate_rule, type LintMessage } from './rules.ts';
import { load_site, type Site } from './site.ts';
import {
  validate_css,
  validate_html,
  type ValidationResult,
  type ValidatorOptions,
} from './validators.ts';

/** Viac stránok W3C validátoru naraz neposielame, aby nás nezablokoval. */
const MAX_VALIDATED_FILES = 25;
const VALIDATION_CONCURRENCY = 3;
/** Zdrojáky idú ďalej do kroku AI, odpoveď Vercel Function má limit 4,5 MB. */
const MAX_FILE_CHARS = 100_000;
const MAX_SOURCE_CHARS = 1_500_000;

export type AnalyzeOptions = ValidatorOptions;

async function map_limited<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function validate_all(
  files: { path: string; source: string }[],
  validate: (path: string, source: string, options: ValidatorOptions) => Promise<ValidationResult>,
  options: ValidatorOptions,
): Promise<Map<string, ValidationResult>> {
  const checked = files.slice(0, MAX_VALIDATED_FILES);
  const results = await map_limited(checked, VALIDATION_CONCURRENCY, (f) =>
    validate(f.path, f.source, options),
  );
  return new Map(checked.map((f, i) => [f.path, results[i] ?? null]));
}

const LINT_RULES: Linter.RulesRecord = {
  ...js.configs.recommended.rules,
  'no-var': 'error',
  // Funkcie volané z HTML alebo z iného súboru by boli falošné chyby.
  'no-unused-vars': 'warn',
  'no-undef': 'warn',
};

function lint_scripts(site: Site): LintMessage[] {
  const linter = new Linter();
  const messages: LintMessage[] = [];
  for (const script of site.scripts) {
    const config = (source_type: 'script' | 'module'): Linter.Config[] => [
      {
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: source_type,
          globals: globals.browser,
        },
        rules: LINT_RULES,
      },
    ];
    let result = linter.verify(script.source, config('script'), { filename: script.path });
    if (result.some((m) => m.fatal) && /\b(import|export)\b/.test(script.source)) {
      result = linter.verify(script.source, config('module'), { filename: script.path });
    }
    for (const m of result)
      messages.push({ ...m, file: script.path, line: m.line + script.line_offset });
  }
  return messages;
}

function source_files(site: Site): SourceFile[] {
  const files: SourceFile[] = [];
  let total = 0;
  const all = [
    ...site.pages.map((p) => ({ path: p.path, source: p.source })),
    ...site.styles.filter((s) => !s.inline),
    ...site.scripts.filter((s) => !s.inline),
  ];
  for (const { path, source } of all) {
    const content =
      source.length > MAX_FILE_CHARS ? `${source.slice(0, MAX_FILE_CHARS)}\n… (skrátené)` : source;
    if (total + content.length > MAX_SOURCE_CHARS) break;
    total += content.length;
    files.push({ path, content });
  }
  return files;
}

/** Krok 1: statická analýza súborov repozitára podľa rubriky. */
export async function analyze_static(
  repo_files: ReadonlyMap<string, Uint8Array>,
  rubric: Rubric,
  options: AnalyzeOptions = {},
): Promise<StaticResponse> {
  const site = load_site(repo_files);
  const rules = rubric.criteria.flatMap((criterion) =>
    criterion.rules
      .filter((rule) => rule_step(rule) === 'static')
      .map((rule) => ({ criterion, rule })),
  );
  const needs = (type: string) => rules.some(({ rule }) => rule.type === type);

  const [html_validation, css_validation] = await Promise.all([
    needs('html.valid')
      ? validate_all(
          site.pages.map((p) => ({ path: p.path, source: p.source })),
          validate_html,
          options,
        )
      : undefined,
    needs('css.valid')
      ? validate_all(
          site.styles.filter((s) => !s.inline),
          validate_css,
          options,
        )
      : undefined,
  ]);
  const lint = needs('js.no_var') || needs('js.no_errors') ? lint_scripts(site) : undefined;

  const ctx = {
    site,
    ...(html_validation && { html_validation }),
    ...(css_validation && { css_validation }),
    ...(lint && { lint }),
  };
  const rule_results: RuleResult[] = rules.map(({ criterion, rule }) => ({
    criterion_id: criterion.id,
    rule,
    ...evaluate_rule(rule, ctx),
  }));

  return { files: source_files(site), findings: site.findings, rule_results };
}
