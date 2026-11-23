// Centralized silent Activity Logging, Diagnostics & Report Management Engine
// Strictly on-device, zero automatic popups, strict privacy sanitization, bounded FIFO retention.

import { idbDelete, idbGet, idbSet, setStorageErrorListener } from './persistentStorage';

export type LogCategory =
  | 'APPLICATION'
  | 'USER_OPERATIONS'
  | 'NETWORK'
  | 'STORAGE'
  | 'BACKGROUND_TASKS'
  | 'WARNINGS'
  | 'ERRORS'
  | 'CRASHES';

export type LogSeverity = 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type OperationStatus =
  | 'STARTED'
  | 'COMPLETED'
  | 'SUCCESS'
  | 'CANCELLED'
  | 'FAILED'
  | 'RETRIED'
  | 'INTERRUPTED'
  | 'WARNING'
  | 'INFO';

export interface ActivityLogEvent {
  id: string;
  timestamp: string;
  epochMs: number;
  category: LogCategory;
  severity: LogSeverity;
  title: string;
  description: string;
  component: string;
  operation: string;
  status: string;
  errorMessage?: string;
  stackTrace?: string;
  operationId?: string;
  relatedEventId?: string;
  httpStatus?: number;
  durationMs?: number;
  appVersion: string;
  platform: string;
  osVersion: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface LogEventInput {
  category: LogCategory;
  severity: LogSeverity;
  title: string;
  description: string;
  component: string;
  operation: string;
  status?: string;
  error?: unknown;
  errorMessage?: string;
  stackTrace?: string;
  operationId?: string;
  relatedEventId?: string;
  httpStatus?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface OperationHandle {
  operationId: string;
  startedEventId: string;
  complete: (detail?: {
    title?: string;
    description?: string;
    status?: string;
    httpStatus?: number;
    metadata?: Record<string, unknown>;
  }) => ActivityLogEvent;
  cancel: (reason?: string, metadata?: Record<string, unknown>) => ActivityLogEvent;
  fail: (
    error: unknown,
    detail?: {
      title?: string;
      description?: string;
      httpStatus?: number;
      category?: LogCategory;
      severity?: LogSeverity;
      metadata?: Record<string, unknown>;
    }
  ) => ActivityLogEvent;
}

export const APP_DISPLAY_NAME = 'تەختەکلیلی کوردی — KurdiKeyboard';
export const APP_VERSION = '3.0.6';

const STORAGE_KEY_LOGS = 'kurdikebord_activity_logs_v1';
const STORAGE_KEY_SESSION_ACTIVE = 'kurdikebord_diag_session_active_v1';
const STORAGE_KEY_SESSION_META = 'kurdikebord_diag_session_meta_v1';

const MAX_EVENTS = 400;
const MAX_STORAGE_BYTES = 340_000;
const MAX_STACK_LENGTH = 2600;
const MAX_STRING_LENGTH = 600;
const MAX_METADATA_KEYS = 16;
export const MAX_CLIPBOARD_CHARS = 180_000;

const SENSITIVE_KEY_PATTERN =
  /(pass(word|phrase)?|secret|token|api[-_]?key|auth(orization)?|cookie|session[-_]?id|bearer|keystore|private[-_]?key|credential|jwt|ssn|credit|card|cvv|pin|signature|raw[-_]?text|user[-_]?text|clipboard[-_]?text|transcript|prompt)/i;

const SENSITIVE_QUERY_PARAMS = new Set([
  'key',
  'apikey',
  'api_key',
  'token',
  'access_token',
  'refresh_token',
  'auth',
  'authorization',
  'secret',
  'password',
  'pass',
  'cookie',
  'session',
  'q',
  'text',
  'prompt',
  'input',
  'query',
]);

let cachedLogs: ActivityLogEvent[] | null = null;
let initialized = false;
let idbSyncTimer: number | null = null;
let storageFailSilenced = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Never break logging pipeline from subscriber errors
    }
  });
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}

