import React, { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import {
  filterTranslationLanguages,
  TRANSLATION_LANGUAGES,
} from '../../data/translationLanguages';

interface TranslationLanguagePickerProps {
  title: string;
  selectedCode: string;
  includeAuto?: boolean;
  isLight: boolean;
  bgColor: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export const TranslationLanguagePicker: React.FC<TranslationLanguagePickerProps> = ({
  title,
  selectedCode,
  includeAuto = false,
  isLight,
  bgColor,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const items = useMemo(
    () => filterTranslationLanguages(query, includeAuto),
    [query, includeAuto]
  );

  return (
    <div
      className="flex flex-col w-full h-full px-2.5 py-2 gap-2"
      style={{ backgroundColor: bgColor }}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {title}
          </span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
              isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-zinc-400'
            }`}
          >
            {TRANSLATION_LANGUAGES.length} زمان
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            isLight ? 'bg-slate-200 text-slate-900' : 'bg-zinc-800 text-white'
          }`}
          title="داخستن"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search bar */}
      <div
        className={`flex items-center gap-1.5 h-8 px-2.5 rounded-xl border shrink-0 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#16181D] border-white/10 text-white'
        }`}
      >
        <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="گەڕان بۆ زمان (کوردی، English، Türkçe...)"
          className="flex-1 bg-transparent text-[11.5px] outline-none placeholder:text-zinc-500 min-w-0"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-zinc-400 hover:text-white p-0.5 shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 2-column touch-friendly scrollable list */}
      <div className="flex-1 overflow-y-auto custom-scroll pr-0.5">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            هیچ زمانێک نەدۆزرایەوە
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 pb-1">
            {items.map((lang) => {
              const active = lang.code === selectedCode;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onSelect(lang.code);
                    onClose();
                  }}
                  className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl border text-right transition-colors active:scale-[0.98] ${
                    active
                      ? 'bg-[#0B5FA8]/20 border-sky-400/60 text-sky-400'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                      : 'bg-[#171920] border-white/5 text-white hover:bg-[#1E212B]'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11.5px] font-bold truncate leading-tight">
                      {lang.label}
                    </span>
                    {lang.native !== lang.label && (
                      <span
                        className={`text-[10px] truncate mt-0.5 ${
                          active
                            ? 'text-sky-300/80'
                            : isLight
                            ? 'text-slate-500'
                            : 'text-zinc-400'
                        }`}
                      >
                        {lang.native}
                      </span>
                    )}
                  </div>
                  {active && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
