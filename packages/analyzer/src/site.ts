import { posix } from 'node:path';
import { selectAll } from 'css-select';
import type { AnyNode, Document, Element } from 'domhandler';
import { textContent } from 'domutils';
import { parseDocument } from 'htmlparser2';
import postcss, { type Root } from 'postcss';
import type { Finding } from '@ooko/contracts';

const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.mjs']);

/** Prevod pozície v texte na riadok (od 1). */
export class LineIndex {
  readonly #starts: number[] = [0];

  constructor(text: string) {
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) this.#starts.push(i + 1);
  }

  line(offset: number): number {
    let lo = 0;
    let hi = this.#starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.#starts[mid] ?? 0) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }
}

export interface Page {
  path: string;
  source: string;
  dom: Document;
  lines: LineIndex;
}

export interface Stylesheet {
  /** Súbor, v ktorom CSS je (pri <style> je to HTML stránka). */
  path: string;
  source: string;
  /** `null`, ak CSS nejde parsovať. */
  root: Root | null;
  /** O koľko riadkov je CSS posunuté v súbore (pri <style>). */
  line_offset: number;
  inline: boolean;
}

export interface Script {
  path: string;
  source: string;
  line_offset: number;
  inline: boolean;
}

export interface Site {
  /** Všetky súbory repozitára (aj obrázky), aby sa dali overiť odkazy. */
  paths: ReadonlySet<string>;
  pages: Page[];
  styles: Stylesheet[];
  scripts: Script[];
  /** Problémy pri načítaní (nečitateľné CSS a pod.). */
  findings: Finding[];
}

export function extension(path: string): string {
  return posix.extname(path).toLowerCase();
}

export function is_page(path: string): boolean {
  const ext = extension(path);
  return ext === '.html' || ext === '.htm';
}

function decode(data: Uint8Array): string {
  // TextDecoder sám odstráni BOM na začiatku súboru.
  return new TextDecoder('utf-8').decode(data);
}

function parse_css(
  source: string,
  path: string,
  line_offset: number,
  findings: Finding[],
): Root | null {
  try {
    return postcss.parse(source, { from: path });
  } catch (err) {
    const e = err as { reason?: string; line?: number };
    findings.push({
      tool: 'postcss',
      rule_id: 'css.syntax',
      severity: 'error',
      message: `CSS sa nedá prečítať: ${e.reason ?? String(err)}`,
      file: path,
      ...(e.line !== undefined && { line: e.line + line_offset }),
      hint: 'Skontroluj zátvorky { } a bodkočiarky v okolí tohto riadku.',
    });
    return null;
  }
}

export function element_line(page: Page, el: Element): number {
  return page.lines.line(el.startIndex ?? 0);
}

/** Načíta web zo súborov repozitára. */
export function load_site(files: ReadonlyMap<string, Uint8Array>): Site {
  const findings: Finding[] = [];
  const pages: Page[] = [];
  const styles: Stylesheet[] = [];
  const scripts: Script[] = [];

  const sorted = [...files.keys()].sort();
  for (const path of sorted) {
    const ext = extension(path);
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const source = decode(files.get(path) ?? new Uint8Array());

    if (ext === '.css') {
      styles.push({
        path,
        source,
        root: parse_css(source, path, 0, findings),
        line_offset: 0,
        inline: false,
      });
    } else if (ext === '.js' || ext === '.mjs') {
      scripts.push({ path, source, line_offset: 0, inline: false });
    } else {
      const dom = parseDocument(source, { withStartIndices: true, withEndIndices: true });
      const page: Page = { path, source, dom, lines: new LineIndex(source) };
      pages.push(page);

      for (const el of selectAll<AnyNode, Element>('style', dom)) {
        const css = textContent(el);
        const line_offset = element_line(page, el) - 1;
        styles.push({
          path,
          source: css,
          root: parse_css(css, path, line_offset, findings),
          line_offset,
          inline: true,
        });
      }
      for (const el of selectAll<AnyNode, Element>('script:not([src])', dom)) {
        const type = el.attribs.type?.toLowerCase();
        if (type && type !== 'module' && !type.includes('javascript')) continue;
        scripts.push({
          path,
          source: textContent(el),
          line_offset: element_line(page, el) - 1,
          inline: true,
        });
      }
    }
  }

  return { paths: new Set(files.keys()), pages, styles, scripts, findings };
}

export type LinkTarget =
  | { kind: 'external' }
  | { kind: 'fragment'; fragment: string }
  | { kind: 'local'; path: string; fragment: string | null };

/**
 * Kam vedie odkaz zo stránky `from`. Cesty sa porovnávajú presne (GitHub Pages rozlišuje
 * veľké a malé písmená). Priečinok `foto/` znamená `foto/index.html`.
 */
export function resolve_link(from: string, href: string): LinkTarget | null {
  const value = href.trim();
  if (value === '') return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return { kind: 'external' };
  if (value.startsWith('#')) return { kind: 'fragment', fragment: value.slice(1) };

  const hash = value.indexOf('#');
  const fragment = hash === -1 ? null : value.slice(hash + 1);
  let path_part = (hash === -1 ? value : value.slice(0, hash)).split('?')[0] ?? '';
  try {
    path_part = decodeURIComponent(path_part);
  } catch {
    // Nechá sa tak, ako je.
  }
  if (path_part === '') return { kind: 'fragment', fragment: fragment ?? '' };

  const base = path_part.startsWith('/') ? '/' : `/${posix.dirname(from)}/`;
  let path = posix.normalize(posix.join(base, path_part)).replace(/^\/+/, '');
  if (path === '' || path.endsWith('/')) path += 'index.html';
  return { kind: 'local', path, fragment };
}

/** Ak súbor neexistuje, nájde ho s inými veľkými/malými písmenami (častá chyba na GitHub Pages). */
export function case_mismatch(paths: ReadonlySet<string>, path: string): string | null {
  const lower = path.toLowerCase();
  for (const p of paths) if (p.toLowerCase() === lower) return p;
  return null;
}
