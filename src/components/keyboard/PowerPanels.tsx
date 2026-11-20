import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Calculator,
  CalendarClock,
  Check,
  Copy,
  Delete,
  MessageSquareText,
  Plus,
  Scissors,
  Trash2,
  X,
} from 'lucide-react';
import { KeyboardSettings, KeyboardTheme, QuickSnippet } from '../../types/keyboard';
import {
  evaluateSafeMath,
  formatMathResult,
  getQuickDateTimeChips,
} from '../../utils/mathAndTime';
import { KurdiIcon } from '../icons/KurdiIcons';

interface CursorControlPanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  onMoveCursorEx: (dx: number, dy: number, select: boolean) => void;
  onMoveLineEdge: (toEnd: boolean, select: boolean) => void;
  onSelectAll: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onBackspace: () => void;
  onDeleteWord: () => void;
  onClose: () => void;
}

export const CursorControlPanel: React.FC<CursorControlPanelProps> = ({
  theme,
  settings,
  onMoveCursorEx,
  onMoveLineEdge,
  onSelectAll,
  onCopy,
  onCut,
  onPaste,
  onBackspace,
  onDeleteWord,
  onClose,
}) => {
  const isLight = Boolean(theme.isLight);
  const [selectMode, setSelectMode] = useState(false);
  const repeatTimerRef = useRef<number | null>(null);
  const repeatStartRef = useRef<number | null>(null);

  const stopRepeat = () => {
    if (repeatStartRef.current) {
      window.clearTimeout(repeatStartRef.current);
      repeatStartRef.current = null;
    }
    if (repeatTimerRef.current) {
      window.clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  };

  useEffect(() => stopRepeat, []);

  const startHoldAction = (fn: () => void) => {
    stopRepeat();
    fn();
    repeatStartRef.current = window.setTimeout(() => {
      repeatTimerRef.current = window.setInterval(fn, 70);
    }, 320);
  };

  const surfaceBtn = isLight
    ? 'bg-white border-slate-200 text-slate-900 hover:bg-slate-100 active:scale-95'
    : 'bg-[#181A20] border-white/10 text-white hover:bg-[#22252E] active:scale-95';

  const padBtn = isLight
    ? 'bg-white border-slate-200 text-slate-900 hover:bg-sky-50 active:scale-95'
    : 'bg-[#1D2028] border-white/10 text-white hover:bg-sky-500/20 active:scale-95';

  return (
    <div
      className="flex flex-col w-full px-3 py-2.5 gap-2.5 kb-noselect"
      style={{
        backgroundColor: theme.bg,
        height: `${Math.max(settings.keyboardHeightPx + 36, 315)}px`,
      }}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            کۆنترۆڵی دەق و کێرسەر
          </span>
          {selectMode && (
            <span className="text-[11px] font-bold text-sky-400">· دۆخی دیاریکردن چالاکە</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`w-9 h-9 rounded-full flex items-center justify-center ${
            isLight ? 'bg-slate-200 text-slate-900' : 'bg-zinc-800 text-white'
          }`}
          title="گەڕانەوە بۆ تەختەکلیل"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main 2-Zone Ergonomic Touch Grid */}
      <div className="flex-1 grid grid-cols-12 gap-2.5 min-h-0" dir="ltr">
        {/* Left/Center 7 Cols: Precision D-Pad + Select Toggle + Line Start/End */}
        <div className="col-span-7 flex flex-col justify-between gap-2">
          <div className="grid grid-cols-3 gap-2 flex-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onMoveLineEdge(false, selectMode)}
              className={`min-h-[44px] rounded-2xl border text-[11px] font-bold flex items-center justify-center transition-all ${surfaceBtn}`}
              title="سەرەتای دێڕ"
            >
              سەرەتا
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={() => startHoldAction(() => onMoveCursorEx(0, -1, selectMode))}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
              className={`min-h-[44px] rounded-2xl border flex items-center justify-center transition-all ${padBtn}`}
              title="سەرەوە"
            >
              <ArrowUp className="w-5 h-5" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onMoveLineEdge(true, selectMode)}
              className={`min-h-[44px] rounded-2xl border text-[11px] font-bold flex items-center justify-center transition-all ${surfaceBtn}`}
              title="کۆتایی دێڕ"
            >
              کۆتایی
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={() => startHoldAction(() => onMoveCursorEx(-1, 0, selectMode))}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
              className={`min-h-[44px] rounded-2xl border flex items-center justify-center transition-all ${padBtn}`}
              title="چەپ"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSelectMode((v) => !v)}
              className={`min-h-[44px] rounded-2xl border text-xs font-extrabold flex flex-col items-center justify-center transition-all active:scale-95 ${
                selectMode
                  ? 'bg-[#0B5FA8] border-sky-400 text-white shadow-lg shadow-sky-600/25'
                  : surfaceBtn
              }`}
              title="چالاککردنی دیاریکردن لەگەڵ جووڵە"
            >
              <span>دیاریکردن</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={() => startHoldAction(() => onMoveCursorEx(1, 0, selectMode))}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
              className={`min-h-[44px] rounded-2xl border flex items-center justify-center transition-all ${padBtn}`}
              title="ڕاست"
            >
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onSelectAll}
              className={`min-h-[44px] rounded-2xl border text-[11px] font-bold flex items-center justify-center transition-all ${surfaceBtn}`}
            >
              هەمووی
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={() => startHoldAction(() => onMoveCursorEx(0, 1, selectMode))}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
              className={`min-h-[44px] rounded-2xl border flex items-center justify-center transition-all ${padBtn}`}
              title="خوارەوە"
            >
              <ArrowDown className="w-5 h-5" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={() => startHoldAction(onBackspace)}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
              className={`min-h-[44px] rounded-2xl border flex items-center justify-center transition-all ${surfaceBtn}`}
              title="سڕینەوە"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right 5 Cols: Quick Text Clipboard & Word Actions */}
        <div className="col-span-5 grid grid-cols-1 gap-2" dir="rtl">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCopy}
            className={`min-h-[44px] px-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${surfaceBtn}`}
          >
            <span>کۆپیکردن</span>
            <Copy className="w-4 h-4 text-sky-400" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCut}
            className={`min-h-[44px] px-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${surfaceBtn}`}
          >
            <span>بڕین</span>
            <Scissors className="w-4 h-4 text-sky-400" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPaste}
            className={`min-h-[44px] px-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${surfaceBtn}`}
          >
            <span>لکاندن (پەیست)</span>
            <KurdiIcon name="ic_pastes" className="w-4 h-4 text-sky-400" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onDeleteWord}
            className={`min-h-[44px] px-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${surfaceBtn}`}
          >
            <span>سڕینەوەی وشە</span>
            <Trash2 className="w-4 h-4 text-rose-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface SnippetsCalcPanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  initialTab?: 'snippets' | 'calc';
  onInsertText: (text: string) => void;
  onUpdateSnippets: (snippets: QuickSnippet[]) => void;
  onClose: () => void;
}

