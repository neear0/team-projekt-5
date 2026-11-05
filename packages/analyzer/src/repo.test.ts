import { describe, expect, it } from 'vitest';
import { fetch_repo, parse_repo_url, RepoError, repo_files_from_archive, untar } from './repo.ts';
import { make_tar, make_tar_gz } from '../test/tar.ts';

const long_path = `${'hlboko/'.repeat(15)}stranka.html`;
const files_spec = {
  'index.html': '<!DOCTYPE html>',
  'web/style/style.css': 'body{}',
  [long_path]: 'dlhá',
};
const tar = make_tar(files_spec);

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
        return Promise.resolve(new Response(make_tar_gz(files_spec)));
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
