# Pracovný denník

Priebežný záznam práce na frontende aplikácie (`apps/web`). Každý deň pribudne nový záznam
dole. Cieľ: aby si ostatní vedeli rýchlo pozrieť, čo sa zmenilo a ako si to overiť sami.

---

## 2026-11-10

**Čo sme urobili**

- Založili `apps/web` — základná kostra SvelteKit aplikácie (Svelte 5, `adapter-vercel`,
  Node 24 runtime, dev proxy `/api` → `http://localhost:3000` podľa `docs/frontend.md`).
- Načítanie ukážkových rubrík (`webove-sidlo`, `osobna-stranka`, `formular`) z `rubrics/*.yaml`
  cez `parse_rubric`.
- Formulár: zadanie repozitára (URL) a výber rubriky.
- Formulár reálne volá `@ooko/client.analyze` (so skutočným `AbortController` a tlačidlom
  Zrušiť) — zatiaľ bez AI (`{ provider: 'none' }`), bez indikátora priebehu a bez
  plnohodnotného zobrazenia reportu, to je ďalší krok.
- Nájdená a opravená chyba: SvelteKit stránky renderuje aj na serveri (SSR), Vite pre to
  používa vlastnú konfiguráciu rozlíšenia modulov nezávislú od tej klientskej. Bez
  `ssr.resolve.conditions` v `vite.config.ts` hádzalo volanie `@ooko/contracts`/`@ooko/client`
  chybu `Failed to resolve entry for package`. Oprava je aj v `docs/frontend.md`, nech na to
  nenarazí nikto ďalší.
- Základný layout a styling: `src/app.css` (dočasné CSS premenné — farby, spacing, radius),
  `+layout.svelte` (záhlavie + vycentrovaný obsah), formulár v karte s farebnými bannerami pre
  chybu/úspech.

**Ako si to pozrieť**

```bash
git log --oneline a326838..7d904b2    # alebo: git log --oneline -8
```

Lokálne spustenie (dva terminály):

```bash
pnpm install
pnpm --filter @ooko/api dev      # API na http://localhost:3000
pnpm --filter @ooko/web dev      # web, vypíše adresu (zvyčajne http://localhost:5173)
```

Otvor vypísanú adresu, vyber rubriku, zadaj napr. `https://github.com/neear0/team-projekt-5`
a klikni Analyzovať. `/api/static` je reálny (vráti skutočné nálezy), `/api/runtime`
a `/api/ai` sú ešte stub.

**Čo chýba (ďalšie kroky)**

- Indikátor priebehu troch krokov analýzy (static/runtime/ai).
- Krajšie mapovanie chýb podľa `err.code` (zatiaľ len holá `err.message`).
- Zobrazenie reportu: body, kritériá, nálezy s odkazom na GitHub, screenshoty, Lighthouse.
- AI nastavenia (poskytovateľ, model, API kľúč) a nahratie vlastnej rubriky.
