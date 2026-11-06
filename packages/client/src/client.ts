import {
  AiResponse,
  ErrorBody,
  HealthResponse,
  RuntimeResponse,
  StaticResponse,
  type AiConfig,
  type AiRequest,
  type ErrorCode,
  type Report,
  type Rubric,
  type RuntimeRequest,
  type StaticRequest,
} from '@ooko/contracts';
import type { z } from 'zod';
import { build_report } from './report.ts';

/** Kódy zo servera a k tomu chyby, ktoré vzniknú v prehliadači. */
export type ClientErrorCode = ErrorCode | 'network' | 'timeout' | 'aborted' | 'bad_response';

type Issue = NonNullable<ErrorBody['error']['issues']>[number];

/** Chyba z volania API. `message` je po slovensky a dá sa ukázať používateľovi. */
export class ApiError extends Error {
  /** HTTP status, `null` ak server vôbec neodpovedal. */
  readonly status: number | null;
  readonly code: ClientErrorCode;
  /** Pri `bad_request`: ktoré polia sú zlé, napr. `repo_url`. */
  readonly issues: Issue[];

  constructor(status: number | null, code: ClientErrorCode, message: string, issues: Issue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export interface ClientOptions {
  /** Adresa API bez lomky na konci. Predvolene rovnaký pôvod ako stránka (`/api/...`). */
  base_url?: string;
  /** Na testy. */
  fetch?: typeof fetch;
}

export type Step = 'static' | 'runtime' | 'ai';

export interface AnalyzeInput {
  repo_url: string;
  rubric: Rubric;
  ai: AiConfig;
}

export interface AnalyzeOptions {
  signal?: AbortSignal;
  /** Volá sa, keď krok začne (`running`) a keď skončí (`done`). Kroky 1 a 2 bežia naraz. */
  on_progress?: (step: Step, state: 'running' | 'done') => void;
}

/** Všetko z jednej analýzy: report na stiahnutie a k tomu dáta, ktoré v reporte nie sú. */
export interface Analysis {
  report: Report;
  /** Zdrojáky (`files`) a výsledky jednotlivých pravidiel kroku 1. */
  static: StaticResponse;
  /** Screenshoty a výsledky pravidiel kroku 2. */
  runtime: RuntimeResponse;
  ai: AiResponse;
}

export type Client = ReturnType<typeof create_client>;

export function create_client(options: ClientOptions = {}) {
  const base_url = (options.base_url ?? '').replace(/\/+$/, '');
  const do_fetch = options.fetch ?? ((input, init) => fetch(input, init));

  async function call<S extends z.ZodType>(
    path: string,
    schema: S,
    body: unknown,
    signal: AbortSignal | undefined,
  ): Promise<z.output<S>> {
    const init: RequestInit = {
      ...(body !== undefined && {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      ...(signal && { signal }),
    };

    let res: Response;
    try {
      res = await do_fetch(`${base_url}${path}`, init);
    } catch {
      if (signal?.aborted) throw new ApiError(null, 'aborted', 'Analýza bola zrušená.');
      throw new ApiError(null, 'network', 'Server neodpovedá. Skontroluj pripojenie na internet.');
    }

    const data: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const error = ErrorBody.safeParse(data);
      if (error.success) {
        const { code, message, issues } = error.data.error;
        throw new ApiError(res.status, code, message, issues);
      }
      // Vercel pri prekročení času vráti vlastnú stránku, nie náš JSON.
      if (res.status === 504) {
        throw new ApiError(504, 'timeout', 'Analýza trvala príliš dlho. Skús to znova.');
      }
      throw new ApiError(res.status, 'bad_response', `Server vrátil chybu ${String(res.status)}.`);
    }

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError(res.status, 'bad_response', 'Server vrátil odpoveď v neočakávanom tvare.');
    }
    return parsed.data;
  }

  const client = {
    health: (signal?: AbortSignal) => call('/api/health', HealthResponse, undefined, signal),

    /** Krok 1: statická analýza (HTML, CSS, JS, súbory). Trvá zvyčajne 1–5 s. */
    static_step: (request: StaticRequest, signal?: AbortSignal) =>
      call('/api/static', StaticResponse, request, signal),

    /** Krok 2: web v prehliadači (screenshoty, axe, Lighthouse). Trvá 10–20 s. */
    runtime_step: (request: RuntimeRequest, signal?: AbortSignal) =>
      call('/api/runtime', RuntimeResponse, request, signal),

    /** Krok 3: AI hodnotenie a body za kritériá. */
    ai_step: (request: AiRequest, signal?: AbortSignal) =>
      call('/api/ai', AiResponse, request, signal),

    /**
     * Celá analýza jedného repozitára: kroky 1 a 2 naraz, potom krok 3 a report.
     * Keď jeden krok zlyhá, ostatné sa zrušia a vyhodí sa `ApiError`.
     */
    async analyze(input: AnalyzeInput, options: AnalyzeOptions = {}): Promise<Analysis> {
      const { repo_url, rubric, ai } = input;
      const controller = new AbortController();
      const abort = () => {
        controller.abort();
      };
      options.signal?.addEventListener('abort', abort);

      async function step<T>(name: Step, run: () => Promise<T>): Promise<T> {
        options.on_progress?.(name, 'running');
        const result = await run();
        options.on_progress?.(name, 'done');
        return result;
      }

      try {
        if (options.signal?.aborted) throw new ApiError(null, 'aborted', 'Analýza bola zrušená.');
        const [static_result, runtime_result] = await Promise.all([
          step('static', () => client.static_step({ repo_url, rubric }, controller.signal)),
          step('runtime', () => client.runtime_step({ repo_url, rubric }, controller.signal)),
        ]);
        const ai_result = await step('ai', () =>
          client.ai_step(
            { ai, rubric, static: static_result, runtime: runtime_result },
            controller.signal,
          ),
        );
        return {
          report: build_report({
            repo_url,
            rubric,
            ai_config: ai,
            static: static_result,
            runtime: runtime_result,
            ai: ai_result,
          }),
          static: static_result,
          runtime: runtime_result,
          ai: ai_result,
        };
      } catch (err) {
        abort();
        if (options.signal?.aborted) throw new ApiError(null, 'aborted', 'Analýza bola zrušená.');
        throw err;
      } finally {
        options.signal?.removeEventListener('abort', abort);
      }
    },
  };
  return client;
}
