import type { Finding } from '@ooko/contracts';

const USER_AGENT = 'ooko-analyzer (skolsky projekt)';
const NU_URL = 'https://validator.w3.org/nu/?out=json';
const CSS_URL = 'https://jigsaw.w3.org/css-validator/validator';

export interface ValidatorOptions {
  fetch?: typeof fetch;
  timeout_ms?: number;
}

/** Výsledok jedného súboru. `null` = validátor neodpovedal. */
export type ValidationResult = { errors: Finding[]; warnings: Finding[] } | null;

// Polia podľa JSON odpovede Nu validátora.
/* eslint-disable @typescript-eslint/naming-convention */
interface NuMessage {
  type: string;
  subType?: string;
  message?: string;
  lastLine?: number;
  firstColumn?: number;
}
/* eslint-enable @typescript-eslint/naming-convention */

/** Nu Html Checker (W3C), ten istý validátor, ktorý používajú vyučujúci. */
export async function validate_html(
  path: string,
  source: string,
  options: ValidatorOptions = {},
): Promise<ValidationResult> {
  const do_fetch = options.fetch ?? fetch;
  try {
    const response = await do_fetch(NU_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/html; charset=utf-8', 'user-agent': USER_AGENT },
      body: source,
      signal: AbortSignal.timeout(options.timeout_ms ?? 20_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { messages?: NuMessage[] };
    const errors: Finding[] = [];
    const warnings: Finding[] = [];
    for (const m of body.messages ?? []) {
      const is_error =
        m.type === 'error' || (m.type === 'non-document-error' && m.subType !== 'internal');
      const is_warning = m.type === 'info' && m.subType === 'warning';
      if (!is_error && !is_warning) continue;
      const finding: Finding = {
        tool: 'nu-html-checker',
        rule_id: 'html.valid',
        severity: is_error ? 'error' : 'warning',
        message: m.message ?? 'Chyba validátora.',
        file: path,
        ...(m.lastLine !== undefined && m.lastLine > 0 && { line: m.lastLine }),
        ...(m.firstColumn !== undefined && m.firstColumn > 0 && { column: m.firstColumn }),
      };
      (is_error ? errors : warnings).push(finding);
    }
    return { errors, warnings };
  } catch {
    return null;
  }
}

interface CssMessage {
  line?: number;
  message?: string;
  context?: string;
}

/** W3C CSS Validator (jigsaw). Text sa posiela ako multipart, inak služba spadne. */
export async function validate_css(
  path: string,
  source: string,
  options: ValidatorOptions = {},
): Promise<ValidationResult> {
  const do_fetch = options.fetch ?? fetch;
  const form = new FormData();
  form.set('text', source);
  form.set('output', 'json');
  form.set('profile', 'css3svg');
  form.set('warning', '1');
  try {
    const response = await do_fetch(CSS_URL, {
      method: 'POST',
      headers: { 'user-agent': USER_AGENT },
      body: form,
      signal: AbortSignal.timeout(options.timeout_ms ?? 20_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      cssvalidation?: { errors?: CssMessage[]; warnings?: CssMessage[] };
    };
    if (!body.cssvalidation) return null;
    const to_finding = (m: CssMessage, severity: 'error' | 'warning'): Finding => ({
      tool: 'css-validator',
      rule_id: 'css.valid',
      severity,
      message: `${(m.message ?? 'Chyba validátora.').trim().replace(/\s*:$/, '')}${m.context ? ` (${m.context.trim()})` : ''}`,
      file: path,
      ...(m.line !== undefined && m.line > 0 && { line: m.line }),
    });
    return {
      errors: (body.cssvalidation.errors ?? []).map((m) => to_finding(m, 'error')),
      warnings: (body.cssvalidation.warnings ?? []).map((m) => to_finding(m, 'warning')),
    };
  } catch {
    return null;
  }
}
