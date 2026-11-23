import type { HealthResponse } from '@ooko/contracts';
import { server_ai_configured } from '@ooko/ai';
import { json } from '@ooko/http';

export function GET(): Response {
  const body: HealthResponse = {
    status: 'ok',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    region: process.env.VERCEL_REGION ?? null,
    server_ai: server_ai_configured(),
  };
  return json(body);
}
