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
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        status: 'error',
        message: `سێرڤەر وەڵامی هەڵەی گەڕاندەوە (کۆدی ${res.status}). دڵنیابە لە دروستی بەستەرەکە.`,
      };
    }

    const data = (await res.json()) as {
      ok?: boolean;
      aiConfigured?: boolean;
      platform?: string;
    };

    if (!data?.ok) {
      return {
        status: 'error',
        message: 'وەڵامی سێرڤەر گونجاو نییە. دڵنیابە بەستەری پڕۆژەی تەختەکلیلی کوردیت داناوە.',
      };
    }

    if (data.aiConfigured) {
      return {
        status: 'ready',
        platform: data.platform,
        message: 'پەیوەندی سەرکەوتووە! سێرڤەر و ژیری دەسکردی Gemini بە تەواوی ئامادەن.',
      };
    }

    return {
      status: 'missing_key',
      platform: data.platform,
      message:
        'سێرڤەرەکە کار دەکات، بەڵام کلیلی GEMINI_API_KEY لە بەشی Environment Variables ـی Vercel دانەنراوە.',
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 'error',
        message: 'کاتی چاوەڕوانی تەواو بوو. دڵنیابە لە هێڵی ئینتەرنێت و بەستەری سێرڤەرەکە.',
      };
    }
    return {
      status: 'error',
      message: 'نەتوانرا پەیوەندی بە سێرڤەرەکەوە بکرێت. دڵنیابە بەستەرەکە دروستە و ئینتەرنێتت هەیە.',
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
