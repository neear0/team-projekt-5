import { z } from 'zod';

const Id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Iba malé písmená bez diakritiky, číslice a pomlčky.')
  .max(60);

/**
 * Kde musí pravidlo platiť: `site` = stačí spolu na celom webe (napr. <q> na jednej stránke
 * a <mark> na inej), `each_page` = na každej HTML stránke zvlášť.
 */
const Scope = z.enum(['site', 'each_page']);

const TagName = z.string().regex(/^[a-z][a-z0-9-]*$/);
const CssProperty = z.string().regex(/^-?[a-z][a-z0-9-]*$/);

/** Deterministické pravidlá, ktoré vyhodnotia nástroje bez AI. */
export const Rule = z.discriminatedUnion('type', [
  // Web ako celok
  z
    .strictObject({
      type: z.literal('site.min_pages'),
      /** Vrátane úvodnej stránky. */
      min: z.int().positive(),
    })
    .describe('Web má aspoň `min` HTML stránok.'),
  z
    .strictObject({
      type: z.literal('site.pages_reachable'),
      start: z.string().min(1).default('index.html'),
    })
    .describe('Na každú HTML stránku sa dá prekliknúť z úvodnej stránky.'),

  // HTML
  z
    .strictObject({
      type: z.literal('html.valid'),
      /** Koľko chýb validátora sa ešte toleruje, spolu za všetky stránky. */
      max_errors: z.int().min(0).default(0),
    })
    .describe('HTML prejde validátorom.'),
  z
    .strictObject({
      type: z.literal('html.head'),
      scope: Scope.default('each_page'),
    })
    .describe(
      'Stránka má <!DOCTYPE html>, html, head, body, kódovanie (meta charset) a neprázdny title.',
    ),
  z
    .strictObject({
      type: z.literal('html.meta'),
      names: z.array(z.string().regex(/^[a-z][a-z0-9:-]*$/)).min(1),
      scope: Scope.default('each_page'),
    })
    .describe('Stránka má neprázdne <meta name="…" content="…"> pre všetky uvedené mená.'),
  z
    .strictObject({
      type: z.literal('html.favicon'),
      scope: Scope.default('each_page'),
    })
    .describe('Stránka odkazuje na favicon (link rel="icon") a súbor v repozitári existuje.'),
  z
    .strictObject({
      type: z.literal('html.heading_levels'),
      min: z.int().min(1).max(6),
      scope: Scope.default('site'),
    })
    .describe('Nadpisy h1–h6 sú použité aspoň v `min` úrovniach.'),
  z
    .strictObject({
      type: z.literal('html.entities'),
      min: z.int().positive().default(1),
      scope: Scope.default('site'),
    })
    .describe(
      'Zdrojový kód obsahuje aspoň `min` špeciálnych symbolov zapísaných entitou (&copy;, &#8364; …).',
    ),
  z
    .strictObject({ type: z.literal('html.label_for_inputs') })
    .describe('Každý vstup formulára má <label>.'),
  z
    .strictObject({
      type: z.literal('html.uses_tags'),
      tags: z.array(TagName).min(1),
      scope: Scope.default('site'),
    })
    .describe('Stránka používa všetky uvedené elementy.'),
  z
    .strictObject({
      type: z.literal('html.selector'),
      /** CSS selektor, napr. `ul img, ol img` alebo `a[href$="index.html"] img`. */
      selector: z.string().min(1).max(200),
      min: z.int().positive().default(1),
      /** Čo selektor hľadá, ľudskými slovami. Zobrazí sa študentovi namiesto selektora. */
      label: z.string().min(1).max(100).optional(),
      scope: Scope.default('site'),
    })
    .describe('HTML obsahuje aspoň `min` elementov, ktoré zodpovedajú selektoru.'),
  z.strictObject({ type: z.literal('html.img_alt') }).describe('Každý <img> má atribút alt.'),
  z
    .strictObject({ type: z.literal('html.no_broken_links') })
    .describe(
      'Odkazy a cesty k súborom (a, img, link, script, source, area) vedú na existujúce súbory.',
    ),

  // CSS
  z
    .strictObject({
      type: z.literal('css.valid'),
      /** Koľko chýb W3C CSS validátora sa ešte toleruje. */
      max_errors: z.int().min(0).default(0),
    })
    .describe('CSS prejde W3C validátorom.'),
  z
    .strictObject({
      type: z.literal('css.single_file'),
      path: z.string().min(1),
    })
    .describe('Repozitár má iba jeden CSS súbor na uvedenej ceste a každá stránka ho pripája.'),
  z
    .strictObject({
      type: z.literal('css.comments'),
      min: z.int().positive().default(1),
    })
    .describe('CSS obsahuje aspoň `min` komentárov.'),
  z
    .strictObject({
      type: z.literal('css.selector_kinds'),
      /** Všetky uvedené druhy musia byť použité. */
      kinds: z
        .array(
          z.enum([
            'type',
            'class',
            'id',
            'attribute',
            'pseudo_class',
            'pseudo_element',
            'universal',
          ]),
        )
        .min(1),
    })
    .describe('CSS používa uvedené druhy selektorov (element, trieda, id …).'),
  z
    .strictObject({
      type: z.literal('css.uses_properties'),
      /** `margin` platí aj pre margin-top, `font` aj pre font-size a pod. */
      properties: z.array(CssProperty).min(1),
      /** `all` = každá vlastnosť aspoň raz, `any` = stačí jedna z nich. */
      match: z.enum(['all', 'any']).default('all'),
      /** Počítajú sa iba pravidlá, ktorých selektor obsahuje všetky tieto reťazce, napr. [img, ':hover']. */
      selector_includes: z.array(z.string().min(1)).min(1).optional(),
    })
    .describe('CSS používa uvedené vlastnosti.'),
  z
    .strictObject({
      type: z.literal('css.uses_layout'),
      /** Stačí jeden z nich. */
      any_of: z.array(z.enum(['flex', 'grid'])).min(1),
    })
    .describe('Layout používa Flexbox alebo Grid.'),
  z
    .strictObject({
      type: z.literal('css.media_queries'),
      min: z.int().positive().default(1),
    })
    .describe('CSS obsahuje aspoň `min` media queries.'),
  z
    .strictObject({ type: z.literal('css.custom_properties') })
    .describe('CSS definuje a používa vlastné premenné (--farba …).'),
  z.strictObject({ type: z.literal('css.no_inline_styles') }).describe('HTML nemá atribúty style.'),

  // JS
  z
    .strictObject({ type: z.literal('js.no_inline_handlers') })
    .describe('Udalosti cez addEventListener, nie onclick v HTML.'),
  z.strictObject({ type: z.literal('js.no_var') }).describe('Premenné cez let a const, nie var.'),
  z.strictObject({ type: z.literal('js.no_errors') }).describe('ESLint nenájde chyby.'),

  // Runtime
  z
    .strictObject({
      type: z.literal('axe.max_violations'),
      /** Od akej závažnosti sa porušenia počítajú. */
      min_impact: z.enum(['minor', 'moderate', 'serious', 'critical']).default('serious'),
      max: z.int().min(0).default(0),
    })
    .describe('axe-core nenájde porušenia prístupnosti.'),
  z
    .strictObject({
      type: z.literal('lighthouse.min_score'),
      category: z.enum(['performance', 'accessibility', 'best_practices', 'seo']),
      min: z.number().min(0).max(100),
    })
    .describe('Lighthouse skóre v kategórii je aspoň `min`.'),
  z
    .strictObject({ type: z.literal('runtime.no_console_errors') })
    .describe('Konzola prehliadača je bez chýb.'),

  // Súbory
  z
    .strictObject({
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
  .strictObject({
    id: Id,
    title: z.string().min(1).max(200),
    points: z.number().positive(),
    /** Časť zadania, napr. „1. časť: HTML5“. Report z nej spočíta medzisúčty. */
    group: z.string().min(1).max(100).optional(),
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
  .strictObject({
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
