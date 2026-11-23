import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { AiConfig } from '@ooko/contracts';
import type { LanguageModel } from 'ai';
import { AiError } from './errors.ts';

type ProviderConfig = Exclude<AiConfig, { provider: 'none' }>;

/** Kľúč a model servera z premenných prostredia (Vercel → Settings → Environment Variables). */
function server_ai(): { api_key: string; model: string } | null {
  const api_key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  return api_key && model ? { api_key, model } : null;
}

export function server_ai_configured(): boolean {
  return server_ai() !== null;
}

/** Názov modelu pre report. */
export function model_name(config: AiConfig): string | null {
  if (config.provider === 'none') return null;
  if (config.provider === 'server') return server_ai()?.model ?? null;
  return config.model;
}

/**
 * Adresu vlastného servera zadáva používateľ a volá ju náš server. Aby sa cez ňu nedalo
 * dostať do vnútornej siete, musí byť https a nesmie mieriť na lokálne a privátne adresy.
 * Hostname, ktorý sa na privátnu adresu preloží až cez DNS, takto nezachytíme.
 */
export function check_base_url(base_url: string): void {
  let url: URL;
  try {
    url = new URL(base_url);
  } catch {
    throw new AiError('bad_request', 'Adresa servera AI je neplatná.');
  }
  const host = url.hostname.toLowerCase();
  const ipv4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  const [a, b] = ipv4 ? [Number(ipv4[1]), Number(ipv4[2])] : [-1, -1];
  const is_private =
    host === 'localhost' ||
    /\.(localhost|local|internal|lan|home)$/.test(host) ||
    host.startsWith('[') ||
    !host.includes('.') ||
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
  if (url.protocol !== 'https:' || is_private) {
    throw new AiError(
      'bad_request',
      'Server AI musí mať verejnú adresu https://. Lokálny model (Ollama, LM Studio) sa volá priamo z prehliadača.',
    );
  }
}

/** Model podľa nastavení používateľa. Kľúč ide iba do tejto inštancie, nikam sa neukladá. */
export function create_model(config: ProviderConfig): LanguageModel {
  switch (config.provider) {
    case 'google':
      return createGoogle({ apiKey: config.api_key })(config.model);
    case 'server': {
      const server = server_ai();
      if (!server) throw new AiError('bad_request', 'Server nemá nastavený kľúč pre AI.');
      return createGoogle({ apiKey: server.api_key })(server.model);
    }
    case 'anthropic':
      return createAnthropic({ apiKey: config.api_key })(config.model);
    case 'openai':
      return createOpenAI({ apiKey: config.api_key })(config.model);
    case 'openai-compatible':
      check_base_url(config.base_url);
      return createOpenAICompatible({
        name: 'vlastny',
        baseURL: config.base_url,
        ...(config.api_key !== undefined && { apiKey: config.api_key }),
      })(config.model);
  }
}
