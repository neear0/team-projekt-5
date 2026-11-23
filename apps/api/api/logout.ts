import { json } from '@ooko/http';
import { clear_session_cookie } from '../lib/session.ts';

// Odhlásenie: zmaže cookie s prihlásením.
export function POST(): Response {
  return json({ ok: true }, { headers: { 'set-cookie': clear_session_cookie() } });
}
