import { RuntimeRequest } from '@ooko/contracts';
import { post_handler } from '@ooko/http';
import { analyze_runtime } from '@ooko/runtime';
import { load_repo } from '../lib/repo.ts';

// Krok 2: stiahne repozitár, otvorí web v Chromiu (screenshoty, axe-core, konzola, Lighthouse)
// a vyhodnotí runtime pravidlá rubriky.
export const POST = post_handler(RuntimeRequest, async ({ repo_url, rubric }) =>
  analyze_runtime(await load_repo(repo_url), rubric),
);
