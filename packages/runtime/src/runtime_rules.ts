// Vyhodnotenie pravidiel kroku 2 z toho, čo namerali prehliadač, axe-core a Lighthouse.
// Bez prehliadača, aby sa dalo testovať samostatne.
import { count } from '@ooko/analyzer';
import type { Finding, LighthouseScores, Rule, RuleResult, Severity } from '@ooko/contracts';
import { axe_text } from './axe_sk.ts';

/** Viac nálezov na jedno pravidlo študent aj tak nečíta a zbytočne to zväčšuje odpoveď. */
const MAX_FINDINGS = 30;

export type Impact = 'minor' | 'moderate' | 'serious' | 'critical';
const IMPACT_RANK: Record<Impact, number> = { minor: 0, moderate: 1, serious: 2, critical: 3 };
const IMPACT_SK: Record<Impact, string> = {
  minor: 'drobné',
  moderate: 'stredné',
  serious: 'vážne',
  critical: 'kritické',
};

export interface AxeViolation {
  /** Stránka, na ktorej axe porušenie našiel. */
  page: string;
  rule_id: string;
  impact: Impact;
  /** Popis pravidla od axe (anglicky). */
  help: string;
  help_url: string;
  nodes: { target: string; html: string; line?: number }[];
}

export interface ConsoleError {
  page: string;
  message: string;
  /** Súbor, z ktorého chyba pochádza, ak je z webu študenta. */
  file?: string;
  line?: number;
  column?: number;
}

export interface RuntimeData {
  /** Stránky, ktoré prehliadač otvoril a axe skontroloval. */
  audited_pages: string[];
  violations: AxeViolation[];
  console_errors: ConsoleError[];
  lighthouse: LighthouseScores | null;
  /** Prečo Lighthouse nedobehol. */
  lighthouse_error: string | null;
}

type Outcome = Omit<RuleResult, 'criterion_id' | 'rule'>;

function outcome(passed: boolean, message: string, findings: Finding[] = []): Outcome {
  return { passed, message, findings: findings.slice(0, MAX_FINDINGS) };
}

function skipped(message: string): Outcome {
  return { passed: false, skipped: true, message, findings: [] };
}

function severity(impact: Impact): Severity {
  return IMPACT_RANK[impact] >= IMPACT_RANK.serious ? 'error' : 'warning';
}

/** Začiatok HTML prvku na jeden riadok, aby sa dal ukázať v hláške. */
function snippet(html: string): string {
  const flat = html.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}

/** Jeden nález za každý prvok, ktorý porušuje pravidlo axe. */
export function axe_findings(violations: readonly AxeViolation[]): Finding[] {
  return violations.flatMap((v) => {
    const sk = axe_text(v.rule_id);
    return v.nodes.map((node) => ({
      tool: 'axe',
      rule_id: v.rule_id,
      severity: severity(v.impact),
      message: `${sk?.message ?? v.help} Prvok: ${snippet(node.html)}`,
      file: v.page,
      ...(node.line !== undefined && { line: node.line }),
      hint: sk ? `${sk.hint} Viac: ${v.help_url}` : `Viac: ${v.help_url}`,
    }));
  });
}

export function console_findings(errors: readonly ConsoleError[]): Finding[] {
  return errors.map((e) => ({
    tool: 'chromium',
    rule_id: 'runtime.console_error',
    severity: 'error',
    message: `Chyba v konzole na stránke ${e.page}: ${e.message}`,
    file: e.file ?? e.page,
    ...(e.line !== undefined && { line: e.line }),
    ...(e.column !== undefined && { column: e.column }),
    hint: 'Otvor stránku v prehliadači, stlač F12 a pozri kartu Console.',
  }));
}

const CATEGORY_SK: Record<keyof LighthouseScores, string> = {
  performance: 'Výkon',
  accessibility: 'Prístupnosť',
  best_practices: 'Osvedčené postupy',
  seo: 'SEO',
};

const CATEGORY_HINT: Record<keyof LighthouseScores, string> = {
  performance:
    'Zmenši obrázky (rozmery aj kvalitu), uveď im width a height a nenačítavaj zbytočné skripty.',
  accessibility:
    'Pozri nálezy axe: alt pri obrázkoch, popisky formulárov, kontrast textu, jazyk stránky.',
  best_practices: 'Oprav chyby v konzole, nepoužívaj zastarané API a odkazy cez http://.',
  seo: 'Doplň title, meta description, jazyk stránky (lang) a zrozumiteľné texty odkazov.',
};

/** Krok 2: vyhodnotí pravidlo `axe.*`, `lighthouse.*` alebo `runtime.*`. */
export function evaluate_runtime_rule(rule: Rule, data: RuntimeData): Outcome {
  switch (rule.type) {
    case 'axe.max_violations': {
      if (data.audited_pages.length === 0) {
        return outcome(false, 'Prehliadač neotvoril žiadnu HTML stránku.');
      }
      const relevant = data.violations.filter(
        (v) => IMPACT_RANK[v.impact] >= IMPACT_RANK[rule.min_impact],
      );
      const findings = axe_findings(relevant);
      const passed = findings.length <= rule.max;
      const level = `od závažnosti „${IMPACT_SK[rule.min_impact]}“`;
      const pages = count(data.audited_pages.length, 'stránku', 'stránky', 'stránok');
      if (findings.length === 0) {
        return outcome(true, `axe nenašiel porušenia prístupnosti ${level} (${pages}).`);
      }
      const tolerance = rule.max > 0 ? `, povolených je ${String(rule.max)}` : '';
      return outcome(
        passed,
        `axe našiel ${count(findings.length, 'porušenie', 'porušenia', 'porušení')} prístupnosti ${level} (${pages})${tolerance}.`,
        passed ? [] : findings,
      );
    }

    case 'lighthouse.min_score': {
      if (!data.lighthouse) {
        return skipped(
          `Lighthouse nedobehol${data.lighthouse_error ? `: ${data.lighthouse_error}` : '.'}`,
        );
      }
      const score = data.lighthouse[rule.category];
      const name = CATEGORY_SK[rule.category];
      const passed = score >= rule.min;
      return outcome(
        passed,
        `Lighthouse ${name}: ${String(score)} (treba aspoň ${String(rule.min)}).`,
        passed
          ? []
          : [
              {
                tool: 'lighthouse',
                rule_id: rule.type,
                severity: 'error',
                message: `Lighthouse skóre ${name} je ${String(score)}, treba aspoň ${String(rule.min)}.`,
                hint: CATEGORY_HINT[rule.category],
              },
            ],
      );
    }

    case 'runtime.no_console_errors': {
      if (data.audited_pages.length === 0) {
        return outcome(false, 'Prehliadač neotvoril žiadnu HTML stránku.');
      }
      const findings = console_findings(data.console_errors);
      return findings.length === 0
        ? outcome(true, 'Konzola prehliadača je bez chýb.')
        : outcome(
            false,
            `V konzole ${findings.length >= 2 && findings.length <= 4 ? 'sú' : 'je'} ${count(findings.length, 'chyba', 'chyby', 'chýb')}.`,
            findings,
          );
    }

    default:
      return skipped('Pravidlo vyhodnocuje krok 1 (statická analýza).');
  }
}
