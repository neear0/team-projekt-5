import { z } from 'zod';

/** Odkaz na verejný GitHub repozitár. Iné hosty server neprijíma. */
export const RepoUrl = z
  .url({ protocol: /^https$/, hostname: /^github\.com$/ })
  .max(300)
  .describe('https://github.com/vlastnik/repozitar[/tree/vetva/cesta]');

export const ErrorCode = z.enum([
  'bad_request',
  'not_found',
  'method_not_allowed',
  'payload_too_large',
  'upstream_error',
  'internal',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Jednotný tvar chyby zo všetkých endpointov. */
export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    /** Pri `bad_request`: ktoré polia sú zlé. */
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

export const HealthResponse = z.object({
  status: z.literal('ok'),
  version: z.string(),
  region: z.string().nullable(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
