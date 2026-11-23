// Vercel Routing Middleware: bez prihlásenia pustí iba prihlasovaciu stránku a /api/login,
// /api/logout, /api/health. Stránky presmeruje na /login.html, API vráti 401.
// Funkcie v api/ prihlásenie overujú aj samy (lib/auth.ts), middleware je prvá vrstva.
import { auth_config, is_authenticated } from './lib/session.ts';

export const config = {
  matcher: ['/((?!api/login|api/logout|api/health|login[.]html|robots[.]txt|favicon[.]ico).*)'],
};

function error(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const auth = auth_config();
  if (await is_authenticated(request, auth)) return undefined; // pokračuje ďalej

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    return auth.mode === 'misconfigured'
      ? error(503, 'internal', 'Prihlasovanie nie je nastavené (chýba APP_PASSWORD).')
      : error(401, 'unauthorized', 'Prihlás sa.');
  }
  const login = new URL('/login.html', url);
  login.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(login, 302);
}
