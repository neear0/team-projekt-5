import { z } from 'zod';
import { RepoUrl } from './common.ts';
import { Finding } from './finding.ts';
import { CriterionResult, LighthouseScores } from './steps.ts';

/** Výsledný report, ktorý poskladá prehliadač z troch krokov a dá sa stiahnuť ako JSON. */
export const Report = z.object({
  version: z.literal(1),
  generated_at: z.iso.datetime(),
  repo_url: RepoUrl,
  rubric: z.object({ id: z.string(), title: z.string() }),
  points: z.number().min(0),
  max_points: z.number().positive(),
  /** `null`, ak sa hodnotilo bez AI. */
  summary: z.string().nullable(),
  ai: z.object({ provider: z.string(), model: z.string() }).nullable(),
  criteria: z.array(CriterionResult),
  lighthouse: LighthouseScores.nullable(),
  /** Všetky nálezy nástrojov, aj tie, ktoré nepatria k žiadnemu kritériu. */
  findings: z.array(Finding),
});
export type Report = z.infer<typeof Report>;
