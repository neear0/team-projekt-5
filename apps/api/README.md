# Ooko API

Backend webovej aplikácie: Vercel Functions v `api/`, logika v `packages/*`.

| Endpoint | Metóda | Stav |
|---|---|---|
| `/api/health` | GET | verzia, región, `server_ai` (server má kľúč pre AI); bez prihlásenia |
| `/api/login` | POST `{ password }` | prihlásenie, nastaví cookie `ooko_session` |
| `/api/logout` | POST | odhlásenie |
| `/api/static` | POST `{ repo_url, rubric }` | krok 1: stiahne repozitár, vyhodnotí statické pravidlá (`packages/analyzer`) |
| `/api/runtime` | POST `{ repo_url, rubric }` | krok 2: otvorí web v Chromiu, screenshoty, axe, konzola, Lighthouse (`packages/runtime`) |
| `/api/ai` | POST `{ ai, rubric, static, runtime }` | krok 3: body za pravidlá a hodnotenie kritérií s pokynom pre AI (`packages/ai`) |
| `/api/probe` | GET | prototyp etapy 1, na produkcii vypnutý |

Tvar požiadaviek a odpovedí je v `packages/contracts`. Chyby majú vždy tvar
`{ "error": { "code", "message", "issues"? } }`.

## Prihlásenie

Celý projekt na Verceli (stránky aj API okrem `/api/health`, `/api/login`, `/api/logout`
a `/login.html`) je iba pre prihlásených. Účty nie sú, je jedno heslo pre všetkých.

| Premenná (Vercel → Settings → Environment Variables) | Na čo |
|---|---|
| `APP_PASSWORD` | heslo, **povinné** na Verceli. Bez neho API vráti 503 a nepustí nikoho. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | voliteľne kľúč a model servera pre `{ provider: 'server' }`, iba pre prihlásených. `GEMINI_MODEL` môže byť zoznam, napr. `gemini-3.5-flash,gemini-2.5-flash`: pri preťažení (503) alebo limite (429) sa skúsi ďalší model. |

```bash
vercel env add APP_PASSWORD          # pre Production aj Preview
vercel env add GEMINI_API_KEY
vercel env add GEMINI_MODEL          # napr. aktuálny model Flash z Google AI Studio
```

- **Ako to funguje:** `/login.html` pošle heslo na `/api/login`. Pri zhode server nastaví cookie
  `ooko_session` (HttpOnly, Secure, SameSite=Lax, 7 dní) s platnosťou podpísanou HMAC-SHA256
  kľúčom odvodeným z hesla (`lib/session.ts`). Zmena hesla odhlási všetkých.
- **Dve vrstvy:** `middleware.ts` (Vercel Routing Middleware) presmeruje stránky na
  `/login.html?next=…` a na `/api/*` vráti 401. Funkcie to overujú aj samy (`lib/auth.ts`),
  takže API ostane zamknuté, aj keby middleware nebežal.
- **Hádanie hesla:** zlý pokus trvá 1,5 s. Počet pokusov server nepočíta (nemá databázu), preto
  zvoľ dlhé náhodné heslo. Pri útoku sa dá zapnúť Vercel Firewall (rate limit na `/api/login`).
- **Lokálne** bez `APP_PASSWORD` je všetko otvorené. S ním sa správa ako na Verceli:
  `APP_PASSWORD=… pnpm --filter @ooko/api dev` a otvoriť `http://localhost:3000/login.html`.
- **UI aplikácie:** ak bude v tomto Vercel projekte, chráni ho ten istý middleware. Na chybu
  `unauthorized` z API má poslať používateľa na `/login.html?next=<aktuálna adresa>`.

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

`/api/runtime` a `/api/probe` potrebujú prehliadač: `BROWSER_CHANNEL=msedge` (alebo `chrome`),
`CHROMIUM_PATH=...`, alebo `pnpm --filter @ooko/runtime exec playwright-core install chromium`.
Samotný prototyp bez servera: `pnpm --filter @ooko/runtime probe`.

## Vercel

Nový projekt z GitHub repozitára:

- **Root Directory:** `apps/api`
- **Framework Preset:** Other (zvyšok berie `vercel.json`)
- **Include files outside the root directory:** zapnuté (predvolene áno)
- **Node.js:** 24.x (z `engines` v `package.json`)

Build (`pnpm run build`) zostaví balíky z `packages/` do `dist/` (funkcie ich importujú
odtiaľ), potom UI z `apps/web` ako statické stránky a `scripts/static.ts` ich spolu s `public/`
(prihlásenie) skopíruje do `static/`, ktorý Vercel servíruje. UI a API sú tak na jednej adrese
za tým istým prihlásením.

Projekt na Verceli je `ooko-api` (tím `bc-tp-e`). **Produkčná vetva je `deployment`**: do nej sa
zlučujú hotové vetvy (`02-backend`, `03-frontend` …) a každý push do nej nasadí produkciu.
Ostatné vetvy dostanú preview nasadenie, ktoré je navyše za prihlásením Vercelu, z príkazového
riadka cez `vercel curl /api/health --deployment <url>`.
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

## Krok 1: statická analýza

`packages/analyzer` stiahne repozitár ako tar.gz z `codeload.github.com` (bez API kľúča,
limit 25 MB zbalený, 3000 súborov), rozbalí ho v pamäti a vyhodnotí pravidlá rubriky.
HTML a CSS validuje cez verejné služby W3C (Nu Html Checker, CSS Validator), najviac
25 súborov, 3 naraz. Keď W3C neodpovedá, pravidlo má `skipped: true` a body sa zaň nerátajú.
Odkaz `/tree/vetva/priecinok` analyzuje iba priečinok, vetva s lomkou v názve nie je podporovaná.

