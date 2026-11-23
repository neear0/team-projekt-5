import { error_response, HttpError } from '@ooko/http';
import { auth_config, is_authenticated } from './session.ts';

type Handler = (request: Request) => Promise<Response>;

/**
 * Endpoint iba pre prihlásených. Middleware to stráži tiež, toto je druhá vrstva pre prípad,
 * že by sa middleware obišiel alebo nebežal (lokálny server, zlý matcher).
 */
export function protect(handler: Handler): Handler {
  return async (request) => {
    const config = auth_config();
    if (config.mode === 'misconfigured') {
      return error_response(
        new HttpError(503, 'internal', 'Prihlasovanie nie je nastavené (chýba APP_PASSWORD).'),
      );
    }
    if (!(await is_authenticated(request, config))) {
      return error_response(new HttpError(401, 'unauthorized', 'Prihlás sa.'));
    }
    return handler(request);
  };
}