export function sanitizeText(raw: string, maxLen = MAX_STRING_LENGTH): string {
  if (!raw) return '';
  let out = String(raw);

  // Redact Bearer / Basic authorization headers
  out = out.replace(/(Bearer|Basic)\s+[A-Za-z0-9\-._~+/]+=*/gi, '$1 [REDACTED]');
  // Redact common API keys (Google AIza, OpenAI sk-, Groq gsk_, GitHub ghp_, AWS AKIA)
  out = out.replace(/\b(AIza[0-9A-Za-z\-_]{20,}|sk-[A-Za-z0-9\-_]{16,}|gsk_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/g, '[REDACTED_KEY]');
  // Redact key=value / "key":"value" secret patterns
  out = out.replace(
    /((?:password|passwd|secret|token|api[_-]?key|authorization|cookie|set-cookie|keystore[_-]?password|client[_-]?secret)\s*[:=]\s*["']?)([^"'\s,;}\n]+)/gi,
    '$1[REDACTED]'
  );
  // Redact email addresses
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');

  if (out.length > maxLen) {
    out = `${out.slice(0, maxLen)}… [truncated ${out.length - maxLen} chars]`;
  }
  return out;
}

export function sanitizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
    const parsed = new URL(rawUrl, base);
    const sanitizedParams = new URLSearchParams();
    parsed.searchParams.forEach((value, key) => {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase()) || SENSITIVE_KEY_PATTERN.test(key)) {
        sanitizedParams.set(key, '[REDACTED]');
      } else {
        sanitizedParams.set(key, sanitizeText(value, 64));
      }
    });
    const qs = sanitizedParams.toString();
    const isSameOrigin = typeof window !== 'undefined' && parsed.origin === window.location.origin;
    const prefix = isSameOrigin ? '' : parsed.origin;
    return `${prefix}${parsed.pathname}${qs ? `?${qs}` : ''}`;
  } catch {
    return sanitizeText(rawUrl, 180);
  }
}

export function sanitizeMetadata(
  raw?: Record<string, unknown>
): Record<string, string | number | boolean | null> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  const entries = Object.entries(raw).slice(0, MAX_METADATA_KEYS);
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    const safeKey = k.slice(0, 64);
    if (SENSITIVE_KEY_PATTERN.test(safeKey)) {
      out[safeKey] = '[REDACTED]';
      continue;
    }
    if (v === null || typeof v === 'boolean' || typeof v === 'number') {
      out[safeKey] = Number.isNaN(v as number) ? null : (v as number | boolean | null);
    } else if (typeof v === 'string') {
      out[safeKey] =
        /^https?:\/\//i.test(v) || safeKey.toLowerCase().includes('url')
          ? sanitizeUrl(v)
          : sanitizeText(v, 220);
    } else {
      try {
        out[safeKey] = sanitizeText(JSON.stringify(v), 220);
      } catch {
        out[safeKey] = '[Object]';
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function getRuntimeEnvironment(): {
  appVersion: string;
  platform: string;
  osVersion: string;
} {
  let appVersion = APP_VERSION;
  let platform = 'Web Browser';
  let osVersion = 'Unknown';

  if (typeof window !== 'undefined') {
    const isNativeIme = new URLSearchParams(window.location.search).get('ime') === '1';
    const hasAndroidBridge = Boolean(window.AndroidAppSetup || window.AndroidIME);

    // Check native Android device diagnostics if exposed by MainActivity
    try {
      const nativeInfoJson = window.AndroidAppSetup?.getDeviceDiagnostics?.();
      if (nativeInfoJson) {
        const parsed = JSON.parse(nativeInfoJson) as {
          appVersion?: string;
          androidRelease?: string;
          sdkInt?: number;
          manufacturer?: string;
          model?: string;
        };
        if (parsed.appVersion) appVersion = sanitizeText(parsed.appVersion, 32);
        const deviceLabel = [parsed.manufacturer, parsed.model].filter(Boolean).join(' ');
        platform = isNativeIme
          ? `Android IME WebView${deviceLabel ? ` (${sanitizeText(deviceLabel, 48)})` : ''}`
          : `Android App WebView${deviceLabel ? ` (${sanitizeText(deviceLabel, 48)})` : ''}`;
        if (parsed.androidRelease) {
          osVersion = `Android ${parsed.androidRelease}${parsed.sdkInt ? ` (API ${parsed.sdkInt})` : ''}`;
          return { appVersion, platform, osVersion };
        }
      }
    } catch {
      // Fallback to navigator inspection below
    }

    const ua = navigator.userAgent || '';
    if (hasAndroidBridge) {
      platform = isNativeIme ? 'Android IME WebView' : 'Android App WebView';
    } else if (/Android/i.test(ua)) {
      platform = 'Android Web';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      platform = 'iOS Web';
    } else if (/Windows/i.test(ua)) {
      platform = 'Windows Web';
    } else if (/Mac OS X/i.test(ua)) {
      platform = 'macOS Web';
    } else if (/Linux/i.test(ua)) {
      platform = 'Linux Web';
    }

    const androidMatch = ua.match(/Android\s+([0-9.]+)/i);
    const iosMatch = ua.match(/OS\s+([0-9_]+)\s+like Mac OS X/i);
    const winMatch = ua.match(/Windows NT\s+([0-9.]+)/i);
    const macMatch = ua.match(/Mac OS X\s+([0-9_]+)/i);

    if (androidMatch) osVersion = `Android ${androidMatch[1]}`;
    else if (iosMatch) osVersion = `iOS ${iosMatch[1].replace(/_/g, '.')}`;
    else if (winMatch) osVersion = `Windows NT ${winMatch[1]}`;
    else if (macMatch) osVersion = `macOS ${macMatch[1].replace(/_/g, '.')}`;
    else if (navigator.platform) osVersion = navigator.platform;
  }

  return { appVersion, platform, osVersion };
}

function extractErrorDetails(err: unknown): { message?: string; stack?: string } {
  if (!err) return {};
  if (err instanceof Error) {
    return {
      message: sanitizeText(err.message || err.name || 'Error', 400),
      stack: err.stack ? sanitizeText(err.stack, MAX_STACK_LENGTH) : undefined,
    };
  }
  if (typeof err === 'string') {
    return { message: sanitizeText(err, 400) };
  }
  try {
    return { message: sanitizeText(JSON.stringify(err), 400) };
  } catch {
    return { message: sanitizeText(String(err), 400) };
  }
}

function trimToRetentionBudget(events: ActivityLogEvent[]): ActivityLogEvent[] {
  // Always keep newest events (events array is stored newest-first)
  let trimmed = events.slice(0, MAX_EVENTS);
  try {
    let serialized = JSON.stringify(trimmed);
    while (serialized.length > MAX_STORAGE_BYTES && trimmed.length > 10) {
      trimmed = trimmed.slice(0, Math.max(10, Math.floor(trimmed.length * 0.8)));
      serialized = JSON.stringify(trimmed);
    }
  } catch {
    trimmed = trimmed.slice(0, 100);
  }
  return trimmed;
}

function readLocalLogs(): ActivityLogEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ActivityLogEvent => Boolean(item && typeof item.id === 'string'));
  } catch {
    return [];
  }
}

