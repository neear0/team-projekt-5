import { gunzipSync } from 'node:zlib';

/** Koľko môže mať stiahnutý archív (zbalený). */
export const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
/** Koľko môžu mať súbory spolu po rozbalení. */
export const MAX_UNPACKED_BYTES = 80 * 1024 * 1024;
export const MAX_FILES = 3000;

export type RepoErrorCode = 'not_found' | 'payload_too_large' | 'upstream_error';

export class RepoError extends Error {
  readonly code: RepoErrorCode;

  constructor(code: RepoErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface RepoRef {
  owner: string;
  repo: string;
  /** Vetva, tag alebo commit. `null` = predvolená vetva. */
  ref: string | null;
  /** Podpriečinok bez lomiek na krajoch, `''` = celý repozitár. */
  subdir: string;
}

/**
 * `https://github.com/vlastnik/repo[/tree/vetva[/cesta]]`. Vetva s lomkou v názve
 * (`feature/x`) sa nedá odlíšiť od cesty, berie sa iba prvý segment.
 */
export function parse_repo_url(url: string): RepoRef {
  const { pathname } = new URL(url);
  const parts = pathname.split('/').filter(Boolean);
  const [owner, repo_part, kind, ref, ...rest] = parts;
  if (!owner || !repo_part)
    throw new RepoError('not_found', 'V odkaze chýba vlastník alebo repozitár.');
  const repo = repo_part.replace(/\.git$/, '');
  if (kind === undefined) return { owner, repo, ref: null, subdir: '' };
  if ((kind !== 'tree' && kind !== 'blob') || !ref) {
    throw new RepoError('not_found', 'Odkaz má byť na repozitár alebo na /tree/vetva/priečinok.');
  }
  return {
    owner,
    repo,
    ref: decodeURIComponent(ref),
    subdir: rest.map(decodeURIComponent).join('/'),
  };
}

/** Súbory repozitára: cesta bez úvodnej lomky → obsah. */
export type RepoFiles = Map<string, Uint8Array>;

function read_string(block: Uint8Array, start: number, length: number): string {
  const slice = block.subarray(start, start + length);
  const end = slice.indexOf(0);
  return new TextDecoder().decode(end === -1 ? slice : slice.subarray(0, end));
}

function read_octal(block: Uint8Array, start: number, length: number): number {
  const text = read_string(block, start, length).trim();
  return text === '' ? 0 : parseInt(text, 8);
}

/** Pax hlavička: riadky `dĺžka kľúč=hodnota\n`. */
function parse_pax(data: Uint8Array): Map<string, string> {
  const result = new Map<string, string>();
  const text = new TextDecoder().decode(data);
  let pos = 0;
  while (pos < text.length) {
    const space = text.indexOf(' ', pos);
    if (space === -1) break;
    const length = parseInt(text.slice(pos, space), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = text.slice(space + 1, pos + length - 1);
    const eq = record.indexOf('=');
    if (eq !== -1) result.set(record.slice(0, eq), record.slice(eq + 1));
    pos += length;
  }
  return result;
}

/** Rozbalí tar (ustar + pax), vráti iba bežné súbory. */
export function untar(archive: Uint8Array): { path: string; data: Uint8Array }[] {
  const entries: { path: string; data: Uint8Array }[] = [];
  let offset = 0;
  let pax_path: string | null = null;
  let long_name: string | null = null;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const size = read_octal(header, 124, 12);
    const type = String.fromCharCode(header[156] ?? 0);
    const name = read_string(header, 0, 100);
    const prefix = read_string(header, 345, 155);
    const data_start = offset + 512;
    const data = archive.subarray(data_start, data_start + size);
    offset = data_start + Math.ceil(size / 512) * 512;

    if (type === 'x') {
      pax_path = parse_pax(data).get('path') ?? null;
      continue;
    }
    if (type === 'L') {
      long_name = read_string(data, 0, data.length);
      continue;
    }
    if (type === 'g') continue;

    const path = pax_path ?? long_name ?? (prefix ? `${prefix}/${name}` : name);
    pax_path = null;
    long_name = null;
    if (type === '0' || type === '\0') entries.push({ path, data });
  }
  return entries;
}

/** Odstráni koreňový priečinok archívu a nechá iba súbory z `subdir`. */
export function repo_files_from_archive(archive: Uint8Array, subdir: string): RepoFiles {
  const files: RepoFiles = new Map();
  const prefix = subdir === '' ? '' : `${subdir}/`;
  let total = 0;
  for (const { path, data } of untar(archive)) {
    const inner = path.split('/').slice(1).join('/');
    if (inner === '' || !inner.startsWith(prefix)) continue;
    const relative = inner.slice(prefix.length);
    if (relative.split('/').some((part) => part === '..' || part === '.git')) continue;
    total += data.length;
    if (files.size >= MAX_FILES || total > MAX_UNPACKED_BYTES) {
      throw new RepoError(
        'payload_too_large',
        'Repozitár má priveľa súborov alebo je príliš veľký.',
      );
    }
    files.set(relative, data);
  }
  if (files.size === 0) {
    throw new RepoError(
      'not_found',
      subdir ? `Priečinok „${subdir}“ je prázdny alebo neexistuje.` : 'Repozitár je prázdny.',
    );
  }
  return files;
}

export interface FetchRepoOptions {
  fetch?: typeof fetch;
  timeout_ms?: number;
}

/** Stiahne verejný repozitár ako tar.gz z codeload.github.com (bez API kľúča a jeho limitov). */
export async function fetch_repo(url: string, options: FetchRepoOptions = {}): Promise<RepoFiles> {
  const { owner, repo, ref, subdir } = parse_repo_url(url);
  const do_fetch = options.fetch ?? fetch;
  const archive_url = `https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tar.gz/${ref === null ? 'HEAD' : encodeURIComponent(ref)}`;

  let response: Response;
  try {
    response = await do_fetch(archive_url, {
      signal: AbortSignal.timeout(options.timeout_ms ?? 30_000),
      headers: { 'user-agent': 'ooko-analyzer' },
    });
  } catch {
    throw new RepoError('upstream_error', 'GitHub neodpovedá, skús to o chvíľu znova.');
  }
  if (response.status === 404) {
    throw new RepoError(
      'not_found',
      'Repozitár alebo vetva neexistuje, alebo repozitár nie je verejný.',
    );
  }
  if (!response.ok) {
    throw new RepoError('upstream_error', `GitHub vrátil chybu ${String(response.status)}.`);
  }
  if (Number(response.headers.get('content-length') ?? 0) > MAX_ARCHIVE_BYTES) {
    throw new RepoError('payload_too_large', 'Repozitár je príliš veľký.');
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
  if (!reader) throw new RepoError('upstream_error', 'GitHub vrátil prázdnu odpoveď.');
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_ARCHIVE_BYTES) {
      await reader.cancel();
      throw new RepoError('payload_too_large', 'Repozitár je príliš veľký.');
    }
    chunks.push(value);
  }

  let archive: Uint8Array;
  try {
    archive = gunzipSync(Buffer.concat(chunks), { maxOutputLength: MAX_UNPACKED_BYTES * 2 });
  } catch {
    throw new RepoError(
      'payload_too_large',
      'Archív repozitára sa nedá rozbaliť alebo je príliš veľký.',
    );
  }
  return repo_files_from_archive(archive, subdir);
}
