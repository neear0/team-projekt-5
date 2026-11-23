import { HttpError, post_handler } from '@ooko/http';
import { z } from 'zod';
import { auth_config, create_session, password_matches, session_cookie } from '../lib/session.ts';

/** Spomalenie zlého pokusu, aby sa heslo nedalo rýchlo hádať. */
const FAILED_DELAY_MS = 1_500;

// Prihlásenie heslom z APP_PASSWORD. Úspech nastaví cookie, odpoveď je { ok: true }.
const handler = post_handler(
  z.object({ password: z.string().min(1).max(200) }),
  async ({ password }) => {
    const config = auth_config();
    if (config.mode === 'misconfigured') {
      throw new HttpError(503, 'internal', 'Prihlasovanie nie je nastavené (chýba APP_PASSWORD).');
    }
    if (config.mode === 'password' && !(await password_matches(password, config.password))) {
      await new Promise((resolve) => setTimeout(resolve, FAILED_DELAY_MS));
      throw new HttpError(401, 'unauthorized', 'Nesprávne heslo.');
    }
    return { ok: true };
  },
);

export async function POST(request: Request): Promise<Response> {
  const response = await handler(request);
  const config = auth_config();
  if (response.ok && config.mode === 'password') {
    response.headers.append('set-cookie', session_cookie(await create_session(config.password)));
  }
  return response;
}
