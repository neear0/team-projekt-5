import { parse_rubric, type Rubric } from '@ooko/contracts';
import formular_yaml from '../../../../rubrics/formular.yaml?raw';
import osobna_stranka_yaml from '../../../../rubrics/osobna-stranka.yaml?raw';
import webove_sidlo_yaml from '../../../../rubrics/webove-sidlo.yaml?raw';

/** Ukážkové rubriky pribalené v aplikácii. Vlastnú rubriku bude vedieť pridať editor (zatiaľ nehotový). */
const sources = [webove_sidlo_yaml, osobna_stranka_yaml, formular_yaml];

export const rubrics: Rubric[] = sources.map((source) => {
  const parsed = parse_rubric(source);
  if (!parsed.success) {
    const issues = parsed.issues.map((issue) => issue.message).join('; ');
    throw new Error(`Chyba v pribalenej rubrike: ${issues}`);
  }
  return parsed.rubric;
});
