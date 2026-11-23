// Slovenské hlášky pre pravidlá axe-core, ktoré sa na weboch prvákov objavujú najčastejšie.
// axe nemá slovenskú lokalizáciu, pri ostatných pravidlách zostane jeho anglický popis.

interface AxeText {
  message: string;
  hint: string;
}

const TEXTS: Record<string, AxeText> = {
  'image-alt': {
    message: 'Obrázok nemá alternatívny text.',
    hint: 'Pridaj k <img> atribút alt s krátkym popisom obrázka (pri ozdobnom obrázku alt="").',
  },
  'input-image-alt': {
    message: 'Obrázkové tlačidlo nemá alternatívny text.',
    hint: 'Pridaj k <input type="image"> atribút alt, ktorý popisuje, čo tlačidlo urobí.',
  },
  'area-alt': {
    message: 'Oblasť obrázkovej mapy nemá alternatívny text.',
    hint: 'Pridaj ku každému <area> atribút alt s popisom cieľa odkazu.',
  },
  'svg-img-alt': {
    message: 'SVG s rolou obrázka nemá textový popis.',
    hint: 'Pridaj do <svg> element <title> alebo atribút aria-label.',
  },
  'role-img-alt': {
    message: 'Prvok s role="img" nemá textový popis.',
    hint: 'Pridaj atribút aria-label alebo aria-labelledby.',
  },
  'object-alt': {
    message: 'Element <object> nemá textový popis.',
    hint: 'Pridaj atribút aria-label alebo title.',
  },
  'image-redundant-alt': {
    message: 'Alternatívny text obrázka opakuje text, ktorý je hneď vedľa.',
    hint: 'Ak text vedľa obrázok už popisuje, daj obrázku alt="".',
  },
  'color-contrast': {
    message: 'Text má príliš slabý kontrast s pozadím.',
    hint: 'Stmav text alebo zosvetli pozadie. Bežný text potrebuje kontrast aspoň 4,5 : 1.',
  },
  'link-in-text-block': {
    message: 'Odkaz v texte sa dá odlíšiť iba farbou.',
    hint: 'Nechaj odkazy podčiarknuté alebo im daj výraznejší kontrast s okolitým textom.',
  },
  label: {
    message: 'Pole formulára nemá popisok.',
    hint: 'Pridaj <label for="id-pola"> alebo vlož pole priamo do <label>.',
  },
  'select-name': {
    message: 'Výberový zoznam <select> nemá popisok.',
    hint: 'Pridaj <label for="id-zoznamu"> k <select>.',
  },
  'form-field-multiple-labels': {
    message: 'Pole formulára má viac popiskov naraz.',
    hint: 'Nechaj pri každom poli iba jeden <label>.',
  },
  'label-title-only': {
    message: 'Pole formulára má popis iba v atribúte title.',
    hint: 'Pridaj viditeľný <label>, title sa zobrazí až po podržaní myši.',
  },
  'autocomplete-valid': {
    message: 'Atribút autocomplete má neplatnú hodnotu.',
    hint: 'Použi štandardnú hodnotu, napr. name, email, tel alebo off.',
  },
  'link-name': {
    message: 'Odkaz nemá text, ktorý by čítačka obrazovky prečítala.',
    hint: 'Daj do <a> text, alebo obrázku v odkaze atribút alt, ktorý popisuje cieľ odkazu.',
  },
  'button-name': {
    message: 'Tlačidlo nemá text.',
    hint: 'Daj do <button> text alebo mu pridaj atribút aria-label.',
  },
  'nested-interactive': {
    message: 'Ovládací prvok je vnorený do iného ovládacieho prvku.',
    hint: 'Nevkladaj odkazy a tlačidlá do seba, napr. <button> do <a>.',
  },
  'html-has-lang': {
    message: 'Stránka nemá uvedený jazyk.',
    hint: 'Pridaj do <html> atribút lang, napr. <html lang="sk">.',
  },
  'html-lang-valid': {
    message: 'Jazyk stránky v atribúte lang je neplatný.',
    hint: 'Použi kód jazyka, napr. lang="sk" alebo lang="en".',
  },
  'valid-lang': {
    message: 'Atribút lang má neplatnú hodnotu.',
    hint: 'Použi kód jazyka, napr. lang="en".',
  },
  'document-title': {
    message: 'Stránka nemá názov.',
    hint: 'Pridaj do <head> neprázdny <title>.',
  },
  'meta-viewport': {
    message: 'Stránka zakazuje priblíženie na mobile.',
    hint: 'Odstráň z <meta name="viewport"> user-scalable=no a maximum-scale.',
  },
  'meta-refresh': {
    message: 'Stránka sa sama obnovuje alebo presmerúva cez <meta http-equiv="refresh">.',
    hint: 'Odstráň automatické obnovenie, používateľ ho nevie zastaviť.',
  },
  'heading-order': {
    message: 'Úrovne nadpisov preskakujú (napr. po <h1> hneď <h3>).',
    hint: 'Nadpisy používaj postupne: h1, potom h2, potom h3. Veľkosť nastav cez CSS.',
  },
  'empty-heading': {
    message: 'Nadpis je prázdny.',
    hint: 'Daj do nadpisu text alebo prázdny nadpis odstráň.',
  },
  'page-has-heading-one': {
    message: 'Stránka nemá hlavný nadpis <h1>.',
    hint: 'Pridaj na stránku jeden <h1> s názvom stránky.',
  },
  'landmark-one-main': {
    message: 'Stránka nemá element <main>.',
    hint: 'Hlavný obsah stránky obaľ do <main>.',
  },
  region: {
    message: 'Časť obsahu je mimo sémantických oblastí stránky.',
    hint: 'Všetok obsah daj do <header>, <nav>, <main>, <aside> alebo <footer>.',
  },
  'landmark-unique': {
    message: 'Viac oblastí rovnakého druhu sa nedá od seba odlíšiť.',
    hint: 'Daj každej z nich iný aria-label, napr. dvom <nav>.',
  },
  'landmark-no-duplicate-banner': {
    message: 'Stránka má viac hlavičiek <header> na najvyššej úrovni.',
    hint: 'Nechaj iba jeden <header> mimo <article> a <section>.',
  },
  'landmark-no-duplicate-contentinfo': {
    message: 'Stránka má viac pätičiek <footer> na najvyššej úrovni.',
    hint: 'Nechaj iba jeden <footer> mimo <article> a <section>.',
  },
  'landmark-no-duplicate-main': {
    message: 'Stránka má viac elementov <main>.',
    hint: 'Na stránke má byť iba jeden <main>.',
  },
  'landmark-complementary-is-top-level': {
    message: 'Element <aside> je vnorený do inej oblasti stránky.',
    hint: 'Daj <aside> priamo do <body> alebo <main>.',
  },
  list: {
    message: 'Zoznam obsahuje aj iné elementy ako <li>.',
    hint: 'Priamo v <ul> a <ol> môžu byť iba <li> (prípadne <script> a <template>).',
  },
  listitem: {
    message: 'Položka <li> nie je v zozname.',
    hint: 'Daj <li> do <ul> alebo <ol>.',
  },
  'definition-list': {
    message: 'Definičný zoznam <dl> obsahuje nesprávne elementy.',
    hint: 'V <dl> môžu byť iba dvojice <dt> a <dd> (prípadne obalené v <div>).',
  },
  dlitem: {
    message: 'Element <dt> alebo <dd> nie je v <dl>.',
    hint: 'Daj <dt> a <dd> do definičného zoznamu <dl>.',
  },
  'frame-title': {
    message: 'Element <iframe> nemá názov.',
    hint: 'Pridaj k <iframe> atribút title, ktorý popisuje jeho obsah.',
  },
  'video-caption': {
    message: 'Video nemá titulky.',
    hint: 'Pridaj do <video> element <track kind="captions">.',
  },
  'td-headers-attr': {
    message: 'Bunka tabuľky odkazuje na neexistujúcu hlavičku.',
    hint: 'Atribút headers musí obsahovať id buniek <th> z tej istej tabuľky.',
  },
  'th-has-data-cells': {
    message: 'Hlavička tabuľky <th> nepatrí k žiadnym bunkám.',
    hint: 'Skontroluj štruktúru tabuľky alebo nahraď prázdne <th> za <td>.',
  },
  'scrollable-region-focusable': {
    message: 'Posúvateľná oblasť sa nedá ovládať klávesnicou.',
    hint: 'Pridaj jej tabindex="0", alebo do nej daj odkaz či tlačidlo.',
  },
  tabindex: {
    message: 'Prvok má tabindex väčší ako 0.',
    hint: 'Použi tabindex="0" alebo -1 a poradie nechaj podľa HTML.',
  },
  bypass: {
    message: 'Stránka nemá spôsob, ako preskočiť opakujúci sa obsah.',
    hint: 'Pridaj <main> alebo odkaz „Preskočiť na obsah“ na začiatok stránky.',
  },
  'duplicate-id-aria': {
    message: 'Viac prvkov má rovnaké id, na ktoré odkazuje popisok alebo ARIA.',
    hint: 'Každé id musí byť na stránke iba raz.',
  },
  marquee: {
    message: 'Stránka používa zastaraný element <marquee>.',
    hint: 'Odstráň <marquee>, pohyb sa dá spraviť cez CSS animáciu.',
  },
  blink: {
    message: 'Stránka používa zastaraný element <blink>.',
    hint: 'Odstráň <blink>.',
  },
};

/** Slovenská hláška a rada pre pravidlo axe, `null`, ak ju nemáme. */
export function axe_text(rule_id: string): AxeText | null {
  return TEXTS[rule_id] ?? null;
}
