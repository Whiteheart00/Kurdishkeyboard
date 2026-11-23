import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  RefreshCw,
  Search,
  Share2,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { KeyboardSettings } from '../../types/keyboard';
import { getAppDirection } from '../../data/officialData';
import {
  ActivityLogEvent,
  clearAllLogs,
  clearLogsByCategory,
  deleteLog,
  deleteLogs,
  formatMultipleReports,
  formatSingleReport,
  formatTimestampReadable,
  getLogs,
  LogCategory,
  LogSeverity,
  refreshLogsFromStorage,
  subscribeLogs,
} from '../../utils/activityLogger';
import { SubPageHeader } from './SettingsUI';

interface ActivityLogsScreenProps {
  settings: KeyboardSettings;
  onBack: () => void;
  isLightApp: boolean;
}

type CategoryFilter = 'ALL' | LogCategory;
type SeverityFilter = 'ALL' | LogSeverity;

type PendingConfirmation =
  | { type: 'single'; id: string; title: string }
  | { type: 'selected'; ids: string[] }
  | { type: 'category'; category: LogCategory; count: number }
  | { type: 'all'; count: number };

const CATEGORY_OPTIONS: { id: CategoryFilter; labelEn: string; labelKu: string }[] = [
  { id: 'ALL', labelEn: 'All Events', labelKu: 'هەموو ڕووداوەکان' },
  { id: 'APPLICATION', labelEn: 'Application', labelKu: 'بەرنامە' },
  { id: 'USER_OPERATIONS', labelEn: 'User Operations', labelKu: 'کردارەکان' },
  { id: 'NETWORK', labelEn: 'Network', labelKu: 'تۆڕ و API' },
  { id: 'STORAGE', labelEn: 'Storage', labelKu: 'بیرگە و فایل' },
  { id: 'BACKGROUND_TASKS', labelEn: 'Background Tasks', labelKu: 'پاشبنەما' },
  { id: 'WARNINGS', labelEn: 'Warnings', labelKu: 'ئاگادارکردنەوە' },
  { id: 'ERRORS', labelEn: 'Errors', labelKu: 'هەڵەکان' },
  { id: 'CRASHES', labelEn: 'Crashes', labelKu: 'پەککەوتن' },
];

const SEVERITY_OPTIONS: SeverityFilter[] = [
  'ALL',
  'DEBUG',
  'INFO',
  'SUCCESS',
  'WARNING',
  'ERROR',
  'CRITICAL',
];

const PAGE_SIZE = 50;

