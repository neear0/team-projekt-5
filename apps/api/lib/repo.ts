import { fetch_repo, RepoError, type RepoErrorCode, type RepoFiles } from '@ooko/analyzer';
import { HttpError } from '@ooko/http';

const STATUS: Record<RepoErrorCode, number> = {
  not_found: 404,
  payload_too_large: 413,
  upstream_error: 502,
};

/** Stiahne repozitár študenta, chyby premení na HTTP odpoveď s hláškou pre používateľa. */
export async function load_repo(repo_url: string): Promise<RepoFiles> {
  try {
    return await fetch_repo(repo_url);
  } catch (err) {
    if (err instanceof RepoError) throw new HttpError(STATUS[err.code], err.code, err.message);
    throw err;
  }
}
