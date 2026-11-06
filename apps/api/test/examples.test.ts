import { readdirSync, readFileSync } from 'node:fs';
import {
  AiResponse,
  ErrorBody,
  Report,
  Rubric,
  RuntimeResponse,
  StaticResponse,
} from '@ooko/contracts';
import { describe, expect, it } from 'vitest';

// Ukážky pre UI v docs/examples/ musia sedieť s kontraktmi, inak ich treba pregenerovať
// cez `pnpm --filter @ooko/api examples`.
const dir = new URL('../../../docs/examples/', import.meta.url);
const schemas = {
  static: StaticResponse,
  runtime: RuntimeResponse,
  ai: AiResponse,
  report: Report,
};

describe('docs/examples', () => {
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));

  it.each(files)('%s sedí s kontraktom', (name) => {
    const data: unknown = JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
    const kind = /\.(static|runtime|ai|report)\.json$/.exec(name)?.[1] as
      keyof typeof schemas | undefined;
    const schema = kind
      ? schemas[kind]
      : name === 'rubric.json'
        ? Rubric
        : name.startsWith('chyba-')
          ? ErrorBody
          : undefined;
    expect(schema, `neznámy súbor ${name}`).toBeDefined();
    expect(schema?.safeParse(data).error?.issues ?? []).toEqual([]);
  });
});
