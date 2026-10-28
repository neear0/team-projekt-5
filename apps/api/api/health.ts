import type { HealthResponse } from '@ooko/contracts';
import { json } from '@ooko/http';

export function GET(): Response {
  const body: HealthResponse = {
    status: 'ok',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    region: process.env.VERCEL_REGION ?? null,
  };
  return json(body);
}
