import { APICallError, NoObjectGeneratedError, RetryError } from 'ai';

export type AiErrorCode = 'bad_request' | 'upstream_error';

/** Chyba pri volaní AI s hláškou pre používateľa. Endpoint ju premení na HTTP odpoveď. */
export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.code = code;
  }
}

/**
 * Chyba z AI SDK → hláška pre používateľa. Pôvodnú chybu nelogujeme celú, obsahuje prompt
 * s kódom študenta.
 */
export function to_ai_error(err: unknown): AiError {
  if (err instanceof AiError) return err;
  const cause = RetryError.isInstance(err) ? err.lastError : err;

  if (APICallError.isInstance(cause)) {
    const status = cause.statusCode;
    if (status === 401 || status === 403) {
      return new AiError(
        'bad_request',
        'Poskytovateľ AI odmietol API kľúč. Skontroluj ho v nastaveniach.',
        cause,
      );
    }
    if (status === 404) {
      return new AiError(
        'bad_request',
        'Model neexistuje alebo k nemu nemáš prístup. Skontroluj názov modelu.',
        cause,
      );
    }
    if (status === 429) {
      return new AiError(
        'upstream_error',
        'Minul sa limit požiadaviek u poskytovateľa AI. Skús to o chvíľu znova.',
        cause,
      );
    }
    if (status !== undefined && status >= 400 && status < 500) {
      return new AiError(
        'bad_request',
        `Poskytovateľ AI požiadavku odmietol (${String(status)}). Model možno nepodporuje obrázky alebo štruktúrovaný výstup.`,
        cause,
      );
    }
    return new AiError(
      'upstream_error',
      'Poskytovateľ AI neodpovedá. Skús to o chvíľu znova.',
      cause,
    );
  }
  if (NoObjectGeneratedError.isInstance(cause)) {
    return new AiError(
      'upstream_error',
      'Model nevrátil hodnotenie v správnom tvare. Skús to znova alebo zvoľ iný model.',
      cause,
    );
  }
  if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
    return new AiError(
      'upstream_error',
      'Model neodpovedal včas. Skús to znova alebo zvoľ rýchlejší model.',
      cause,
    );
  }
  return new AiError('upstream_error', 'Volanie AI zlyhalo. Skús to znova.', cause);
}

/** Druh pôvodnej chyby a HTTP status poskytovateľa do logu, bez promptu a odpovede. */
export function describe_cause(err: AiError): { cause?: string; status?: number } {
  const cause = RetryError.isInstance(err.cause) ? err.cause.lastError : err.cause;
  return {
    ...(cause instanceof Error && { cause: cause.name }),
    ...(APICallError.isInstance(cause) &&
      cause.statusCode !== undefined && { status: cause.statusCode }),
  };
}
