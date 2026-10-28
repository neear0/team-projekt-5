import { z } from 'zod';
import { RepoUrl } from './common.ts';
import { Finding } from './finding.ts';

export const SourceFile = z.object({
  path: z.string(),
  content: z.string(),
});
export type SourceFile = z.infer<typeof SourceFile>;

// Krok 1: statická analýza

export const StaticRequest = z.object({
  repoUrl: RepoUrl,
});
export type StaticRequest = z.infer<typeof StaticRequest>;

export const StaticResponse = z.object({
  files: z.array(SourceFile),
  findings: z.array(Finding),
});
export type StaticResponse = z.infer<typeof StaticResponse>;

// Krok 2: runtime analýza

export const Screenshot = z.object({
  width: z.int().positive(),
  mimeType: z.enum(['image/jpeg', 'image/webp']),
  /** Obrázok v base64. */
  data: z.string(),
});
export type Screenshot = z.infer<typeof Screenshot>;

/** Skóre z Lighthouse (0–100). `null`, ak Lighthouse nebežal. */
export const LighthouseScores = z.object({
  performance: z.number().min(0).max(100),
  accessibility: z.number().min(0).max(100),
  bestPractices: z.number().min(0).max(100),
  seo: z.number().min(0).max(100),
});
export type LighthouseScores = z.infer<typeof LighthouseScores>;

export const RuntimeRequest = z.object({
  repoUrl: RepoUrl,
});
export type RuntimeRequest = z.infer<typeof RuntimeRequest>;

export const RuntimeResponse = z.object({
  screenshots: z.array(Screenshot),
  lighthouse: LighthouseScores.nullable(),
  findings: z.array(Finding),
});
export type RuntimeResponse = z.infer<typeof RuntimeResponse>;

// Krok 3: AI hodnotenie

export const AiConfig = z.discriminatedUnion('provider', [
  z.object({
    provider: z.enum(['google', 'anthropic', 'openai']),
    model: z.string().min(1),
    apiKey: z.string().min(1),
  }),
  z.object({
    provider: z.literal('openai-compatible'),
    baseURL: z.url(),
    model: z.string().min(1),
    apiKey: z.string().optional(),
  }),
  z.object({ provider: z.literal('none') }),
]);
export type AiConfig = z.infer<typeof AiConfig>;

export const AiRequest = z.object({
  ai: AiConfig,
  static: StaticResponse,
  runtime: RuntimeResponse,
});
export type AiRequest = z.infer<typeof AiRequest>;

export const CriterionResult = z.object({
  id: z.string(),
  title: z.string(),
  points: z.number().min(0),
  maxPoints: z.number().positive(),
  reasoning: z.string(),
  findings: z.array(Finding),
});
export type CriterionResult = z.infer<typeof CriterionResult>;

export const AiResponse = z.object({
  summary: z.string(),
  criteria: z.array(CriterionResult),
});
export type AiResponse = z.infer<typeof AiResponse>;
