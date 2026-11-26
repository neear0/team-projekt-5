# Zápisnica č. 4: stav projektu 26. 11. 2026

| | |
|---|---|
| **Projekt** | Autonómny agent na kontrolu webových projektov (Tímový projekt č. 5, Téma 6) |
| **Dátum** | 26. 11. 2026 |
| **Obdobie** | Týždeň 5 (23. 11. – 29. 11.): spojenie krokov, polovica projektu |

## Program

1. Stav úloh podľa Trella
2. Čo je hotové: aplikácia, nasadenie, prihlásenie
3. Výsledky testov na testovacích weboch
4. Nový postup pri nasadzovaní (vetva `deployment`)
5. Úlohy na ďalšie obdobie

## 1. Stav úloh podľa Trella

Úlohy z týždňov 1 až 4 sú splnené. Z týždňa 5 a z „Druhej polovice projektu“ je hotové viac,
ako bolo v pláne:

| Karta v Trelle | Stav |
|---|---|
| Backend: axe-core + Lighthouse v api/runtime | hotové |
| Backend: nasadenie krokov 1 a 2 na Vercel, JSON report | hotové (aj krok 3) |
| Backend: AI vrstva – spike (AI SDK + Gemini) | hotové, nahradené plnou AI vrstvou |
| AI vrstva: prompty, štruktúrovaný výstup (Zod), vision nad screenshotmi | hotové |
| AI vrstva: ochrana pred prompt injection + route api/ai | hotové |
| UI: zobrazenie reportu + nastavenia AI | report hotový, nastavenia AI chýbajú |
| Testovanie: kroky 1 a 2 na vzorkách | rozpracované (3 weby, pozri bod 3) |
| Zápisnica + aktualizácia stavu na webe | táto zápisnica |
| Polovica projektu: demo a retro | 29. 11. 2026 |

Karty v Trelle treba podľa tabuľky presunúť ako splnené.

## 2. Čo je hotové

- **Aplikácia beží celá na Verceli:** https://ooko-api.vercel.app (prístup heslom, heslo dá
  vedúci tímu, v repozitári ani na webe nie je).
- **Krok 1 (statická analýza):** stiahnutie repozitára, W3C validátory HTML a CSS, ESLint,
  pravidlá rubriky. Trvá 2 – 4 s.
- **Krok 2 (prehliadač):** Chromium na Verceli, screenshoty v šírkach 375, 768 a 1280 px,
  axe-core (prístupnosť) až na 10 stránkach, chyby v konzole, Lighthouse. Na Verceli 13 – 27 s.
  Zrýchlenie z 65 s: Chromium kreslí softvérovo namiesto emulácie GPU (SwiftShader).
- **Krok 3 (AI):** AI SDK, predvolene Gemini s kľúčom servera, voliteľne vlastný kľúč
  (Google, Anthropic, OpenAI, OpenAI-kompatibilné API). AI hodnotí iba kritériá s pokynom
  pre AI, body za merateľné pravidlá určujú nástroje. Kód študenta ide do promptu ako dáta,
  pokus ovplyvniť hodnotenie sa v reporte označí (overené). Keď je model Gemini preťažený,
  skúsi sa záložný model.
- **UI (SvelteKit):** formulár, priebeh analýzy, report s bodmi po častiach, zhodnotením od AI,
  Lighthouse skóre a nálezmi. Nasadené spolu s API na jednej adrese.
- **Prihlásenie:** jedno heslo pre celú aplikáciu, bez účtov. Chráni aj kľúč pre AI na serveri.
- **Testovacia stránka:** vzorový web `web-portfolio` (vetva `testovacia-stranka`).
- **Testy:** 142 automatických testov (Vitest), lint a kontrola typov v CI.

## 3. Výsledky testov na testovacích weboch

Produkcia, rubrika „Webové sídlo v HTML5 a CSS3“ (100 bodov), AI zapnutá:

| Web | Body | Poznámka |
|---|---|---|
| Ukážkový web bez chýb (z testov analyzátora) | 98,5 | Lighthouse 100 / 100 / 100 / 100 |
| Testovacia stránka `web-portfolio` | 96,25 | AI 80 s |
| Web projektu (`01-web-setup`) | 42,55 | chýba stránka s kontaktmi, meta značky, favicon … |

Zistenia:

- **Chyba v pravidle (falošný nesplnený výsledok):** efekt obrázka pri `:hover` je
  v `web-portfolio` zapísaný cez triedu (`.planeta-obr:hover`). Pravidlo vyžaduje, aby selektor
  obsahoval `img`, preto ho neuznalo, hoci efekt na obrázku je. Pravidlo treba upraviť.
- **AI dáva pri opakovaní mierne odlišné body** (web projektu 42,17 / 42,55 / 42,67). Rozdiel je
  do 0,5 bodu, ale treba ho sledovať pri porovnaní s ručným hodnotením.
- **Gemini býva preťažený** (odpoveď 503). Novšie modely (3.6 – 3.8 Flash) zlyhávali častejšie,
  preto server používa `gemini-3.5-flash` a záložné `gemini-flash-latest`,
  `gemini-3.5-flash-lite`. Analýza s AI trvá 1 – 3 minúty.

## 4. Nový postup pri nasadzovaní

- Vznikla vetva **`deployment`**. Je to produkčná vetva na Verceli: každý push do nej nasadí
  https://ooko-api.vercel.app.
- Hotová práca z vetiev (`02-backend`, `03-frontend` …) sa zlučuje do `deployment`, nie do
  `main`. Pred zlúčením musia prejsť `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- Web projektu zostáva vo vetve `01-web-setup` a na GitHub Pages, testovacia stránka vo vetve
  `testovacia-stranka`. Aplikácia ich analyzuje priamo z GitHubu, do `deployment` sa nezlučujú.
- Ostatné vetvy dostanú na Verceli preview, ktoré je navyše za prihlásením do Vercelu.

## Úlohy vyplývajúce zo stretnutia

| Úloha | Zodpovedá | Termín |
|---|---|---|
| Demo aplikácie a retro v polovici projektu | celý tím | 29. 11. 2026 |
| Upraviť pravidlo pre efekty obrázkov (`:hover` cez triedu obrázka) | Simon Škreko | 6. 12. 2026 |
| Export reportu (JSON, HTML, Markdown) a hromadné hodnotenie (zoznam repozitárov, CSV) | Simon Škreko | 13. 12. 2026 |
| UI: nastavenia AI (vlastný kľúč a model), nahratie vlastnej rubriky (YAML) | Marián Hollý | 6. 12. 2026 |
| UI: screenshoty a odkazy na riadky v GitHube v reporte, zobrazenie na mobile | Marián Hollý | 6. 12. 2026 |
| Testovacie weby so zámernými chybami ku každej rubrike, ručné hodnotenie vzoriek | Ondrej Potúček | 6. 12. 2026 |
| Porovnanie AI s ručným hodnotením a opakovateľnosť (každý web 3×) | Ondrej Potúček | 13. 12. 2026 |
| Web projektu: odkaz na aplikáciu, harmonogram a stav plnenia, stránka Dokumentácia | David Kocák | 6. 12. 2026 |
| Aktualizovať Trello podľa tejto zápisnice | David Kocák | 29. 11. 2026 |
| Finálna prezentácia (PDF): kostra a grafika vývoja | celý tím | 13. 12. 2026 |

## Ďalšie stretnutie

29. 11. 2026: demo a retro v polovici projektu (čas doplniť).