function getSeverityStyles(severity: LogSeverity, isLight: boolean): string {
  switch (severity) {
    case 'CRITICAL':
      return isLight
        ? 'bg-red-100 text-red-800 border-red-300'
        : 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'ERROR':
      return isLight
        ? 'bg-rose-100 text-rose-800 border-rose-300'
        : 'bg-rose-500/20 text-rose-300 border-rose-500/35';
    case 'WARNING':
      return isLight
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-amber-500/20 text-amber-300 border-amber-500/35';
    case 'SUCCESS':
      return isLight
        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35';
    case 'INFO':
      return isLight
        ? 'bg-sky-100 text-sky-800 border-sky-300'
        : 'bg-sky-500/20 text-sky-300 border-sky-500/35';
    case 'DEBUG':
    default:
      return isLight
        ? 'bg-slate-200 text-slate-700 border-slate-300'
        : 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40';
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand below (often needed inside Android WebView)
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function downloadReportFile(content: string, filename: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.AndroidAppSetup?.saveFileToDownloads) {
      const raw = window.AndroidAppSetup.saveFileToDownloads(filename, 'text/plain', content);
      const parsed = JSON.parse(raw || '{}') as { ok?: boolean; path?: string };
      if (parsed.ok) {
        return parsed.path || `Download/${filename}`;
      }
      return null;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return `Download/${filename}`;
  } catch {
    return null;
  }
}

export const ActivityLogsScreen: React.FC<ActivityLogsScreenProps> = ({
  settings,
  onBack,
  isLightApp,
}) => {
  const lang = settings.appLanguage || 'ckb';
  const dir = getAppDirection(lang);
  const isEnglish = lang === 'en';

  const [logs, setLogs] = useState<ActivityLogEvent[]>(() => getLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [inlineNotice, setInlineNotice] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
    tooLargePayload?: string;
  } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback(
    (
      message: string,
      tone: 'success' | 'warning' | 'error' = 'success',
      tooLargePayload?: string
    ) => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
      setInlineNotice({ tone, message, tooLargePayload });
      if (!tooLargePayload) {
        noticeTimerRef.current = window.setTimeout(() => {
          noticeTimerRef.current = null;
          setInlineNotice(null);
        }, 3800);
      }
    },
    []
  );

  useEffect(() => {
    refreshLogsFromStorage().then((latest) => setLogs(latest));
    const unsub = subscribeLogs(() => {
      setLogs(getLogs());
    });
    return () => {
      unsub();
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: logs.length };
    for (const item of logs) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((evt) => {
      if (categoryFilter !== 'ALL' && evt.category !== categoryFilter) return false;
      if (severityFilter !== 'ALL' && evt.severity !== severityFilter) return false;
      if (!q) return true;
      const haystack = [
        evt.id,
        evt.title,
        evt.description,
        evt.component,
        evt.operation,
        evt.status,
        evt.category,
        evt.severity,
        evt.errorMessage || '',
        evt.operationId || '',
        evt.metadata ? JSON.stringify(evt.metadata) : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, categoryFilter, severityFilter, searchQuery]);

  const visibleLogs = useMemo(
    () => filteredLogs.slice(0, visibleLimit),
    [filteredLogs, visibleLimit]
  );

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [categoryFilter, severityFilter, searchQuery]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const latest = await refreshLogsFromStorage();
    setLogs(latest);
    window.setTimeout(() => setRefreshing(false), 260);
    showNotice(
      isEnglish
        ? `Refreshed (${latest.length} saved reports).`
        : `نوێکرایەوە (${latest.length} ڕاپۆرتی هەڵگیراو).`
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopySingle = async (evt: ActivityLogEvent) => {
    const formatted = formatSingleReport(evt);
    const ok = await copyTextToClipboard(formatted);
    if (ok) {
      showNotice(
        isEnglish
          ? `Copied report "${evt.title}" to clipboard.`
          : `ڕاپۆرتی "${evt.title}" کۆپی کرا.`
      );
    } else {
      showNotice(
        isEnglish ? 'Unable to access clipboard on this device.' : 'دەستگەیشتن بە کلیپبۆرد سەرکەوتوو نەبوو.',
        'error'
      );
    }
  };

  const handleCopyBatch = async (targetEvents: ActivityLogEvent[], scopeLabel: string) => {
    if (targetEvents.length === 0) {
      showNotice(
        isEnglish ? 'No reports available to copy.' : 'هیچ ڕاپۆرتێک نییە بۆ کۆپیکردن.',
        'warning'
      );
      return;
    }
    const { text, tooLarge } = formatMultipleReports(targetEvents, scopeLabel);
    if (tooLarge) {
      showNotice(
        isEnglish
          ? `Report batch (${targetEvents.length} events) exceeds safe clipboard size. Use Export (.txt) or Share below.`
          : `قەبارەی ڕاپۆرتەکان (${targetEvents.length} ڕووداو) زۆر گەورەیە بۆ کۆپیکردن. تکایە دابەزاندن یان هاوبەشکردن بەکاربهێنە.`,
        'warning',
        text
      );
      return;
    }
    const ok = await copyTextToClipboard(text);
    if (ok) {
      showNotice(
        isEnglish
          ? `Copied ${targetEvents.length} report(s) to clipboard.`
          : `${targetEvents.length} ڕاپۆرت بە سەرکەوتوویی کۆپی کران.`
      );
    } else {
      showNotice(
        isEnglish
          ? 'Clipboard copy failed. You can export the report as a .txt file instead.'
          : 'کۆپیکردن سەرکەوتوو نەبوو. دەتوانیت وەک فایلی .txt دایبەزێنیت.',
        'warning',
        text
      );
    }
  };

  const handleShareOrExport = async (
    targetEvents: ActivityLogEvent[],
    mode: 'share' | 'export',
    rawPayloadOverride?: string
  ) => {
    if (!rawPayloadOverride && targetEvents.length === 0) {
      showNotice(
        isEnglish ? 'No reports available.' : 'هیچ ڕاپۆرتێک نییە.',
        'warning'
      );
      return;
    }
    const filterSummary =
      categoryFilter !== 'ALL' || severityFilter !== 'ALL' || searchQuery.trim()
        ? `Category=${categoryFilter}, Severity=${severityFilter}${
            searchQuery.trim() ? `, Search="${searchQuery.trim()}"` : ''
          }`
        : 'All Saved Reports';
    const text =
      rawPayloadOverride ?? formatMultipleReports(targetEvents, filterSummary).text;
    const timestampTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `kurdikeyboard-activity-report-${timestampTag}.txt`;

    if (mode === 'share') {
      // Native Android share sheet inside APK
      if (typeof window !== 'undefined' && window.AndroidAppSetup?.shareText) {
        try {
          window.AndroidAppSetup.shareText('KurdiKeyboard Activity Report', text);
          showNotice(
            isEnglish ? 'Opened Android share sheet.' : 'پەنجەرەی هاوبەشکردنی ئەندرۆید کرایەوە.'
          );
          return;
        } catch {
          // Fall through to Web Share / download
        }
      }
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: 'KurdiKeyboard Activity Logs & Reports',
            text,
          });
          showNotice(
            isEnglish ? 'Report shared successfully.' : 'ڕاپۆرتەکە بە سەرکەوتوویی هاوبەش کرا.'
          );
          return;
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          // Fall back to .txt download if Web Share is unavailable or payload too large
        }
      }
    }

    const savedPath = downloadReportFile(text, filename);
    if (savedPath) {
      showNotice(
        isEnglish
          ? `Saved diagnostic report to ${savedPath}`
          : `ڕاپۆرتەکە لە بەشی Download پاشەکەوت کرا (${savedPath})`
      );
    } else {
      showNotice(
        isEnglish ? 'Failed to export report file.' : 'دابەزاندنی فایلی ڕاپۆرت سەرکەوتوو نەبوو.',
        'error'
      );
    }
  };

  const executeConfirmedDelete = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.type === 'single') {
      const next = deleteLog(pendingConfirm.id);
      setLogs(next);
      setSelectedIds((prev) => {
        const s = new Set(prev);
        s.delete(pendingConfirm.id);
        return s;
      });
      showNotice(isEnglish ? 'Report deleted.' : 'ڕاپۆرتەکە سڕایەوە.');
    } else if (pendingConfirm.type === 'selected') {
      const count = pendingConfirm.ids.length;
      const next = deleteLogs(pendingConfirm.ids);
      setLogs(next);
      setSelectedIds(new Set());
      setSelectionMode(false);
      showNotice(
        isEnglish
          ? `Deleted ${count} selected report(s).`
          : `${count} ڕاپۆرتی هەڵبژێردراو سڕانەوە.`
      );
    } else if (pendingConfirm.type === 'category') {
      const cat = pendingConfirm.category;
      const next = clearLogsByCategory(cat);
      setLogs(next);
      setSelectedIds(new Set());
      showNotice(
        isEnglish
          ? `Cleared all reports in category "${cat}".`
          : `هەموو ڕاپۆرتەکانی بەشی "${cat}" سڕانەوە.`
      );
    } else if (pendingConfirm.type === 'all') {
      clearAllLogs();
      setLogs([]);
      setSelectedIds(new Set());
      setExpandedIds(new Set());
      setSelectionMode(false);
      showNotice(
        isEnglish ? 'All saved reports were cleared.' : 'هەموو ڕاپۆرتە هەڵگیراوەکان سڕانەوە.'
      );
    }
    setPendingConfirm(null);
  };

  const cardSurface = isLightApp
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-[#12141A] border-white/[0.08] text-white';
  const subtleSurface = isLightApp
    ? 'bg-slate-100 border-slate-200 text-slate-700'
    : 'bg-[#181B23] border-white/[0.08] text-zinc-200';
  const mutedText = isLightApp ? 'text-slate-500' : 'text-zinc-400';

  const hasActiveFilter =
    categoryFilter !== 'ALL' || severityFilter !== 'ALL' || searchQuery.trim().length > 0;

  return (
    <div className="min-h-full flex flex-col pb-24" dir={dir}>
      <SubPageHeader
        title={isEnglish ? 'Activity Logs & Reports' : 'تۆماری چالاکی و ڕاپۆرتەکان'}
        onBack={onBack}
        isLightApp={isLightApp}
        leftAction={
          <button
            type="button"
            onClick={handleRefresh}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              isLightApp
                ? 'hover:bg-slate-100 text-slate-700'
                : 'hover:bg-white/10 text-zinc-200'
            }`}
            aria-label="Refresh reports"
            title={isEnglish ? 'Refresh' : 'نوێکردنەوە'}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      <div className="px-4 pt-3 space-y-3">
        {/* Subtitle & Report Count Summary Bar */}
        <div className={`rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-2 ${cardSurface}`}>
          <div className="min-w-0">
            <div className="text-xs font-extrabold">
              {isEnglish ? 'Activity Logs & Reports' : 'Activity Logs & Reports'}
            </div>
            <div className={`text-[11px] mt-0.5 ${mutedText}`}>
              {isEnglish
                ? `${logs.length} saved · ${filteredLogs.length} matching`
                : `${logs.length} تۆمار هەڵگیراوە · ${filteredLogs.length} پیشاندراوە`}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectionMode((prev) => {
                  if (prev) setSelectedIds(new Set());
                  return !prev;
                });
                setPendingConfirm(null);
              }}
              className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                selectionMode
                  ? 'bg-[#0B5FA8] text-white border-[#0B5FA8]'
                  : subtleSurface
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isEnglish ? 'Select' : 'هەڵبژاردن'}</span>
            </button>
          </div>
        </div>

        {/* Inline Non-Intrusive Feedback Strip (Copy / Share / Delete / Too-Large Export) */}
        {inlineNotice && (
          <div
            className={`rounded-2xl border p-3 text-xs space-y-2 ${
              inlineNotice.tone === 'error'
                ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                : inlineNotice.tone === 'warning'
                ? 'bg-amber-500/15 border-amber-500/35 text-amber-200'
                : isLightApp
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 font-bold leading-relaxed">
                <Check className="w-4 h-4 shrink-0" />
                <span>{inlineNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setInlineNotice(null)}
                className="p-0.5 rounded-lg opacity-75 hover:opacity-100 shrink-0"
                aria-label="Dismiss message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {inlineNotice.tooLargePayload && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    handleShareOrExport(filteredLogs, 'export', inlineNotice.tooLargePayload)
                  }
                  className="h-8 px-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-[11px] flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isEnglish ? 'Export .txt File' : 'دابەزاندنی فایل (.txt)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleShareOrExport(filteredLogs, 'share', inlineNotice.tooLargePayload)
                  }
                  className="h-8 px-3 rounded-xl bg-white/10 border border-white/15 font-bold text-[11px] flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isEnglish ? 'Share' : 'هاوبەشکردن'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inline Destructive Action Confirmation (Zero System Popups) */}
        {pendingConfirm && (
          <div
            className={`rounded-2xl border p-3.5 space-y-2.5 ${
              isLightApp
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-100'
            }`}
          >
            <div className="text-xs font-extrabold">
              {pendingConfirm.type === 'single'
                ? isEnglish
                  ? `Delete report "${pendingConfirm.title}" permanently?`
                  : `دڵنیایت لە سڕینەوەی ڕاپۆرتی "${pendingConfirm.title}"؟`
                : pendingConfirm.type === 'selected'
                ? isEnglish
                  ? `Permanently delete ${pendingConfirm.ids.length} selected report(s)?`
                  : `دڵنیایت لە سڕینەوەی ${pendingConfirm.ids.length} ڕاپۆرتی هەڵبژێردراو؟`
                : pendingConfirm.type === 'category'
                ? isEnglish
                  ? `Clear all ${pendingConfirm.count} report(s) in category ${pendingConfirm.category}?`
                  : `دڵنیایت لە سڕینەوەی هەموو ${pendingConfirm.count} ڕاپۆرتەکانی بەشی ${pendingConfirm.category}؟`
                : isEnglish
                ? `Clear all ${pendingConfirm.count} saved reports permanently?`
                : `دڵنیایت لە سڕینەوەی هەموو ${pendingConfirm.count} ڕاپۆرتە هەڵگیراوەکان؟`}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={executeConfirmedDelete}
                className="h-8 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold transition-colors"
              >
                {isEnglish ? 'Confirm Delete' : 'بەڵێ، بیسڕەوە'}
              </button>
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className={`h-8 px-3.5 rounded-xl border text-xs font-bold transition-colors ${subtleSurface}`}
              >
                {isEnglish ? 'Cancel' : 'پاشگەزبوونەوە'}
              </button>
            </div>
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search
            className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 ${
              dir === 'rtl' ? 'right-3.5' : 'left-3.5'
            } ${mutedText}`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isEnglish
                ? 'Search events, errors, components, operations...'
                : 'گەڕان لە ناونیشان، هەڵە، پێکهاتە، کردار...'
            }
            className={`w-full h-10 rounded-2xl border text-xs font-medium outline-none transition-colors ${
              dir === 'rtl' ? 'pr-10 pl-9' : 'pl-10 pr-9'
            } ${
              isLightApp
                ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-sky-500'
                : 'bg-[#12141A] border-white/10 text-white placeholder:text-zinc-500 focus:border-sky-400/60'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-1/2 -translate-y-1/2 p-1 rounded-full ${
                dir === 'rtl' ? 'left-2.5' : 'right-2.5'
              } ${mutedText}`}
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORY_OPTIONS.map((cat) => {
            const active = categoryFilter === cat.id;
            const count = categoryCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`h-8 px-3 rounded-xl border text-[11px] font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-[#0B5FA8] text-white border-[#0B5FA8]'
                    : subtleSurface
                }`}
              >
                <span>{isEnglish ? cat.labelEn : cat.labelKu}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    active ? 'bg-white/20 text-white' : isLightApp ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Severity Filter Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar" dir="ltr">
          {SEVERITY_OPTIONS.map((sev) => {
            const active = severityFilter === sev;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`h-7 px-2.5 rounded-lg border text-[10.5px] font-extrabold tracking-wide whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-sky-500 text-white border-sky-500'
                    : sev === 'ALL'
                    ? subtleSurface
                    : getSeverityStyles(sev, isLightApp)
                }`}
              >
                {sev}
              </button>
            );
          })}
        </div>

        {/* Action Toolbar: Copy All, Copy Filtered, Share, Export, Clear Category, Clear All */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleCopyBatch(logs, 'All Saved Reports')}
            disabled={logs.length === 0}
            className="h-9 px-2.5 rounded-xl bg-[#0B5FA8] hover:bg-[#0E70C4] disabled:opacity-40 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Copy className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isEnglish ? 'Copy All' : 'کۆپی هەمووی'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleCopyBatch(
                filteredLogs,
                `Category=${categoryFilter}, Severity=${severityFilter}${
                  searchQuery.trim() ? `, Search="${searchQuery.trim()}"` : ''
                }`
              )
            }
            disabled={filteredLogs.length === 0}
            className={`h-9 px-2.5 rounded-xl border disabled:opacity-40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${subtleSurface}`}
          >
            <Copy className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {isEnglish ? 'Copy Filtered' : 'کۆپی فلتەرکراو'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleShareOrExport(hasActiveFilter ? filteredLogs : logs, 'share')}
            disabled={logs.length === 0}
            className={`h-9 px-2.5 rounded-xl border disabled:opacity-40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${subtleSurface}`}
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isEnglish ? 'Share' : 'هاوبەشکردن'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleShareOrExport(hasActiveFilter ? filteredLogs : logs, 'export')}
            disabled={logs.length === 0}
            className={`h-9 px-2.5 rounded-xl border disabled:opacity-40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${subtleSurface}`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isEnglish ? 'Export .txt' : 'دابەزاندن .txt'}</span>
          </button>
        </div>

        {/* Destructive Management Row (Clear Category / Clear All) */}
        <div className="flex flex-wrap items-center gap-2">
          {categoryFilter !== 'ALL' && (categoryCounts[categoryFilter] || 0) > 0 && (
            <button
              type="button"
              onClick={() =>
                setPendingConfirm({
                  type: 'category',
                  category: categoryFilter,
                  count: categoryCounts[categoryFilter] || 0,
                })
              }
              className="h-8 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {isEnglish
                  ? `Clear ${categoryFilter}`
                  : `پاککردنەوەی بەشی ${categoryFilter}`}
              </span>
            </button>
          )}

          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setPendingConfirm({ type: 'all', count: logs.length })}
              className="h-8 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isEnglish ? 'Clear All Reports' : 'سڕینەوەی هەموو ڕاپۆرتەکان'}</span>
            </button>
          )}
        </div>

        {/* Multi-Select Toolbar */}
        {selectionMode && (
          <div
            className={`rounded-2xl border p-2.5 flex flex-wrap items-center justify-between gap-2 ${
              isLightApp
                ? 'bg-sky-50 border-sky-200 text-slate-900'
                : 'bg-[#0C1A2B] border-sky-500/30 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.size === filteredLogs.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(filteredLogs.map((e) => e.id)));
                  }
                }}
                className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold ${subtleSurface}`}
              >
                {selectedIds.size === filteredLogs.length && filteredLogs.length > 0
                  ? isEnglish
                    ? 'Deselect All'
                    : 'لابردنی هەمووی'
                  : isEnglish
                  ? `Select All (${filteredLogs.length})`
                  : `هەڵبژاردنی هەمووی (${filteredLogs.length})`}
              </button>
              <span className="text-[11px] font-bold">
                {isEnglish ? `${selectedIds.size} selected` : `${selectedIds.size} هەڵبژێردراو`}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() =>
                  setPendingConfirm({
                    type: 'selected',
                    ids: Array.from(selectedIds),
                  })
                }
                className="h-8 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[11px] font-extrabold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isEnglish ? 'Delete Selected' : 'سڕینەوەی هەڵبژێردراو'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                }}
                className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold ${subtleSurface}`}
              >
                {isEnglish ? 'Done' : 'تەواو'}
              </button>
            </div>
          </div>
        )}

        {/* Chronological Event List */}
        {filteredLogs.length === 0 ? (
          <div className={`rounded-3xl border p-8 text-center space-y-2 ${cardSurface}`}>
            <div className="text-sm font-extrabold">
              {logs.length === 0
                ? isEnglish
                  ? 'No Activity Reports Recorded Yet'
                  : 'هێشتا هیچ ڕاپۆرتێک تۆمار نەکراوە'
                : isEnglish
                ? 'No Matching Reports Found'
                : 'هیچ ڕاپۆرتێک بەپێی ئەم فلتەرە نەدۆزرایەوە'}
            </div>
            <p className={`text-xs leading-relaxed ${mutedText}`}>
              {logs.length === 0
                ? isEnglish
                  ? 'Application operations, network activity, storage events, warnings, and errors are recorded silently here.'
                  : 'چالاکییەکانی بەرنامە، تۆڕ، بیرگە، ئاگادارکردنەوە و هەڵەکان بە بێدەنگی لێرەدا تۆمار دەکرێن.'
                : isEnglish
                ? 'Try clearing your search query or switching category/severity filters.'
                : 'گەڕانەکە پاک بکەرەوە یان فلتەری بەش و گرنگی بگۆڕە.'}
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('ALL');
                  setSeverityFilter('ALL');
                  setSearchQuery('');
                }}
                className="mt-2 h-8 px-3.5 rounded-xl bg-[#0B5FA8] text-white text-xs font-bold"
              >
                {isEnglish ? 'Reset Filters' : 'پاککردنەوەی فلتەرەکان'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleLogs.map((evt) => {
              const isExpanded = expandedIds.has(evt.id);
              const isSelected = selectedIds.has(evt.id);
              return (
                <div
                  key={evt.id}
                  className={`rounded-2xl border overflow-hidden transition-colors ${cardSurface} ${
                    isSelected ? 'ring-2 ring-sky-500/70' : ''
                  }`}
                >
                  {/* Summary Header */}
                  <div className="p-3 flex items-start gap-2.5">
                    {selectionMode && (
                      <button
                        type="button"
                        onClick={() => toggleSelect(evt.id)}
                        className="mt-0.5 text-sky-400 shrink-0"
                        aria-label="Select event"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 opacity-60" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpand(evt.id)}
                      className="flex-1 min-w-0 text-start space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
                        <span
                          className={`px-1.5 py-0.5 rounded-md border text-[10px] font-extrabold tracking-wide ${getSeverityStyles(
                            evt.severity,
                            isLightApp
                          )}`}
                        >
                          {evt.severity}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                            isLightApp
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-white/[0.06] text-zinc-300'
                          }`}
                        >
                          {evt.category}
                        </span>
                        {typeof evt.httpStatus === 'number' && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                              evt.httpStatus >= 400
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            HTTP {evt.httpStatus}
                          </span>
                        )}
                        {typeof evt.durationMs === 'number' && (
                          <span className={`text-[10px] font-mono ${mutedText}`}>
                            {evt.durationMs}ms
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-extrabold leading-snug break-words" dir="ltr">
                        {evt.title}
                      </div>

                      <div className={`text-[11px] leading-relaxed line-clamp-2 ${mutedText}`} dir="ltr">
                        {evt.description}
                      </div>

                      <div
                        className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] font-mono ${mutedText}`}
                        dir="ltr"
                      >
                        <span>{formatTimestampReadable(evt.timestamp)}</span>
                        <span>· {evt.component}</span>
                        <span>· {evt.status}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleExpand(evt.id)}
                      className={`p-1 rounded-lg shrink-0 ${mutedText}`}
                      aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Technical Details */}
                  {isExpanded && (
                    <div
                      className={`px-3 pb-3 pt-2.5 border-t space-y-2.5 text-[11px] ${
                        isLightApp
                          ? 'border-slate-200 bg-slate-50/70'
                          : 'border-white/[0.06] bg-black/25'
                      }`}
                      dir="ltr"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[10.5px]">
                        <div>
                          <span className={mutedText}>Event ID: </span>
                          <span className="break-all">{evt.id}</span>
                        </div>
                        <div>
                          <span className={mutedText}>Time (ISO): </span>
                          <span>{evt.timestamp}</span>
                        </div>
                        <div>
                          <span className={mutedText}>Component: </span>
                          <span>{evt.component}</span>
                        </div>
                        <div>
                          <span className={mutedText}>Operation: </span>
                          <span>{evt.operation}</span>
                        </div>
                        <div>
                          <span className={mutedText}>Status: </span>
                          <span>{evt.status}</span>
                        </div>
                        <div>
                          <span className={mutedText}>App Version: </span>
                          <span>{evt.appVersion}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className={mutedText}>Platform / OS: </span>
                          <span>
                            {evt.platform} — {evt.osVersion}
                          </span>
                        </div>
                        {evt.operationId && (
                          <div>
                            <span className={mutedText}>Operation ID: </span>
                            <span className="break-all">{evt.operationId}</span>
                          </div>
                        )}
                        {evt.relatedEventId && (
                          <div>
                            <span className={mutedText}>Related Event: </span>
                            <span className="break-all">{evt.relatedEventId}</span>
                          </div>
                        )}
                      </div>

                      {evt.errorMessage && (
                        <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-2.5 space-y-1">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
                            Error Message
                          </div>
                          <div className="font-mono text-[11px] text-rose-200 break-words">
                            {evt.errorMessage}
                          </div>
                        </div>
                      )}

                      {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                        <div
                          className={`rounded-xl border p-2.5 space-y-1 ${
                            isLightApp
                              ? 'bg-white border-slate-200'
                              : 'bg-[#10131A] border-white/[0.06]'
                          }`}
                        >
                          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${mutedText}`}>
                            Sanitized Metadata
                          </div>
                          <div className="space-y-0.5 font-mono text-[10.5px]">
                            {Object.entries(evt.metadata).map(([k, v]) => (
                              <div key={k} className="break-all">
                                <span className={mutedText}>{k}: </span>
                                <span>{v === null ? 'null' : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {evt.stackTrace && (
                        <div
                          className={`rounded-xl border p-2.5 space-y-1 ${
                            isLightApp
                              ? 'bg-slate-900 text-slate-100 border-slate-700'
                              : 'bg-black/60 text-zinc-200 border-white/10'
                          }`}
                        >
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                            Stack Trace
                          </div>
                          <pre className="font-mono text-[10px] leading-relaxed overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                            {evt.stackTrace}
                          </pre>
                        </div>
                      )}

                      {/* Per-Event Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1" dir={dir}>
                        <button
                          type="button"
                          onClick={() => handleCopySingle(evt)}
                          className="h-8 px-3 rounded-xl bg-[#0B5FA8] hover:bg-[#0E70C4] text-white text-[11px] font-bold flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{isEnglish ? 'Copy Report' : 'کۆپیکردنی ڕاپۆرت'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingConfirm({
                              type: 'single',
                              id: evt.id,
                              title: evt.title,
                            })
                          }
                          className="h-8 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isEnglish ? 'Delete' : 'سڕینەوە'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredLogs.length > visibleLimit && (
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                className={`w-full h-10 rounded-2xl border text-xs font-bold transition-colors ${subtleSurface}`}
              >
                {isEnglish
                  ? `Load More (${filteredLogs.length - visibleLimit} remaining)`
                  : `پیشاندانی زیاتر (${filteredLogs.length - visibleLimit} ماوە)`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