function persistLogs(events: ActivityLogEvent[]): void {
  const bounded = trimToRetentionBudget(events);
  cachedLogs = bounded;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(bounded));
      storageFailSilenced = false;
    } catch {
      // Graceful quota fallback: shrink retention to half and retry once
      try {
        const reduced = bounded.slice(0, Math.max(25, Math.floor(bounded.length / 2)));
        cachedLogs = reduced;
        window.localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(reduced));
      } catch {
        storageFailSilenced = true;
      }
    }

    if (idbSyncTimer !== null) {
      window.clearTimeout(idbSyncTimer);
    }
    idbSyncTimer = window.setTimeout(() => {
      idbSyncTimer = null;
      const snapshot = cachedLogs || [];
      if (snapshot.length === 0) {
        idbDelete(STORAGE_KEY_LOGS).catch(() => {});
      } else {
        idbSet(STORAGE_KEY_LOGS, snapshot).catch(() => {});
      }
    }, 350);
  }

  notifyListeners();
}

function mergeNativeAndroidLogs(existing: ActivityLogEvent[]): ActivityLogEvent[] {
  if (typeof window === 'undefined' || !window.AndroidAppSetup?.consumeNativeLogs) {
    return existing;
  }
  try {
    const raw = window.AndroidAppSetup.consumeNativeLogs();
    if (!raw || raw === '[]') return existing;
    const nativeItems = JSON.parse(raw) as Array<{
      id?: string;
      timestamp?: string;
      epochMs?: number;
      category?: LogCategory;
      severity?: LogSeverity;
      title?: string;
      description?: string;
      component?: string;
      operation?: string;
      status?: string;
      errorMessage?: string;
      stackTrace?: string;
      metadata?: Record<string, unknown>;
    }>;
    if (!Array.isArray(nativeItems) || nativeItems.length === 0) return existing;

    const env = getRuntimeEnvironment();
    const existingIds = new Set(existing.map((e) => e.id));
    const imported: ActivityLogEvent[] = [];

    for (const item of nativeItems) {
      const id = item.id || generateId('nat');
      if (existingIds.has(id)) continue;
      const epochMs = typeof item.epochMs === 'number' ? item.epochMs : Date.now();
      imported.push({
        id,
        timestamp: item.timestamp || new Date(epochMs).toISOString(),
        epochMs,
        category: item.category || 'APPLICATION',
        severity: item.severity || 'INFO',
        title: sanitizeText(item.title || 'Android Native Event', 140),
        description: sanitizeText(item.description || '', MAX_STRING_LENGTH),
        component: sanitizeText(item.component || 'AndroidNative', 80),
        operation: sanitizeText(item.operation || 'native_event', 80),
        status: sanitizeText(item.status || 'INFO', 40),
        errorMessage: item.errorMessage ? sanitizeText(item.errorMessage, 400) : undefined,
        stackTrace: item.stackTrace ? sanitizeText(item.stackTrace, MAX_STACK_LENGTH) : undefined,
        appVersion: env.appVersion,
        platform: env.platform,
        osVersion: env.osVersion,
        metadata: sanitizeMetadata(item.metadata),
      });
    }

    if (imported.length === 0) return existing;
    const merged = [...imported, ...existing].sort((a, b) => b.epochMs - a.epochMs);
    persistLogs(merged);
    return cachedLogs || merged;
  } catch {
    return existing;
  }
}

