import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { json_schemas } from './json_schema.ts';

describe('JSON Schema', () => {
  it.each(Object.entries(json_schemas()))(
    '%s je aktuálna (inak spusti pnpm schemas)',
    (name, schema) => {
      const file = readFileSync(new URL(`../schemas/${name}`, import.meta.url), 'utf8');
      expect(JSON.parse(file)).toEqual(schema);
    },
  );
});
