import { writeFileSync } from 'node:fs';
import { json_schemas } from '../src/json_schema.ts';

const out_dir = new URL('../schemas/', import.meta.url);

for (const [name, schema] of Object.entries(json_schemas())) {
  writeFileSync(new URL(name, out_dir), JSON.stringify(schema, null, 2) + '\n');
  console.log(`zapísané schemas/${name}`);
}