export function getLogs(): ActivityLogEvent[] {
  // Re-read localStorage so cross-WebView events (IME process <-> Settings app) stay unified
  const disk = readLocalLogs();
  if (disk.length > 0 || cachedLogs === null) {
    cachedLogs = disk;
  }
  const unified = mergeNativeAndroidLogs(cachedLogs || []);
  return unified;
}

export async function refreshLogsFromStorage(): Promise<ActivityLogEvent[]> {
  let local = readLocalLogs();
  if (local.length === 0) {
    const idbLogs = await idbGet<ActivityLogEvent[]>(STORAGE_KEY_LOGS);
    if (Array.isArray(idbLogs) && idbLogs.length > 0) {
      local = idbLogs;
      persistLogs(local);
    }
  } else {
    cachedLogs = local;
  }
  const merged = mergeNativeAndroidLogs(cachedLogs || local);
  notifyListeners();
  return merged;
}

export function subscribeLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function logEvent(input: LogEventInput): ActivityLogEvent {
  const now = new Date();
  const env = getRuntimeEnvironment();
  const extracted = extractErrorDetails(input.error);

  const errorMessage = input.errorMessage
    ? sanitizeText(input.errorMessage, 400)
    : extracted.message;
  const stackTrace = input.stackTrace
    ? sanitizeText(input.stackTrace, MAX_STACK_LENGTH)
    : extracted.stack;

  const event: ActivityLogEvent = {
    id: generateId('evt'),
    timestamp: now.toISOString(),
    epochMs: now.getTime(),
    category: input.category,
    severity: input.severity,
    title: sanitizeText(input.title, 140),
    description: sanitizeText(input.description, MAX_STRING_LENGTH),
    component: sanitizeText(input.component, 80),
    operation: sanitizeText(input.operation, 80),
    status: sanitizeText(input.status || input.severity, 40),
    errorMessage,
    stackTrace,
    operationId: input.operationId,
    relatedEventId: input.relatedEventId,
    httpStatus: input.httpStatus,
    durationMs: typeof input.durationMs === 'number' ? Math.max(0, Math.round(input.durationMs)) : undefined,
    appVersion: env.appVersion,
    platform: env.platform,
    osVersion: env.osVersion,
    metadata: sanitizeMetadata(input.metadata),
  };

  try {
    const current = readLocalLogs();
    const next = [event, ...current];
    persistLogs(next);
  } catch {
    if (cachedLogs) {
      cachedLogs = [event, ...cachedLogs].slice(0, MAX_EVENTS);
    } else {
      cachedLogs = [event];
    }
    notifyListeners();
  }

  return event;
}

