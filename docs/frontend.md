# UI webovej aplikácie: čo je pripravené

Backend je hotový tak, aby sa UI dalo robiť hneď. Tvar dát sa už nemení, aj keď kroky 2 a 3
zatiaľ vracajú ukážkové hodnoty (pozri [Čo ešte nie je hotové](#čo-ešte-nie-je-hotové)).

## Čo budeš používať

| Čo                                                              | Na čo                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/web`                                                      | sem príde aplikácia (Astro podľa README, nový balík vo workspace) |
| `@ooko/client`                                                  | volania API, celá analýza jedným volaním, report, pomocné funkcie |
| `@ooko/contracts`                                               | typy všetkých dát, `parse_rubric` na YAML rubriky                 |
| `rubrics/*.yaml`                                                | hotové rubriky (zadania), napr. `webove-sidlo.yaml`               |
| `docs/examples/*.json`                                          | skutočné odpovede API na kreslenie obrazoviek bez servera         |
| CSS premenné z `style.css` webu projektu (vetva `01-web-setup`) | spoločný vzhľad s webom projektu                                  |

Všetko je v TypeScripte a beží v prehliadači, nič z toho nepotrebuje Node.

## Rozbehnutie

```bash
pnpm install
pnpm --filter @ooko/api dev        # API na http://localhost:3000
```

V `apps/web/package.json`:

```json
"dependencies": {
  "@ooko/client": "workspace:*",
  "@ooko/contracts": "workspace:*",
  "zod": "^4.6.7"
}
```

V `astro.config.mjs` presmerovanie `/api` na lokálne API a čítanie balíkov zo zdrojákov
(bez neho by bolo treba po každej zmene v `packages/` spustiť `pnpm build`):

```js
import { defineConfig } from 'astro/config';
import { defaultClientConditions } from 'vite';

export default defineConfig({
  vite: {
    resolve: { conditions: ['source', ...defaultClientConditions] },
    server: { proxy: { '/api': 'http://localhost:3000' } },
  },
});
```

API zatiaľ nemá CORS, preto proxy. Aplikácia volá `/api/...` na tej istej adrese, z ktorej
sa načítala.

## Celá analýza

```ts
import { create_client, ApiError } from '@ooko/client';
import { parse_rubric } from '@ooko/contracts';
import rubric_yaml from '../../../rubrics/webove-sidlo.yaml?raw';

const client = create_client();

const parsed = parse_rubric(rubric_yaml);
if (!parsed.success) throw new Error('chybná rubrika'); // parsed.issues: { path, message, line? }

try {
  const analysis = await client.analyze(
    {
      repo_url: 'https://github.com/student/web',
      rubric: parsed.rubric,
      ai: { provider: 'none' },
    },
    {
      signal: controller.signal, // tlačidlo Zrušiť
      on_progress: (step, state) => {
        // step: 'static' | 'runtime' | 'ai', state: 'running' | 'done'
      },
    },
  );
  analysis.report; // report na zobrazenie a stiahnutie
  analysis.static.files; // zdrojáky študenta
  analysis.runtime.screenshots; // screenshoty
} catch (err) {
  if (err instanceof ApiError) {
    err.message; // po slovensky, dá sa rovno ukázať
    err.code; // pozri tabuľku chýb
    err.issues; // pri bad_request: [{ path: 'repo_url', message }]
  }
}
```

`analyze` spustí kroky 1 a 2 naraz, potom krok 3 a nakoniec poskladá report. Jednotlivé
kroky sa dajú volať aj samostatne: `client.static_step`, `client.runtime_step`,
`client.ai_step`, `client.health`.

## Kroky a ako dlho trvajú

| Krok | Endpoint            | Trvanie                      | Vracia                                                  |
| ---- | ------------------- | ---------------------------- | ------------------------------------------------------- |
| 1    | `POST /api/static`  | 1–5 s                        | `files`, `findings`, `rule_results`                     |
| 2    | `POST /api/runtime` | 10–20 s, prvé volanie dlhšie | `screenshots`, `lighthouse`, `findings`, `rule_results` |
| 3    | `POST /api/ai`      | závisí od modelu             | `summary`, `criteria` s bodmi                           |

Server zruší požiadavku po 300 s. Krok 2 je dosť dlhý na to, aby si ukazoval, ktorý krok
práve beží.

## Čo zobraziť

Typy sú v `packages/contracts/src/`, presný tvar vidno v `docs/examples/`.

**Report** (`Report`, súbor `*.report.json`)

- `points` / `max_points`: celkové body.
- `criteria[]`: `title`, `points`, `max_points`, `reasoning` (zdôvodnenie), `findings`.
  Kritériá môžu mať `group` (napr. „1. časť: HTML5“). `group_criteria(criteria)` ich rozdelí
  na skupiny aj so súčtom bodov.
- `summary`: celkové zhodnotenie od AI, `null` bez AI.
- `lighthouse`: štyri skóre 0–100 (`performance`, `accessibility`, `best_practices`, `seo`)
  alebo `null`.
- `findings`: všetky nálezy spolu.

**Nález** (`Finding`): `severity` (`error` / `warning` / `info`), `message`, `file`, `line`,
`column`, `hint` (rada, ako to opraviť). Všetko okrem `message` môže chýbať.
`github_line_url(repo_url, file, line)` vráti odkaz na riadok na GitHube.

**Pravidlá kritéria** (`RuleResult`): na zoznam „čo prešlo a čo nie“ pod kritériom.
`rule_results_by_criterion(analysis.static, analysis.runtime)` ich vráti podľa `criterion_id`.
Pravidlo so `skipped: true` sa nedalo overiť (napr. nedostupný W3C validátor). Nie je to chyba
študenta, zobraz ho inak ako neúspech.

**Screenshoty** (`analysis.runtime.screenshots`): `width` (napr. 375, 768, 1280) a obrázok,
`<img src={screenshot_src(s)}>`.

**Zdrojáky** (`analysis.static.files`): `path` a `content`, napr. na zobrazenie kódu
so zvýraznenými riadkami z nálezov.

## Formulár

- **Repozitár:** iba `https://github.com/vlastnik/repo`, voliteľne `/tree/vetva/priecinok`.
  Repozitár musí byť verejný.
- **Rubrika:** výber z `rubrics/*.yaml` alebo nahratie vlastného YAML. `parse_rubric` vráti
  chyby s cestou a riadkom, dajú sa ukázať v editore. JSON Schema rubriky
  (`packages/contracts/schemas/rubric.schema.json`) sa dá použiť na dopĺňanie v editore.
  Hlášky zo `parse_rubric` budú po slovensky, ak raz zavoláš
  `z.config(z.locales.sk())` (`import { z } from 'zod'`).
- **AI** (`AiConfig`):
  - `{ provider: 'none' }`: bez AI, body iba za pravidlá.
  - `{ provider: 'google' | 'anthropic' | 'openai', model, api_key }`.
  - `{ provider: 'openai-compatible', base_url, model, api_key? }`: vlastný server.

API kľúč používateľa sa nikde neukladá na serveri a do reportu sa nedostane. V prehliadači ho
drž iba v pamäti, prípadne v `sessionStorage`, nie v `localStorage`.

## Chyby

| `err.code`                 | Kedy                                                        | Čo ukázať                          |
| -------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| `bad_request`              | zlé pole (`err.issues`), napr. URL mimo GitHubu             | chybu pri danom poli               |
| `not_found`                | repozitár alebo vetva neexistuje, alebo nie je verejný      | `err.message`                      |
| `payload_too_large`        | repozitár je väčší ako 25 MB alebo má viac ako 3000 súborov | `err.message`                      |
| `upstream_error`           | GitHub alebo AI neodpovedá                                  | `err.message`, ponúknuť opakovanie |
| `timeout`                  | krok trval dlhšie ako 300 s                                 | ponúknuť opakovanie                |
| `network`                  | server je nedostupný                                        | ponúknuť opakovanie                |
| `aborted`                  | používateľ zrušil analýzu                                   | nič                                |
| `internal`, `bad_response` | chyba u nás                                                 | `err.message`                      |

Ukážka tela chyby: `docs/examples/chyba-404.json`.

## Ukážkové dáta

`docs/examples/` obsahuje odpovede všetkých krokov a hotový report pre rubriku
`webove-sidlo.yaml`:

- `web-s-chybami.*`: web projektu (vetva `01-web-setup`), 40,67 zo 100 bodov, veľa nálezov.
- `web-bez-chyb.*`: ukážkový web z testov, 96 zo 100 (4 body sú za kritériá, ktoré hodnotí
  iba AI).
- `rubric.json`: rubrika tak, ako ju vráti `parse_rubric`.

Pregenerovanie zo skutočného API: `pnpm --filter @ooko/api examples`.

## Čo ešte nie je hotové

- **Krok 2** vracia pevné skóre Lighthouse a žiadne screenshoty. Prehliadač na serveri už
  funguje, zapojí sa do endpointu.
- **Krok 3** nevolá AI. Body za pravidlá počíta naozaj, kritériá iba pre AI dostanú 0 bodov.
- **Nasadenie UI** zatiaľ nie je rozhodnuté. Najjednoduchšie je dať UI do toho istého Vercel
  projektu ako API (jedna adresa, netreba CORS). Ak bude UI inde, treba na API pridať CORS.
- **Lokálny model (Ollama)** z README zatiaľ nie je.
