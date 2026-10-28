import { z } from 'zod';

export const Severity = z.enum(['error', 'warning', 'info']);
export type Severity = z.infer<typeof Severity>;

/** Jeden nález z ľubovoľného nástroja (validátor, linter, axe, pravidlo rubriky). */
export const Finding = z.object({
  tool: z.string(),
  ruleId: z.string(),
  severity: Severity,
  message: z.string(),
  file: z.string().optional(),
  line: z.int().positive().optional(),
  column: z.int().positive().optional(),
  /** Návrh opravy pre študenta. */
  hint: z.string().optional(),
});
export type Finding = z.infer<typeof Finding>;