export function startOperation(params: {
  category: LogCategory;
  title: string;
  description: string;
  component: string;
  operation: string;
  metadata?: Record<string, unknown>;
}): OperationHandle {
  const operationId = generateId('op');
  const startMs = Date.now();

  const started = logEvent({
    category: params.category,
    severity: 'INFO',
    title: params.title,
    description: params.description,
    component: params.component,
    operation: params.operation,
    status: 'STARTED',
    operationId,
    metadata: params.metadata,
  });

  return {
    operationId,
    startedEventId: started.id,
    complete: (detail) =>
      logEvent({
        category: params.category,
        severity: 'SUCCESS',
        title: detail?.title || `${params.title} Completed`,
        description: detail?.description || `${params.operation} completed successfully.`,
        component: params.component,
        operation: params.operation,
        status: detail?.status || 'COMPLETED',
        httpStatus: detail?.httpStatus,
        durationMs: Date.now() - startMs,
        operationId,
        relatedEventId: started.id,
        metadata: detail?.metadata ?? params.metadata,
      }),
    cancel: (reason, metadata) =>
      logEvent({
        category: params.category,
        severity: 'WARNING',
        title: `${params.title} Cancelled`,
        description: reason || `${params.operation} was cancelled before completion.`,
        component: params.component,
        operation: params.operation,
        status: 'CANCELLED',
        durationMs: Date.now() - startMs,
        operationId,
        relatedEventId: started.id,
        metadata: metadata ?? params.metadata,
      }),
    fail: (error, detail) =>
      logEvent({
        category: detail?.category || (params.category === 'NETWORK' ? 'NETWORK' : 'ERRORS'),
        severity: detail?.severity || 'ERROR',
        title: detail?.title || `${params.title} Failed`,
        description: detail?.description || `${params.operation} encountered an error.`,
        component: params.component,
        operation: params.operation,
        status: 'FAILED',
        httpStatus: detail?.httpStatus,
        durationMs: Date.now() - startMs,
        operationId,
        relatedEventId: started.id,
        error,
        metadata: detail?.metadata ?? params.metadata,
      }),
  };
}

export function deleteLog(id: string): ActivityLogEvent[] {
  const current = getLogs();
  const next = current.filter((item) => item.id !== id);
  persistLogs(next);
  return next;
}

export function deleteLogs(ids: string[]): ActivityLogEvent[] {
  const idSet = new Set(ids);
  const current = getLogs();
  const next = current.filter((item) => !idSet.has(item.id));
  persistLogs(next);
  return next;
}

export function clearLogsByCategory(category: LogCategory): ActivityLogEvent[] {
  const current = getLogs();
  const next = current.filter((item) => item.category !== category);
  persistLogs(next);
  return next;
}

export function clearAllLogs(): ActivityLogEvent[] {
  cachedLogs = [];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY_LOGS);
    } catch {
      // ignore
    }
    try {
      window.AndroidAppSetup?.clearNativeLogs?.();
    } catch {
      // ignore
    }
    idbDelete(STORAGE_KEY_LOGS).catch(() => {});
  }
  notifyListeners();
  return [];
}

