import { z } from 'zod';
import { Report } from './report.ts';
import { Rubric } from './rubric.ts';

/** JSON Schema pre súbory, ktoré ľudia píšu alebo sťahujú. Generuje ich `pnpm schemas`. */
export function json_schemas(): Record<string, unknown> {
  return {
    // Rubriku píše učiteľ, polia s predvolenou hodnotou sú v nej nepovinné.
    'rubric.schema.json': z.toJSONSchema(Rubric, { io: 'input' }),
    'report.schema.json': z.toJSONSchema(Report),
  };
}
