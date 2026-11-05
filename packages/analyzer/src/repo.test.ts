import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { fetch_repo, parse_repo_url, RepoError, repo_files_from_archive, untar } from './repo.ts';

function header(name: string, size: number, type: string): Uint8Array {
  const block = new Uint8Array(512);
  const write = (text: string, offset: number) => {
    block.set(new TextEncoder().encode(text), offset);
  };
  write(name.slice(0, 99), 0);
  write('0000644\0', 100);
  write(size.toString(8).padStart(11, '0') + '\0', 124);
  write(type, 156);
  write('ustar\0', 257);
  return block;
}

function pad(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.ceil(data.length / 512) * 512);
  out.set(data);
  return out;
}

/** Tar v tvare, aký posiela GitHub: globálna pax hlavička, koreňový priečinok, dlhé cesty cez pax. */
function make_tar(files: Record<string, string>): Uint8Array {
  const parts: Uint8Array[] = [];
  const global = new TextEncoder().encode('52 comment=0123456789012345678901234567890123456789\n');
  parts.push(header('pax_global_header', global.length, 'g'), pad(global));
  parts.push(header('owner-repo-abc123/', 0, '5'));
  for (const [path, content] of Object.entries(files)) {
    const full = `owner-repo-abc123/${path}`;
    const data = new TextEncoder().encode(content);
    if (full.length > 99) {
      const record = ` path=${full}\n`;
      let length = record.length;
      length += String(length + String(length).length).length;
      const pax = new TextEncoder().encode(`${String(length)}${record}`);
      parts.push(header('PaxHeader', pax.length, 'x'), pad(pax));
    }
    parts.push(header(full, data.length, '0'), pad(data));
  }
  parts.push(new Uint8Array(1024));
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const long_path = `${'hlboko/'.repeat(15)}stranka.html`;
const tar = make_tar({
  'index.html': '<!DOCTYPE html>',
  'web/style/style.css': 'body{}',
  [long_path]: 'dlhá',
});

describe('parse_repo_url', () => {
  it('rozlíši repozitár, vetvu a priečinok', () => {
    expect(parse_repo_url('https://github.com/a/b')).toEqual({
      owner: 'a',
      repo: 'b',
      ref: null,
      subdir: '',
    });
    expect(parse_repo_url('https://github.com/a/b.git')).toMatchObject({ repo: 'b' });
    expect(parse_repo_url('https://github.com/a/b/tree/main/web/stranka')).toEqual({
      owner: 'a',
      repo: 'b',
      ref: 'main',
      subdir: 'web/stranka',
    });
  });

  it('odmietne odkaz na issues a pod.', () => {
    expect(() => parse_repo_url('https://github.com/a/b/issues/1')).toThrow(RepoError);
  });
});

describe('untar', () => {
  it('prečíta bežné súbory aj dlhé cesty z pax hlavičky', () => {
    const paths = untar(tar).map((e) => e.path);
    expect(paths).toEqual([
      'owner-repo-abc123/index.html',
      'owner-repo-abc123/web/style/style.css',
      `owner-repo-abc123/${long_path}`,
    ]);
  });

  it('odstráni koreňový priečinok a vyberie podpriečinok', () => {
    expect([...repo_files_from_archive(tar, '').keys()]).toEqual([
      'index.html',
      'web/style/style.css',
      long_path,
    ]);
    const web = repo_files_from_archive(tar, 'web');
    expect([...web.keys()]).toEqual(['style/style.css']);
    expect(new TextDecoder().decode(web.get('style/style.css'))).toBe('body{}');
  });

  it('prázdny priečinok je chyba', () => {
    expect(() => repo_files_from_archive(tar, 'neexistuje')).toThrow(/prázdny alebo neexistuje/);
  });
});

describe('fetch_repo', () => {
  it('stiahne archív z codeload a rozbalí ho', async () => {
    let requested = '';
    const files = await fetch_repo('https://github.com/owner/repo/tree/main/web', {
      fetch: (url) => {
        requested = url instanceof Request ? url.url : url.toString();
        return Promise.resolve(new Response(gzipSync(tar)));
      },
    });
    expect(requested).toBe('https://codeload.github.com/owner/repo/tar.gz/main');
    expect([...files.keys()]).toEqual(['style/style.css']);
  });

  it('404 z GitHubu je not_found', async () => {
    const result = fetch_repo('https://github.com/owner/repo', {
      fetch: () => Promise.resolve(new Response('Not Found', { status: 404 })),
    });
    await expect(result).rejects.toMatchObject({ code: 'not_found' });
  });
});
