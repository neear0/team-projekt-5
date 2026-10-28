import { LineCounter, parseDocument } from 'yaml';
import { Rubric } from './rubric.ts';

export interface RubricIssue {
  path: string;
  message: string;
  /** Riadok v YAML, ak ide o chybu syntaxe. */
  line?: number;
}

export type ParsedRubric =
  { success: true; rubric: Rubric } | { success: false; issues: RubricIssue[] };

/** Načíta rubriku z YAML, ktoré napísal učiteľ. Chyby vráti tak, aby sa dali ukázať v editore. */
export function parse_rubric(text: string): ParsedRubric {
  const line_counter = new LineCounter();
  const doc = parseDocument(text, { lineCounter: line_counter, prettyErrors: false });
  if (doc.errors.length > 0) {
    return {
      success: false,
      issues: doc.errors.map((err) => ({
        path: '',
        message: err.message,
        line: line_counter.linePos(err.pos[0]).line,
      })),
    };
  }

  const parsed = Rubric.safeParse(doc.toJS());
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  return { success: true, rubric: parsed.data };
}
