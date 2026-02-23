import { RecognitionProvider, ProviderResult } from './providers/types';

export type RecognitionErrorCategory = 'auth' | 'rate_limit' | 'upstream' | 'response_invalid' | 'unknown';

export type RecognitionMappedError = {
  status: number;
  errorCode:
    | 'PROVIDER_AUTH_FAILED'
    | 'PROVIDER_RATE_LIMITED'
    | 'PROVIDER_UPSTREAM_ERROR'
    | 'PROVIDER_RESPONSE_INVALID';
  category: RecognitionErrorCategory;
  upstreamStatus: number | null;
  message: string;
  retryable: boolean;
};

export type RecognitionExecutionTelemetry = {
  provider: string;
  model: string;
  requestId: string | null;
  operation: 'analyze' | 'paper_recognize' | 'parse_latex';
  fileCount: number;
  fileSizeBand: string;
  coldStart: boolean;
  attempts: number;
  durationMs: number;
  success: boolean;
  upstreamStatus: number | null;
  errorCategory: RecognitionErrorCategory | null;
  errorCode: string | null;
};

const providerWarmMap = new Map<string, boolean>();

export function fileSizeBand(totalBytes: number) {
  if (totalBytes <= 256 * 1024) return '<=256KB';
  if (totalBytes <= 1024 * 1024) return '<=1MB';
  if (totalBytes <= 5 * 1024 * 1024) return '<=5MB';
  if (totalBytes <= 20 * 1024 * 1024) return '<=20MB';
  return '>20MB';
}

export async function executeRecognitionWithRetry(input: {
  provider: RecognitionProvider;
  files: { mimeType: string; dataBase64: string; sizeBytes?: number }[];
  operation: 'analyze' | 'paper_recognize';
  requestId: string | null;
}): Promise<{ result: ProviderResult; telemetry: RecognitionExecutionTelemetry }> {
  const start = Date.now();
  const providerKey = `${input.provider.name}:${input.provider.model}`;
  const coldStart = !providerWarmMap.get(providerKey);
  let attempts = 0;
  let lastMapped: RecognitionMappedError | null = null;
  const maxAttempts = 3;
  const totalBytes = input.files.reduce((acc, f) => acc + Number(f.sizeBytes || 0), 0);

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const result = await input.provider.recognizeFromFiles(
        input.files.map((f) => ({ mimeType: f.mimeType, dataBase64: f.dataBase64 })),
      );
      providerWarmMap.set(providerKey, true);
      return {
        result,
        telemetry: {
          provider: input.provider.name,
          model: input.provider.model,
          requestId: input.requestId,
          operation: input.operation,
          fileCount: input.files.length,
          fileSizeBand: fileSizeBand(totalBytes),
          coldStart,
          attempts,
          durationMs: Date.now() - start,
          success: true,
          upstreamStatus: null,
          errorCategory: null,
          errorCode: null,
        },
      };
    } catch (error) {
      const mapped = mapProviderError(error);
      lastMapped = mapped;
      if (!mapped.retryable || attempts >= maxAttempts) {
        providerWarmMap.set(providerKey, true);
        throw {
          mapped,
          telemetry: {
            provider: input.provider.name,
            model: input.provider.model,
            requestId: input.requestId,
            operation: input.operation,
            fileCount: input.files.length,
            fileSizeBand: fileSizeBand(totalBytes),
            coldStart,
            attempts,
            durationMs: Date.now() - start,
            success: false,
            upstreamStatus: mapped.upstreamStatus,
            errorCategory: mapped.category,
            errorCode: mapped.errorCode,
          } as RecognitionExecutionTelemetry,
        };
      }

      const backoffMs = attempts === 1 ? 250 : 700;
      await sleep(backoffMs);
    }
  }

  const fallbackMapped = lastMapped || {
    status: 502,
    errorCode: 'PROVIDER_UPSTREAM_ERROR' as const,
    category: 'unknown' as const,
    upstreamStatus: null,
    message: 'Provider request failed',
    retryable: false,
  };
  throw {
    mapped: fallbackMapped,
    telemetry: {
      provider: input.provider.name,
      model: input.provider.model,
      requestId: input.requestId,
      operation: input.operation,
      fileCount: input.files.length,
      fileSizeBand: fileSizeBand(totalBytes),
      coldStart,
      attempts,
      durationMs: Date.now() - start,
      success: false,
      upstreamStatus: fallbackMapped.upstreamStatus,
      errorCategory: fallbackMapped.category,
      errorCode: fallbackMapped.errorCode,
    } as RecognitionExecutionTelemetry,
  };
}

export function mapProviderError(error: unknown): RecognitionMappedError {
  const anyErr = error as any;
  const message = String(anyErr?.message || error || 'Provider request failed');
  const upstreamStatus = extractUpstreamStatus(anyErr, message);

  if (upstreamStatus === 401 || upstreamStatus === 403 || /unauthoriz|forbidden|api key|permission/i.test(message)) {
    return {
      status: 401,
      errorCode: 'PROVIDER_AUTH_FAILED',
      category: 'auth',
      upstreamStatus,
      message: 'Provider authentication failed. Please check API key/permissions.',
      retryable: false,
    };
  }

  if (upstreamStatus === 429 || /rate limit|quota|too many requests/i.test(message)) {
    return {
      status: 429,
      errorCode: 'PROVIDER_RATE_LIMITED',
      category: 'rate_limit',
      upstreamStatus,
      message: 'Provider rate limited. Please retry later or switch provider.',
      retryable: true,
    };
  }

  if (
    /json|parse|unexpected token|response format|invalid response|schema/i.test(message) &&
    !/network|timeout|socket|connect|econn|enotfound/i.test(message)
  ) {
    return {
      status: 502,
      errorCode: 'PROVIDER_RESPONSE_INVALID',
      category: 'response_invalid',
      upstreamStatus,
      message: 'Provider response format is invalid.',
      retryable: false,
    };
  }

  if (
    (typeof upstreamStatus === 'number' && upstreamStatus >= 500) ||
    /network|timeout|socket|connect|econn|enotfound|fetch failed/i.test(message)
  ) {
    return {
      status: 502,
      errorCode: 'PROVIDER_UPSTREAM_ERROR',
      category: 'upstream',
      upstreamStatus,
      message: 'Provider upstream/network failed.',
      retryable: true,
    };
  }

  return {
    status: 502,
    errorCode: 'PROVIDER_UPSTREAM_ERROR',
    category: 'unknown',
    upstreamStatus,
    message: message.slice(0, 240),
    retryable: false,
  };
}

export function buildRecognitionPrecheck(input: {
  providerName: 'gemini' | 'glm';
  model: string;
  providerConfigured: boolean;
}) {
  const issues: string[] = [];
  const knownModelsByProvider: Record<'gemini' | 'glm', string[]> = {
    gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    glm: ['glm-5', 'glm-4.5'],
  };

  if (!input.providerConfigured) {
    issues.push('provider_not_configured');
  }

  if (!knownModelsByProvider[input.providerName].includes(input.model)) {
    issues.push('model_not_in_allowlist');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

function extractUpstreamStatus(anyErr: any, message: string): number | null {
  const candidates = [anyErr?.status, anyErr?.statusCode, anyErr?.code];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 100 && n <= 599) return n;
  }
  const matched = message.match(/\b(4\d\d|5\d\d)\b/);
  if (matched) return Number(matched[1]);
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
