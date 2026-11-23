import { analyze_static } from '@ooko/analyzer';
import { StaticRequest } from '@ooko/contracts';
import { post_handler } from '@ooko/http';
import { protect } from '../lib/auth.ts';
import { load_repo } from '../lib/repo.ts';

// Krok 1: stiahne repozitár a vyhodnotí statické pravidlá rubriky (HTML, CSS, JS, súbory).
export const POST = protect(
  post_handler(StaticRequest, async ({ repo_url, rubric }) =>
    analyze_static(await load_repo(repo_url), rubric),
  ),
);
