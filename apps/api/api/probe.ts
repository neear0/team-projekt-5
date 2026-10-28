import { error_response, HttpError, json } from '@ooko/http';
import { run_probe } from '@ooko/runtime';

// Prototyp etapy 1: zmeria Chromium, axe-core a Lighthouse priamo vo Vercel Function.
// Beží iba lokálne a na preview nasadeniach, po rozhodnutí sa zmaže.
export async function GET(): Promise<Response> {
  try {
    if (process.env.VERCEL_ENV === 'production') {
      throw new HttpError(404, 'not_found', 'Endpoint neexistuje.');
    }
    return json(await run_probe());
  } catch (err) {
    return error_response(err);
  }
}
