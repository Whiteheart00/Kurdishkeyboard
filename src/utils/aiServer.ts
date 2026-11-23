import { logEvent, sanitizeUrl, startOperation } from './activityLogger';

export type AiServerSource = 'settings' | 'env' | 'same_origin' | 'none';

export interface ResolvedAiServer {
  baseUrl: string;
  source: AiServerSource;
}

export interface AiHealthTestResult {
  status: 'ready' | 'missing_key' | 'error';
  message: string;
  platform?: string;
}

/**
 * Normalizes a user-provided Vercel/backend server URL.
 * Returns empty string for empty input, or throws a Kurdish error message if invalid.
 */
export function normalizeAiServerUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Auto-prepend https:// if user typed a bare hostname like my-app.vercel.app
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('بەستەرەکە دروست نییە. نموونە: https://your-app.vercel.app');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('بەستەرەکە دەبێت بە https:// یان http:// دەست پێبکات.');
  }

  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    // Allow localhost for local testing
    if (parsed.hostname !== 'localhost') {
      throw new Error('ناونیشانی سێرڤەرەکە تەواو نییە. نموونە: https://your-app.vercel.app');
    }
  }

  // Strip trailing slashes and accidental /api or /api/health suffixes
  let cleanPath = parsed.pathname.replace(/\/+$/, '');
  cleanPath = cleanPath.replace(/\/api(\/health)?$/i, '');

  return `${parsed.origin}${cleanPath}`;
}

export function getBuildTimeApiBaseUrl(): string {
  const envUrl =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_API_BASE_URL || '';
  try {
    return normalizeAiServerUrl(envUrl);
  } catch {
    return '';
  }
}

export function isOfflineAndroidApk(): boolean {
  return (
    typeof window !== 'undefined' &&
    (Boolean(window.AndroidIME) || Boolean(window.AndroidAppSetup))
  );
}

export function resolveAiServer(settingsServerUrl?: string): ResolvedAiServer {
  if (settingsServerUrl && settingsServerUrl.trim()) {
    try {
      const normalized = normalizeAiServerUrl(settingsServerUrl);
      if (normalized) {
        return { baseUrl: normalized, source: 'settings' };
      }
    } catch {
      // Ignore malformed stored value and fall through
    }
  }

  const envUrl = getBuildTimeApiBaseUrl();
  if (envUrl) {
    return { baseUrl: envUrl, source: 'env' };
  }

  if (!isOfflineAndroidApk()) {
    return { baseUrl: '', source: 'same_origin' };
  }

  return { baseUrl: '', source: 'none' };
}

export async function testAiServerConnection(baseUrl: string): Promise<AiHealthTestResult> {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/health`;
  const safeEndpoint = sanitizeUrl(endpoint);
  const op = startOperation({
    category: 'USER_OPERATIONS',
    title: 'AI Server Connection Test',
    description: `Testing AI server health endpoint at ${safeEndpoint}.`,
    component: 'AiServerConfig',
    operation: 'test_ai_server_connection',
    metadata: { endpoint: safeEndpoint },
  });

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!res.ok) {
      op.fail(new Error(`Server responded with HTTP ${res.status}`), {
        httpStatus: res.status,
        description: `AI health endpoint returned HTTP ${res.status}.`,
      });
      return {
        status: 'error',
        message: `سێرڤەر وەڵامی هەڵەی گەڕاندەوە (کۆدی ${res.status}). دڵنیابە لە دروستی بەستەرەکە.`,
      };
    }

    const data = (await res.json()) as {
      ok?: boolean;
      aiConfigured?: boolean;
      platform?: string;
      keyCount?: number;
      rejectedKeyCount?: number;
      modelCount?: number;
    };

    if (!data?.ok) {
      op.fail(new Error('Invalid health payload'), {
        httpStatus: res.status,
        description: 'AI server health response did not report ok=true.',
      });
      return {
        status: 'error',
        message: 'وەڵامی سێرڤەر گونجاو نییە. دڵنیابە بەستەری پڕۆژەی تەختەکلیلی کوردیت داناوە.',
      };
    }

    if (data.aiConfigured) {
      const multiKeyNote =
        data.keyCount && data.keyCount > 1
          ? ` (${data.keyCount} کلیل × ${data.modelCount || 4} مۆدێل بە گۆڕینی خۆکار)`
          : '';
      const rejectedNote =
        data.rejectedKeyCount && data.rejectedKeyCount > 0
          ? ` — تێبینی: ${data.rejectedKeyCount} کلیلی نادروست (پیتی نائینگلیزی تێدایە) خۆکارانە پشتگوێ خرا، تکایە لە Vercel پشکنینی بۆ بکە`
          : '';
      op.complete({
        httpStatus: res.status,
        description: 'AI server is reachable and Gemini credentials are configured.',
        metadata: {
          endpoint: safeEndpoint,
          platform: data.platform || 'unknown',
          keyCount: data.keyCount || 1,
          rejectedKeyCount: data.rejectedKeyCount || 0,
          modelCount: data.modelCount || 1,
        },
      });
      return {
        status: 'ready',
        platform: data.platform,
        message: `پەیوەندی سەرکەوتووە! سێرڤەر و ژیری دەسکردی Gemini بە تەواوی ئامادەن${multiKeyNote}${rejectedNote}.`,
      };
    }

    logEvent({
      category: 'WARNINGS',
      severity: 'WARNING',
      title: 'AI Server Missing API Key Configuration',
      description: 'AI server is reachable, but server-side GEMINI_API_KEY is not configured.',
      component: 'AiServerConfig',
      operation: 'test_ai_server_connection',
      status: 'WARNING',
      httpStatus: res.status,
      operationId: op.operationId,
      metadata: { endpoint: safeEndpoint, platform: data.platform || 'unknown' },
    });
    return {
      status: 'missing_key',
      platform: data.platform,
      message:
        'سێرڤەرەکە کار دەکات، بەڵام کلیلی GEMINI_API_KEY لە بەشی Environment Variables ـی Vercel دانەنراوە.',
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      op.fail(err, {
        category: 'NETWORK',
        description: 'AI server health check timed out after 10,000ms.',
      });
      return {
        status: 'error',
        message: 'کاتی چاوەڕوانی تەواو بوو. دڵنیابە لە هێڵی ئینتەرنێت و بەستەری سێرڤەرەکە.',
      };
    }
    op.fail(err, {
      category: 'NETWORK',
      description: 'Could not reach AI server endpoint.',
    });
    return {
      status: 'error',
      message: 'نەتوانرا پەیوەندی بە سێرڤەرەکەوە بکرێت. دڵنیابە بەستەرەکە دروستە و ئینتەرنێتت هەیە.',
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
