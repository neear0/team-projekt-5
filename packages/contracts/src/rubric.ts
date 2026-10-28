import { z } from 'zod';

const Id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Iba malé písmená bez diakritiky, číslice a pomlčky.')
  .max(60);

/** Deterministické pravidlá, ktoré vyhodnotia nástroje bez AI. */
export const Rule = z.discriminatedUnion('type', [
  // HTML
  z
    .object({
      type: z.literal('html.valid'),
      /** Koľko chýb validátora sa ešte toleruje. */
      max_errors: z.int().min(0).default(0),
    })
    .describe('HTML prejde validátorom.'),
  z
    .object({ type: z.literal('html.label_for_inputs') })
    .describe('Každý vstup formulára má <label>.'),
  z
    .object({
      type: z.literal('html.uses_tags'),
      tags: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).min(1),
    })
    .describe('Stránka používa všetky uvedené elementy.'),
  z.object({ type: z.literal('html.img_alt') }).describe('Každý <img> má atribút alt.'),

  // CSS
  z
    .object({
      type: z.literal('css.uses_layout'),
      /** Stačí jeden z nich. */
      any_of: z.array(z.enum(['flex', 'grid'])).min(1),
    })
    .describe('Layout používa Flexbox alebo Grid.'),
  z
    .object({
      type: z.literal('css.media_queries'),
      min: z.int().positive().default(1),
    })
    .describe('CSS obsahuje aspoň `min` media queries.'),
  z
    .object({ type: z.literal('css.custom_properties') })
    .describe('CSS definuje a používa vlastné premenné (--farba …).'),
  z.object({ type: z.literal('css.no_inline_styles') }).describe('HTML nemá atribúty style.'),

  // JS
  z
    .object({ type: z.literal('js.no_inline_handlers') })
    .describe('Udalosti cez addEventListener, nie onclick v HTML.'),
  z.object({ type: z.literal('js.no_var') }).describe('Premenné cez let a const, nie var.'),
  z.object({ type: z.literal('js.no_errors') }).describe('ESLint nenájde chyby.'),

  // Runtime
  z
    .object({
      type: z.literal('axe.max_violations'),
      /** Od akej závažnosti sa porušenia počítajú. */
      min_impact: z.enum(['minor', 'moderate', 'serious', 'critical']).default('serious'),
      max: z.int().min(0).default(0),
    })
    .describe('axe-core nenájde porušenia prístupnosti.'),
  z
    .object({
      type: z.literal('lighthouse.min_score'),
      category: z.enum(['performance', 'accessibility', 'best_practices', 'seo']),
      min: z.number().min(0).max(100),
    })
    .describe('Lighthouse skóre v kategórii je aspoň `min`.'),
  z
    .object({ type: z.literal('runtime.no_console_errors') })
    .describe('Konzola prehliadača je bez chýb.'),

  // Súbory
  z
    .object({
      type: z.literal('file.exists'),
      path: z.string().min(1),
    })
    .describe('V repozitári je uvedený súbor.'),
]);
export type Rule = z.infer<typeof Rule>;
export type RuleType = Rule['type'];

/**
 * Jedno kritérium zadania. Body za pravidlá počítajú nástroje (každé pravidlo rovnakým dielom),
 * text `ai` je pokyn pre AI pri kritériách, ktoré sa merať nedajú.
 */
export const Criterion = z
  .object({
    id: Id,
    title: z.string().min(1).max(200),
    points: z.number().positive(),
    /** Čo kritérium znamená, zobrazí sa aj študentovi. */
    description: z.string().optional(),
    rules: z.array(Rule).default([]),
    ai: z.string().min(1).optional(),
  })
  .refine((c) => c.rules.length > 0 || c.ai !== undefined, {
    message: 'Kritérium potrebuje aspoň jedno pravidlo alebo pokyn pre AI.',
    path: ['rules'],
  });
export type Criterion = z.infer<typeof Criterion>;

/** Rubrika zadania, ktorú učiteľ píše v YAML. */
export const Rubric = z
  .object({
    version: z.literal(1),
    id: Id,
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    criteria: z.array(Criterion).min(1).max(50),
  })
  .refine((r) => new Set(r.criteria.map((c) => c.id)).size === r.criteria.length, {
    message: 'Kritériá musia mať rôzne id.',
    path: ['criteria'],
  });
export type Rubric = z.infer<typeof Rubric>;

export function max_points(rubric: Rubric): number {
  return rubric.criteria.reduce((sum, c) => sum + c.points, 0);
}

/** V ktorom kroku sa pravidlo vyhodnocuje: kódu stačí statická analýza, zvyšok potrebuje prehliadač. */
export function rule_step(rule: Rule): 'static' | 'runtime' {
  return /^(axe|lighthouse|runtime)./.test(rule.type) ? 'runtime' : 'static';
}
