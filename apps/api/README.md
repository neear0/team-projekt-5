# Ooko API

Backend webovej aplikácie: Vercel Functions v `api/`, logika v `packages/*`.

| Endpoint | Metóda | Stav |
|---|---|---|
| `/api/health` | GET | verzia a región |
| `/api/static` | POST `{ repo_url }` | krok 1, zatiaľ ukážkové dáta |
| `/api/runtime` | POST `{ repo_url }` | krok 2, zatiaľ ukážkové dáta |
| `/api/ai` | POST `{ ai, static, runtime }` | krok 3, zatiaľ ukážkové dáta |
| `/api/probe` | GET | prototyp etapy 1, na produkcii vypnutý |

Tvar požiadaviek a odpovedí je v `packages/contracts`. Chyby majú vždy tvar
`{ "error": { "code", "message", "issues"? } }`.

## Lokálne

```bash
corepack enable pnpm
pnpm install
pnpm --filter @ooko/api dev          # http://localhost:3000/api/health
```

`/api/probe` potrebuje prehliadač: `BROWSER_CHANNEL=msedge` (alebo `chrome`),
`CHROMIUM_PATH=...`, alebo `pnpm --filter @ooko/runtime exec playwright-core install chromium`.
Samotný prototyp bez servera: `pnpm --filter @ooko/runtime probe`.

## Vercel

Nový projekt z GitHub repozitára:

- **Root Directory:** `apps/api`
- **Framework Preset:** Other (zvyšok berie `vercel.json`)
- **Include files outside the root directory:** zapnuté (predvolene áno)
- **Node.js:** 24.x (z `engines` v `package.json`)

Build (`pnpm run build`) zostaví balíky z `packages/` do `dist/`, funkcie ich importujú odtiaľ.

## Etapa 1: čo zmerať na preview nasadení

Otvoriť `https://<preview-url>/api/probe` aspoň 3×, prvé volanie je studený štart.

| Čo | Kde | Limit |
|---|---|---|
| Lighthouse dobehne (`lighthouse.scores`, nie `error`) | odpoveď | |
| `timings_ms.total` | odpoveď | 300 s |
| `timings_ms.launch` pri `cold_start: true` | odpoveď | |
| Veľkosť funkcie `api/probe` | Vercel → Deployment → Functions | 250 MB |
| Pamäť | Vercel → Observability | 2 GB |

Lokálne (Windows, Edge 156): štart 0,5–0,9 s, screenshoty ~1 s, axe ~0,7 s,
Lighthouse ~8 s, spolu ~10 s.