const CALC_KEYS = [
  ['C', '(', ')', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '%', '⌫'],
];

export const SnippetsCalcPanel: React.FC<SnippetsCalcPanelProps> = ({
  theme,
  settings,
  initialTab = 'snippets',
  onInsertText,
  onUpdateSnippets,
  onClose,
}) => {
  const isLight = Boolean(theme.isLight);
  const [tab, setTab] = useState<'snippets' | 'calc'>(initialTab);
  const [calcExpr, setCalcExpr] = useState('');
  const [addingSnippet, setAddingSnippet] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newText, setNewText] = useState('');

  const dateTimeChips = useMemo(() => getQuickDateTimeChips(), []);

  const calcPreview = useMemo(() => {
    if (!calcExpr.trim()) return null;
    const val = evaluateSafeMath(calcExpr);
    return val === null ? null : formatMathResult(val);
  }, [calcExpr]);

  const handleCalcKey = (key: string) => {
    if (key === 'C') {
      setCalcExpr('');
      return;
    }
    if (key === '⌫') {
      setCalcExpr((prev) => prev.slice(0, -1));
      return;
    }
    setCalcExpr((prev) => prev + key);
  };

  const handleSaveSnippet = () => {
    const cleanText = newText.trim();
    const cleanLabel = newLabel.trim() || cleanText.slice(0, 18);
    if (!cleanText) return;
    const next: QuickSnippet[] = [
      { id: `snp_${Date.now()}`, label: cleanLabel, text: cleanText },
      ...(settings.quickSnippets || []),
    ];
    onUpdateSnippets(next);
    setNewLabel('');
    setNewText('');
    setAddingSnippet(false);
  };

  const handleDeleteSnippet = (id: string) => {
    onUpdateSnippets((settings.quickSnippets || []).filter((s) => s.id !== id));
  };

  return (
    <div
      className="flex flex-col w-full px-3 py-2.5 gap-2 kb-noselect"
      style={{
        backgroundColor: theme.bg,
        height: `${Math.max(settings.keyboardHeightPx + 44, 325)}px`,
      }}
      dir="rtl"
    >
      {/* Header with Segmented Switch */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div
          className={`flex items-center p-1 rounded-xl gap-1 ${
            isLight ? 'bg-slate-200/80' : 'bg-[#171920]'
          }`}
        >
          <button
            type="button"
            onClick={() => setTab('snippets')}
            className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              tab === 'snippets'
                ? 'bg-[#0B5FA8] text-white'
                : isLight
                ? 'text-slate-700 hover:text-slate-950'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>کلێشەکان</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('calc')}
            className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              tab === 'calc'
                ? 'bg-[#0B5FA8] text-white'
                : isLight
                ? 'text-slate-700 hover:text-slate-950'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>بژمێری خێرا</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {tab === 'snippets' && (
            <button
              type="button"
              onClick={() => setAddingSnippet((v) => !v)}
              className={`h-8 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${
                addingSnippet
                  ? 'bg-emerald-600 text-white'
                  : isLight
                  ? 'bg-sky-100 text-sky-800 hover:bg-sky-200'
                  : 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>نوێ</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isLight ? 'bg-slate-200 text-slate-900' : 'bg-zinc-800 text-white'
            }`}
            title="گەڕانەوە"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {tab === 'snippets' ? (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Quick Date & Time Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll shrink-0 pb-0.5">
            <CalendarClock className="w-4 h-4 text-sky-400 shrink-0" />
            {dateTimeChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => onInsertText(`${chip.value} `)}
                className={`h-8 px-2.5 rounded-xl text-[11px] font-semibold whitespace-nowrap shrink-0 border transition-all active:scale-95 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 hover:bg-sky-50'
                    : 'bg-[#171920] border-white/10 text-zinc-200 hover:bg-white/10'
                }`}
                title={chip.value}
              >
                <span className="text-sky-400 ml-1">{chip.label}:</span>
                <span className="tabular-nums">{chip.value}</span>
              </button>
            ))}
          </div>

          {addingSnippet && (
            <div
              className={`rounded-2xl p-2.5 border space-y-2 shrink-0 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#16181F] border-white/10'
              }`}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="ناونیشانی کورت (وەک: ناونیشانم)"
                  className={`flex-1 h-9 px-2.5 rounded-xl text-xs border outline-none ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-black/40 border-white/10 text-white placeholder:text-zinc-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleSaveSnippet}
                  className="h-9 px-3 rounded-xl bg-sky-600 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>پاشەکەوت</span>
                </button>
              </div>
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSnippet();
                }}
                placeholder="دەقی تەواوی کلێشەکە لێرە بنووسە..."
                className={`w-full h-9 px-2.5 rounded-xl text-xs border outline-none ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-black/40 border-white/10 text-white placeholder:text-zinc-500'
                }`}
              />
            </div>
          )}

          {/* Snippets Grid */}
          <div className="flex-1 overflow-y-auto custom-scroll grid grid-cols-2 gap-2 content-start pb-1">
            {(settings.quickSnippets || []).map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-2.5 flex flex-col justify-between gap-1.5 transition-all ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-[#16181E] border-white/[0.08] text-white'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onInsertText(`${item.text} `);
                      onClose();
                    }}
                    className="flex-1 text-right active:scale-[0.98] transition-transform"
                  >
                    <div className="text-[11px] font-extrabold text-sky-400 truncate">
                      {item.label}
                    </div>
                    <div
                      className={`text-xs mt-0.5 line-clamp-2 leading-snug ${
                        isLight ? 'text-slate-700' : 'text-zinc-200'
                      }`}
                    >
                      {item.text}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSnippet(item.id)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 hover:text-rose-400 shrink-0"
                    title="سڕینەوە"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Mini Calculator Tab */
        <div className="flex-1 flex flex-col gap-2 min-h-0" dir="ltr">
          <div
            className={`rounded-2xl px-3 py-2 border flex items-center justify-between gap-2 shrink-0 ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#12141A] border-white/10'
            }`}
          >
            <div className="min-w-0 flex-1 text-left">
              <div
                className={`text-sm font-mono tabular-nums truncate ${
                  isLight ? 'text-slate-700' : 'text-zinc-300'
                }`}
              >
                {calcExpr || '0'}
              </div>
              <div className="text-lg font-extrabold font-mono tabular-nums text-sky-400 truncate">
                {calcPreview !== null ? `= ${calcPreview}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0" dir="rtl">
              <button
                type="button"
                disabled={!calcPreview}
                onClick={() => {
                  if (!calcPreview) return;
                  onInsertText(`${calcExpr} = ${calcPreview}`);
                  onClose();
                }}
                className={`h-9 px-2.5 rounded-xl text-[11px] font-bold disabled:opacity-40 transition-colors ${
                  isLight
                    ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                    : 'bg-white/10 text-zinc-200 hover:bg-white/15'
                }`}
                title="دانانی هاوکێشە و ئەنجام"
              >
                هاوکێشە
              </button>
              <button
                type="button"
                disabled={!calcPreview}
                onClick={() => {
                  if (!calcPreview) return;
                  onInsertText(calcPreview);
                  onClose();
                }}
                className="h-9 px-3.5 rounded-xl bg-[#0B5FA8] hover:bg-[#0D70C7] disabled:opacity-40 text-white text-xs font-extrabold transition-colors"
              >
                دانان
              </button>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-4 gap-1.5">
            {CALC_KEYS.flat().map((k) => {
              const isOp = ['÷', '×', '-', '+', '%', '(', ')'].includes(k);
              const isAction = k === 'C' || k === '⌫';
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleCalcKey(k)}
                  className={`rounded-xl text-base font-bold font-mono tabular-nums flex items-center justify-center transition-all active:scale-95 border ${
                    isAction
                      ? isLight
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : 'bg-rose-500/15 border-rose-500/25 text-rose-300'
                      : isOp
                      ? isLight
                        ? 'bg-sky-50 border-sky-200 text-sky-700'
                        : 'bg-sky-500/15 border-sky-400/25 text-sky-300'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
                      : 'bg-[#1A1C23] border-white/[0.07] text-white hover:bg-[#232630]'
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