export function formatTimestampReadable(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

function formatEventBlock(event: ActivityLogEvent, index: number): string {
  const num = String(index + 1).padStart(3, '0');
  const lines: string[] = [
    `EVENT ${num}`,
    `Event ID: ${event.id}`,
    `Category: ${event.category}`,
    `Severity: ${event.severity}`,
    `Event: ${event.title}`,
    `Time: ${formatTimestampReadable(event.timestamp)} (${event.timestamp})`,
    `Component: ${event.component}`,
    `Operation: ${event.operation}`,
    `Status: ${event.status}`,
  ];

  if (event.operationId) {
    lines.push(`Operation ID: ${event.operationId}`);
  }
  if (event.relatedEventId) {
    lines.push(`Related Event ID: ${event.relatedEventId}`);
  }
  if (typeof event.httpStatus === 'number') {
    lines.push(`HTTP Status: ${event.httpStatus}`);
  }
  if (typeof event.durationMs === 'number') {
    lines.push(`Duration: ${event.durationMs}ms`);
  }
  if (event.description) {
    lines.push(`Description: ${event.description}`);
  }
  if (event.errorMessage) {
    lines.push(`Error: ${event.errorMessage}`);
  }
  if (event.metadata && Object.keys(event.metadata).length > 0) {
    lines.push('Metadata:');
    for (const [k, v] of Object.entries(event.metadata)) {
      lines.push(`  - ${k}: ${v === null ? 'null' : String(v)}`);
    }
  }
  if (event.stackTrace) {
    lines.push('Stack Trace:');
    lines.push(event.stackTrace);
  }
  lines.push('----------------------------------------');
  return lines.join('\n');
}

export function formatSingleReport(event: ActivityLogEvent): string {
  const generated = formatTimestampReadable(new Date().toISOString());
  const header = [
    '========================================',
    'APPLICATION ACTIVITY REPORT',
    '========================================',
    `Application: ${APP_DISPLAY_NAME}`,
    `Version: ${event.appVersion}`,
    `Platform: ${event.platform} / ${event.osVersion}`,
    `Generated: ${generated}`,
    'Total Events: 1',
    '----------------------------------------',
  ].join('\n');

  return `${header}\n${formatEventBlock(event, 0)}\n========================================\nEND OF REPORT\n========================================`;
}

export function formatMultipleReports(
  events: ActivityLogEvent[],
  filterSummary?: string
): { text: string; tooLarge: boolean; charCount: number } {
  const env = getRuntimeEnvironment();
  const generated = formatTimestampReadable(new Date().toISOString());
  // Present reports in chronological order (oldest -> newest) for clear troubleshooting trace
  const chronological = [...events].sort((a, b) => a.epochMs - b.epochMs);

  const headerLines = [
    '========================================',
    'APPLICATION ACTIVITY REPORT',
    '========================================',
    `Application: ${APP_DISPLAY_NAME}`,
    `Version: ${env.appVersion}`,
    `Platform: ${env.platform} / ${env.osVersion}`,
    `Generated: ${generated}`,
    `Total Events: ${chronological.length}`,
  ];
  if (filterSummary) {
    headerLines.push(`Filter: ${filterSummary}`);
  }
  headerLines.push('----------------------------------------');

  const body = chronological.map((evt, idx) => formatEventBlock(evt, idx)).join('\n');
  const text = `${headerLines.join('\n')}\n${body}\n========================================\nEND OF REPORT\n========================================`;

  return {
    text,
    tooLarge: text.length > MAX_CLIPBOARD_CHARS,
    charCount: text.length,
  };
}

function shouldInstrumentFetchUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  // Skip noisy local static asset requests (icons/fonts/js/css chunks) unless they fail
  const lower = rawUrl.toLowerCase();
  const isStatic =
    /\.(png|jpg|jpeg|webp|svg|woff2?|ttf|otf|css|js|ico)(\?|$)/i.test(lower) &&
    !lower.includes('/api/');
  return !isStatic;
}

function installNetworkInterceptor(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const win = window as unknown as { __kurdiFetchInstrumented?: boolean };
  if (win.__kurdiFetchInstrumented) return;
  win.__kurdiFetchInstrumented = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input?.url || '';
    const method = (
      init?.method ||
      (typeof input === 'object' && input && 'method' in input ? input.method : 'GET') ||
      'GET'
    ).toUpperCase();

    const safeUrl = sanitizeUrl(rawUrl);
    const trackSuccess = shouldInstrumentFetchUrl(rawUrl);
    const startMs = Date.now();
    const opId = trackSuccess ? generateId('net') : undefined;

    if (trackSuccess) {
      logEvent({
        category: 'NETWORK',
        severity: 'DEBUG',
        title: `HTTP ${method} Request Started`,
        description: `Sending ${method} request to ${safeUrl}`,
        component: 'NetworkLayer',
        operation: 'http_request',
        status: 'STARTED',
        operationId: opId,
        metadata: { method, url: safeUrl },
      });
    }

    try {
      const response = await originalFetch(input, init);
      const durationMs = Date.now() - startMs;

      if (!response.ok) {
        logEvent({
          category: 'NETWORK',
          severity: response.status >= 500 ? 'ERROR' : 'WARNING',
          title: `HTTP ${method} ${response.status} Error`,
          description: `Request to ${safeUrl} returned HTTP ${response.status} ${response.statusText || ''}`.trim(),
          component: 'NetworkLayer',
          operation: 'http_request',
          status: 'FAILED',
          httpStatus: response.status,
          durationMs,
          operationId: opId,
          errorMessage: `HTTP ${response.status} ${response.statusText || ''}`.trim(),
          metadata: { method, url: safeUrl, ok: false },
        });
      } else if (trackSuccess) {
        logEvent({
          category: 'NETWORK',
          severity: 'SUCCESS',
          title: `HTTP ${method} ${response.status} OK`,
          description: `Completed ${method} request to ${safeUrl} in ${durationMs}ms.`,
          component: 'NetworkLayer',
          operation: 'http_request',
          status: 'COMPLETED',
          httpStatus: response.status,
          durationMs,
          operationId: opId,
          metadata: { method, url: safeUrl, ok: true },
        });
      }

      return response;
    } catch (err: unknown) {
      const durationMs = Date.now() - startMs;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      logEvent({
        category: 'NETWORK',
        severity: isAbort ? 'WARNING' : 'ERROR',
        title: isAbort ? `HTTP ${method} Request Timed Out / Aborted` : `HTTP ${method} Connection Failed`,
        description: isAbort
          ? `Request to ${safeUrl} was aborted or timed out after ${durationMs}ms.`
          : `Network failure while calling ${safeUrl} after ${durationMs}ms.`,
        component: 'NetworkLayer',
        operation: 'http_request',
        status: isAbort ? 'CANCELLED' : 'FAILED',
        durationMs,
        operationId: opId,
        error: err,
        metadata: {
          method,
          url: safeUrl,
          online: typeof navigator !== 'undefined' ? navigator.onLine : true,
          aborted: isAbort,
        },
      });
      throw err;
    }
  };
}

