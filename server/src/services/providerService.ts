import { env } from '../config/env';
import { GeminiProvider } from './providers/geminiProvider';
import { GlmProvider } from './providers/glmProvider';
import { RecognitionProvider } from './providers/types';

const providerFactories: Record<'gemini' | 'glm', () => RecognitionProvider> = {
  gemini: () => new GeminiProvider(),
  glm: () => new GlmProvider(),
};
const providerCache: Partial<Record<'gemini' | 'glm', RecognitionProvider>> = {};
let defaultProviderName: 'gemini' | 'glm' = env.DEFAULT_PROVIDER;

export function getProvider(providerName?: string): RecognitionProvider {
  const selected = (providerName || defaultProviderName) as 'gemini' | 'glm';
  const factory = providerFactories[selected];
  if (!factory) {
    throw new Error(`Unsupported provider: ${selected}`);
  }

  const isEnabled = selected === 'gemini' ? !!env.GEMINI_API_KEY : !!env.GLM_API_KEY;
  if (!isEnabled) {
    throw new Error(`Provider "${selected}" is not configured. Please set API key in .env.server`);
  }

  if (!providerCache[selected]) {
    providerCache[selected] = factory();
  }
  return providerCache[selected]!;
}

export function listProviders() {
  return [
    {
      name: 'gemini',
      enabled: !!env.GEMINI_API_KEY,
      inputPricePerMillion: env.GEMINI_INPUT_PRICE,
      outputPricePerMillion: env.GEMINI_OUTPUT_PRICE,
    },
    {
      name: 'glm',
      enabled: !!env.GLM_API_KEY,
      inputPricePerMillion: env.GLM_INPUT_PRICE,
      outputPricePerMillion: env.GLM_OUTPUT_PRICE,
    },
  ];
}

export function getDefaultProviderName() {
  return defaultProviderName;
}

export function setDefaultProviderName(next: 'gemini' | 'glm') {
  if (!providerFactories[next]) {
    throw new Error(`Unsupported provider: ${next}`);
  }
  defaultProviderName = next;
}

export function estimateCost(providerName: string, inputTokens: number, outputTokens: number): number {
  const p = listProviders().find((x) => x.name === providerName);
  if (!p) return 0;
  const inputCost = (inputTokens / 1_000_000) * p.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * p.outputPricePerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}
