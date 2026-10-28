import { describe, expect, it } from 'vitest';
import { RepoUrl } from './common.ts';
import { AiConfig } from './steps.ts';

describe('RepoUrl', () => {
  it.each([
    'https://github.com/neear0/team-projekt-5',
    'https://github.com/neear0/team-projekt-5/tree/main/web',
  ])('prijme %s', (url) => {
    expect(RepoUrl.safeParse(url).success).toBe(true);
  });

  it.each([
    'http://github.com/neear0/team-projekt-5',
    'https://gitlab.com/neear0/team-projekt-5',
    'https://github.com.evil.sk/neear0/repo',
    'file:///etc/passwd',
    'nie je url',
  ])('odmietne %s', (url) => {
    expect(RepoUrl.safeParse(url).success).toBe(false);
  });
});

describe('AiConfig', () => {
  it('bez AI nepotrebuje kľúč', () => {
    expect(AiConfig.parse({ provider: 'none' })).toEqual({ provider: 'none' });
  });

  it('cloudový poskytovateľ bez kľúča neprejde', () => {
    expect(AiConfig.safeParse({ provider: 'google', model: 'gemini' }).success).toBe(false);
  });
});