export function initDiagnosticsSystem(context: {
  mode: 'app' | 'ime';
  appTheme?: string;
  appLanguage?: string;
}): void {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;

  // Hook IndexedDB storage errors into diagnostic log silently
  setStorageErrorListener((op, key, err) => {
    if (key === STORAGE_KEY_LOGS || storageFailSilenced) return;
    logEvent({
      category: 'STORAGE',
      severity: 'ERROR',
      title: `IndexedDB ${op} Failed`,
      description: `Database operation "${op}" failed for key "${key}".`,
      component: 'PersistentStorage',
      operation: op,
      status: 'FAILED',
      error: err,
      metadata: { storageEngine: 'IndexedDB', key },
    });
  });

  // Merge any queued native Android events (including native crashes from prior run)
  mergeNativeAndroidLogs(readLocalLogs());

  // Detect unexpected termination from previous active session (settings app only)
  if (context.mode === 'app') {
    try {
      const prevActive = window.localStorage.getItem(STORAGE_KEY_SESSION_ACTIVE);
      const prevMetaRaw = window.localStorage.getItem(STORAGE_KEY_SESSION_META);
      if (prevActive === '1') {
        let prevMeta: Record<string, unknown> = {};
        try {
          if (prevMetaRaw) prevMeta = JSON.parse(prevMetaRaw);
        } catch {
          // ignore malformed meta
        }
        logEvent({
          category: 'WARNINGS',
          severity: 'WARNING',
          title: 'Previous Session Ended Unexpectedly',
          description:
            'The previous application session did not record a clean shutdown event (possible process kill, crash, or forced close).',
          component: 'AppLifecycle',
          operation: 'session_recovery_check',
          status: 'WARNING',
          metadata: {
            previousStartedAt: typeof prevMeta.startedAt === 'string' ? prevMeta.startedAt : 'unknown',
            previousMode: typeof prevMeta.mode === 'string' ? prevMeta.mode : 'app',
          },
        });
      }
      window.localStorage.setItem(STORAGE_KEY_SESSION_ACTIVE, '1');
      window.localStorage.setItem(
        STORAGE_KEY_SESSION_META,
        JSON.stringify({ startedAt: new Date().toISOString(), mode: context.mode })
      );
    } catch {
      // ignore storage errors
    }
  }

  // Record Application Started event
  logEvent({
    category: 'APPLICATION',
    severity: 'INFO',
    title: context.mode === 'ime' ? 'KurdiKeyboard IME Service Started' : 'Application Started',
    description:
      context.mode === 'ime'
        ? 'Native Android InputMethodService WebView initialized.'
        : 'KurdiKeyboard application initialized and ready.',
    component: context.mode === 'ime' ? 'ImeWebView' : 'AppLifecycle',
    operation: 'app_start',
    status: 'COMPLETED',
    metadata: {
      mode: context.mode,
      appTheme: context.appTheme || 'unknown',
      appLanguage: context.appLanguage || 'ckb',
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    },
  });

  // Install global fetch instrumentation
  installNetworkInterceptor();

  // Global uncaught JavaScript errors & resource load errors
  window.addEventListener(
    'error',
    (ev: Event) => {
      const errEv = ev as ErrorEvent;
      if (errEv.error || errEv.message) {
        logEvent({
          category: 'ERRORS',
          severity: 'ERROR',
          title: 'Unhandled JavaScript Exception',
          description: errEv.message || 'An unhandled JavaScript error occurred.',
          component: 'WindowErrorHandler',
          operation: 'uncaught_error',
          status: 'FAILED',
          error: errEv.error,
          errorMessage: errEv.message,
          metadata: {
            source: errEv.filename ? sanitizeUrl(errEv.filename) : undefined,
            line: errEv.lineno || undefined,
            column: errEv.colno || undefined,
          },
        });
      } else {
        const target = ev.target as HTMLElement | null;
        if (target && target.tagName) {
          const src =
            (target as HTMLImageElement).src ||
            (target as HTMLLinkElement).href ||
            '';
          logEvent({
            category: 'WARNINGS',
            severity: 'WARNING',
            title: `Resource Load Failed (${target.tagName})`,
            description: `Failed to load ${target.tagName.toLowerCase()} resource.`,
            component: 'ResourceLoader',
            operation: 'resource_load',
            status: 'FAILED',
            metadata: { tag: target.tagName, url: sanitizeUrl(src) },
          });
        }
      }
    },
    true
  );

  // Global unhandled promise rejections
  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    logEvent({
      category: 'ERRORS',
      severity: 'ERROR',
      title: 'Unhandled Promise Rejection',
      description: 'An asynchronous operation rejected without a catch handler.',
      component: 'PromiseRejectionHandler',
      operation: 'unhandled_rejection',
      status: 'FAILED',
      error: ev.reason,
    });
  });

  // Application lifecycle: pause / background / resume
  document.addEventListener('visibilitychange', () => {
    const hidden = document.visibilityState === 'hidden';
    logEvent({
      category: 'APPLICATION',
      severity: 'DEBUG',
      title: hidden ? 'Application Moved to Background' : 'Application Resumed',
      description: hidden
        ? 'Document visibility changed to hidden (paused/backgrounded).'
        : 'Document visibility changed to visible (resumed foreground).',
      component: 'AppLifecycle',
      operation: hidden ? 'app_background' : 'app_resume',
      status: 'INFO',
      metadata: { visibilityState: document.visibilityState, mode: context.mode },
    });
  });

  // Clean shutdown marker
  const markCleanClose = (trigger: string) => {
    try {
      if (context.mode === 'app') {
        window.localStorage.setItem(STORAGE_KEY_SESSION_ACTIVE, '0');
      }
    } catch {
      // ignore
    }
    logEvent({
      category: 'APPLICATION',
      severity: 'INFO',
      title: 'Application Closing Normally',
      description: `Lifecycle termination event "${trigger}" observed.`,
      component: 'AppLifecycle',
      operation: 'app_close',
      status: 'COMPLETED',
      metadata: { trigger, mode: context.mode },
    });
  };
  window.addEventListener('pagehide', () => markCleanClose('pagehide'));

  // Network connectivity transitions
  window.addEventListener('offline', () => {
    logEvent({
      category: 'NETWORK',
      severity: 'WARNING',
      title: 'Network Connectivity Lost',
      description: 'Device transitioned to offline state.',
      component: 'NetworkMonitor',
      operation: 'connectivity_change',
      status: 'WARNING',
      metadata: { online: false },
    });
  });
  window.addEventListener('online', () => {
    logEvent({
      category: 'NETWORK',
      severity: 'INFO',
      title: 'Network Connectivity Restored',
      description: 'Device transitioned back to online state.',
      component: 'NetworkMonitor',
      operation: 'connectivity_change',
      status: 'COMPLETED',
      metadata: { online: true },
    });
  });

  // Configuration changes (debounced viewport / orientation changes)
  let resizeTimer: number | null = null;
  let lastSize = `${window.innerWidth}x${window.innerHeight}`;
  window.addEventListener('resize', () => {
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const nextSize = `${window.innerWidth}x${window.innerHeight}`;
      if (nextSize === lastSize) return;
      const prevSize = lastSize;
      lastSize = nextSize;
      logEvent({
        category: 'APPLICATION',
        severity: 'DEBUG',
        title: 'Viewport Configuration Changed',
        description: `Viewport dimensions changed from ${prevSize} to ${nextSize}.`,
        component: 'AppLifecycle',
        operation: 'configuration_change',
        status: 'INFO',
        metadata: {
          previousViewport: prevSize,
          currentViewport: nextSize,
          orientation: window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
        },
      });
    }, 600);
  });

  // Cross-tab / cross-WebView storage synchronization for live report refresh
  window.addEventListener('storage', (ev) => {
    if (ev.key === STORAGE_KEY_LOGS) {
      cachedLogs = readLocalLogs();
      notifyListeners();
    }
  });
}