Ukážkový web, ktorý spĺňa celú rubriku `webove-sidlo.yaml`, je v
`packages/analyzer/test/fixtures/webove-sidlo/`.

## Krok 2: runtime analýza

`packages/runtime` stiahne repozitár rovnako ako krok 1, naservíruje ho na `127.0.0.1` vo vnútri
funkcie a otvorí ho v Chromiu:

- **Screenshoty** úvodnej stránky (`index.html`, inak stránka najbližšie ku koreňu) v šírkach
  375, 768 a 1280 px, JPEG najviac 2400 px na výšku a ~350 kB, aby sa zmestili do kroku 3
  (limit 4,5 MB na telo požiadavky).
- **axe-core** a **chyby v konzole** na najviac 10 stránkach. Porušenia majú slovenskú hlášku
  (`src/axe_sk.ts`, najčastejšie pravidlá) a riadok v zdrojáku, ak sa prvok dá nájsť podľa
  selektora. Prvky vo vnorených rámoch (PDF, YouTube) sa ignorujú.
- **Lighthouse** iba na úvodnej stránke. Keď nedobehne, `lighthouse` je `null` a pravidlá
  `lighthouse.*` majú `skipped: true`.

Zacyklený skript študenta nezasekne krok: každá operácia so stránkou má timeout 20 s a po 120 s
sa ďalšie stránky už nekontrolujú. Integračný test so skutočným prehliadačom beží iba
s `BROWSER_CHANNEL` alebo `CHROMIUM_PATH` (v CI `chrome`).

Každé volanie zapíše do logu funkcie riadok `{"step":"runtime","timings_ms":{…}}` s trvaním
fáz (štart, screenshoty, načítanie a axe pre každú stránku, Lighthouse), čítať sa dá cez
`vercel logs --deployment <url> --json`.

Vercel (23. 11. 2026, `fra1`), trvanie funkcie:

| Web (4 stránky) | screenshoty | axe | Lighthouse | spolu |
|---|---|---|---|---|
| ukážkový web z testov | 0,4 s | 2,3 s | 6,1 s | 9 s |
| web projektu (`01-web-setup`) | 1,1 s | 5,4 s | 6,4 s | 13 s (studený štart 18 s) |

Chromium z `@sparticuz/chromium` predvolene kreslí cez SwiftShader (emuláciu GPU). Na 1 vCPU
je to pri `backdrop-filter: blur()` a podobných efektoch extrémne pomalé: web projektu trval
65 s (screenshoty 20 s, axe 27 s). S `--disable-gpu` (softvérové vykresľovanie) 13 s pri
rovnakých výsledkoch, pozri `serverless_args` v `src/browser.ts`.

## Krok 3: AI hodnotenie

`packages/ai` volá model cez [AI SDK](https://ai-sdk.dev/) podľa `ai` v požiadavke: `google`,
`anthropic`, `openai` alebo `openai-compatible` (vlastný server, napr. OpenRouter). Kľúč
posiela prehliadač s každou požiadavkou, server ho nikde neukladá ani neloguje.

**Body.** Kritérium má jeden diel za každé overené pravidlo a jeden diel za pokyn `ai`, ak AI
beží. AI vracia, na koľko percent je kritérium splnené. Pravidlá teda AI neprebije, v kritériu
s pravidlami má iba svoj diel. Preskočené pravidlá (nedostupný W3C validátor) sa nerátajú, body
za ne študent nestratí. Bez AI (`provider: 'none'`) majú kritériá iba pre AI 0 bodov.

**Prompt** (`src/prompt.ts`): pokyny sú iba v systémovej časti. Rubrika (iba kritériá s `ai`
a výsledky ich pravidiel), Lighthouse, najviac 60 nálezov nástrojov, screenshoty a kód študenta
s číslami riadkov (najviac 300 000 znakov) idú do správy používateľa. Kód je v značkách
`<subor>` a študent ich nevie zavrieť. Model má pokusy ovplyvniť hodnotenie vrátiť
v `manipulation`, z nich sú nálezy `ai.manipulation` vo `findings` odpovede.

**Kontrola výstupu.** Odpoveď sa overí Zod schémou (`src/schema.ts`). Pri neplatnom tvare alebo
vynechanom kritériu sa volanie raz zopakuje. Percentá sa orežú na 0–100, súbor a riadok
z nálezu zostanú, iba ak v repozitári naozaj sú.

**Vlastný server** (`openai-compatible`) musí mať verejnú adresu `https://`. Lokálne
a privátne adresy server odmietne, aby sa cez nás nedalo dostať do vnútornej siete. Ollama
a LM Studio sa majú volať priamo z prehliadača.

| Chyba | Kód | HTTP |
|---|---|---|
| zlý kľúč (401/403), neexistujúci model (404), iná 4xx | `bad_request` | 400 |
| limit (429), výpadok poskytovateľa, neplatná odpoveď aj na druhý pokus, viac ako 240 s | `upstream_error` | 502 |

Do logu ide iba `{"step":"ai","code","message","cause","status"}`, nie prompt.

Testy používajú `MockLanguageModelV4` z `ai/test`, kľúč netreba.
