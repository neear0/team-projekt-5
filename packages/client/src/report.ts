import type {
  AiConfig,
  AiResponse,
  CriterionResult,
  Finding,
  Report,
  Rubric,
  RuleResult,
  RuntimeResponse,
  Screenshot,
  StaticResponse,
} from '@ooko/contracts';

export interface ReportInput {
  repo_url: string;
  rubric: Rubric;
  /** API kľúč sa do reportu nedostane, berie sa iba poskytovateľ a model. */
  ai_config: AiConfig;
  static: StaticResponse;
  runtime: RuntimeResponse;
  ai: AiResponse;
  generated_at?: Date;
}

const round = (n: number) => Math.round(n * 100) / 100;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Poskladá report z výsledkov troch krokov. Je to JSON, ktorý si používateľ stiahne. */
export function build_report(input: ReportInput): Report {
  const { ai_config } = input;
  const rule_results = [...input.static.rule_results, ...input.runtime.rule_results];
  const findings = unique([
    ...input.static.findings,
    ...input.runtime.findings,
    ...rule_results.flatMap((r) => r.findings),
  ]);

  return {
    version: 1,
    generated_at: (input.generated_at ?? new Date()).toISOString(),
    repo_url: input.repo_url,
    rubric: { id: input.rubric.id, title: input.rubric.title },
    points: round(sum(input.ai.criteria.map((c) => c.points))),
    max_points: sum(input.rubric.criteria.map((c) => c.points)),
    summary: ai_config.provider === 'none' ? null : input.ai.summary,
    ai:
      ai_config.provider === 'none'
        ? null
        : { provider: ai_config.provider, model: ai_config.model },
    criteria: input.ai.criteria,
    lighthouse: input.runtime.lighthouse,
    findings,
  };
}

function unique(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = JSON.stringify([f.tool, f.rule_id, f.file, f.line, f.column, f.message]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface CriteriaGroup {
  /** `null` pre kritériá bez skupiny. */
  title: string | null;
  points: number;
  max_points: number;
  criteria: CriterionResult[];
}

/** Kritériá rozdelené podľa `group` (napr. „1. časť: HTML5“), v poradí z rubriky. */
export function group_criteria(criteria: CriterionResult[]): CriteriaGroup[] {
  const groups = new Map<string | null, CriterionResult[]>();
  for (const criterion of criteria) {
    const key = criterion.group ?? null;
    groups.set(key, [...(groups.get(key) ?? []), criterion]);
  }
  return [...groups].map(([title, items]) => ({
    title,
    points: round(sum(items.map((c) => c.points))),
    max_points: sum(items.map((c) => c.max_points)),
    criteria: items,
  }));
}

/** Výsledky pravidiel z krokov 1 a 2 podľa `criterion_id`, na zoznam „čo prešlo / neprešlo“. */
export function rule_results_by_criterion(
  static_result: StaticResponse,
  runtime_result: RuntimeResponse,
): Map<string, RuleResult[]> {
  const map = new Map<string, RuleResult[]>();
  for (const result of [...static_result.rule_results, ...runtime_result.rule_results]) {
    map.set(result.criterion_id, [...(map.get(result.criterion_id) ?? []), result]);
  }
  return map;
}

/** Hodnota pre `<img src>`. */
export function screenshot_src(screenshot: Screenshot): string {
  return `data:${screenshot.mime_type};base64,${screenshot.data}`;
}

/** Odkaz na riadok súboru na GitHube, napr. pri náleze `index.html:36`. */
export function github_line_url(repo_url: string, file: string, line?: number): string {
  const match =
    /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?\/?$/.exec(
      repo_url,
    );
  if (!match) return repo_url;
  const [, owner = '', repo = '', ref = 'HEAD', subdir = ''] = match;
  const path = subdir ? `${subdir.replace(/\/+$/, '')}/${file}` : file;
  return `https://github.com/${owner}/${repo}/blob/${ref}/${path}${line ? `#L${String(line)}` : ''}`;
}
