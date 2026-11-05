# Ooko API

Backend webovej aplikácie: Vercel Functions v `api/`, logika v `packages/*`.

| Endpoint | Metóda | Stav |
|---|---|---|
| `/api/health` | GET | verzia a región |
| `/api/static` | POST `{ repo_url, rubric }` | krok 1, zatiaľ ukážkové dáta |
| `/api/runtime` | POST `{ repo_url, rubric }` | krok 2, zatiaľ ukážkové dáta |
| `/api/ai` | POST `{ ai, rubric, static, runtime }` | krok 3, zatiaľ ukážkové dáta |
| `/api/probe` | GET | prototyp etapy 1, na produkcii vypnutý |

Tvar požiadaviek a odpovedí je v `packages/contracts`. Chyby majú vždy tvar
`{ "error": { "code", "message", "issues"? } }`.

## Rubriky

Učiteľ píše rubriku v YAML (ukážky sú v `rubrics/`), prehliadač ju načíta cez `parse_rubric`
z `@ooko/contracts` a do krokov posiela už ako JSON. Kritérium má body, deterministické pravidlá
(`rules`) a/alebo pokyn pre AI (`ai`). Pravidlá `axe.*`, `lighthouse.*` a `runtime.*` vyhodnocuje
krok 2, ostatné krok 1. Body za pravidlá sa delia rovnakým dielom.

JSON Schema rubriky a reportu je v `packages/contracts/schemas/`. Po zmene schém v Zod ju treba
pregenerovať cez `pnpm --filter @ooko/contracts schemas` (test to stráži). Editory s YAML
rozšírením podľa nej dopĺňajú polia priamo v súbore rubriky.

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

Projekt na Verceli je `ooko-api` (tím `bc-tp-e`). Každá vetva dostane preview nasadenie,
`02-backend` má stálu adresu `ooko-api-git-02-backend-bc-tp-e.vercel.app`. Preview je za
prihlásením Vercelu, z príkazového riadka cez `vercel curl /api/health --deployment <url>`.
Vetva `01-web-setup` (web projektu) sa nebuilduje (Ignored Build Step).

### Prečo je `includeFiles` v `vercel.json` taký dlhý

Lighthouse a `@sparticuz/chromium` čítajú súbory podľa cesty vypočítanej za behu, takže ich
Vercel pri trasovaní nenájde. Pribaliť ich treba pod skutočnou cestou v `node_modules/.pnpm/…`,
nie cez symlink v `apps/api/node_modules` (tam ich Lighthouse nehľadá). Balíky, ktoré Lighthouse
načítava dynamicky (`axe-core`, `csp_evaluator` …), idú do `node_modules/.pnpm/node_modules/`,
odkiaľ ich Node nájde z ľubovoľného balíka v `.pnpm`. Vercel povolí najviac 256 znakov, preto
hviezdičky. Ak po aktualizácii Lighthouse niečo chýba, v logoch funkcie bude `ENOENT` alebo
`Cannot find module` s presnou cestou.

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

Vercel (5. 11. 2026, `fra1`, Chromium 153, 3 volania): **Lighthouse dobehne**.

| | studený štart | teplé volanie |
|---|---|---|
| štart prehliadača | 3,6 s | 0,06 s |
| screenshoty (3 šírky) | 1,3 s | 1,3 s |
| axe | 0,7 s | 0,7 s |
| Lighthouse | 8,6 s | 7,0 s |
| spolu | 14,3 s | 9,0 s |

Funkcia má 78 MB, pamäť procesu 480–510 MB z 2 GB. Chromium musí bežať bez
`--single-process`, inak Lighthouse skončí po 30 s timeoutom.
