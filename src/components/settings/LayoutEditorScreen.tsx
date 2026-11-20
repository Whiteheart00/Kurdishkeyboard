import React, { useMemo, useState } from 'react';
import {
  ArrowBigUp,
  Check,
  Delete,
  Play,
  RotateCcw,
  Save,
  Shapes,
  Wrench,
} from 'lucide-react';
import { KeyboardSettings, LanguageCode } from '../../types/keyboard';
import {
  EXTRA_EDITOR_KEYS,
  getCharacterLayoutLabel,
  getEditableAlphaRows,
} from '../../data/layouts';
import { SubPageHeader } from './SettingsUI';

interface LayoutEditorScreenProps {
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onBack: () => void;
  isLightApp: boolean;
}

export const LayoutEditorScreen: React.FC<LayoutEditorScreenProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
}) => {
  const initialLang = useMemo(() => {
    return (
      settings.enabledLanguages.find((l) => l.code === settings.activeLanguage) ||
      settings.enabledLanguages[0]
    );
  }, [settings.activeLanguage, settings.enabledLanguages]);

  const [editLangCode, setEditLangCode] = useState<LanguageCode>(
    initialLang?.code || 'ckb'
  );

  const activeEditLang = useMemo(
    () =>
      settings.enabledLanguages.find((l) => l.code === editLangCode) ||
      settings.enabledLanguages[0],
    [editLangCode, settings.enabledLanguages]
  );

  const activeLayoutId = activeEditLang?.characterLayoutId || 'kurdi_qvfgh';

  const [draftRows, setDraftRows] = useState<string[][]>(() =>
    getEditableAlphaRows(activeLayoutId, settings.customLayouts)
  );
  const [selectedSlot, setSelectedSlot] = useState<{ r: number; c: number } | null>(null);
  const [selectedExtra, setSelectedExtra] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const switchLang = (langCode: LanguageCode) => {
    const target = settings.enabledLanguages.find((l) => l.code === langCode);
    const targetLayoutId = target?.characterLayoutId || 'kurdi_qvfgh';
    setEditLangCode(langCode);
    setDraftRows(getEditableAlphaRows(targetLayoutId, settings.customLayouts));
    setSelectedSlot(null);
    setSelectedExtra(null);
  };

  const handleSlotClick = (r: number, c: number) => {
    if (selectedExtra) {
      const next = draftRows.map((row) => [...row]);
      next[r][c] = selectedExtra;
      setDraftRows(next);
      setSelectedExtra(null);
      return;
    }

    if (!selectedSlot) {
      setSelectedSlot({ r, c });
      return;
    }

    if (selectedSlot.r === r && selectedSlot.c === c) {
      setSelectedSlot(null);
      return;
    }

    const next = draftRows.map((row) => [...row]);
    const temp = next[selectedSlot.r][selectedSlot.c];
    next[selectedSlot.r][selectedSlot.c] = next[r][c];
    next[r][c] = temp;
    setDraftRows(next);
    setSelectedSlot(null);
  };

  const handleReset = () => {
    const nextCustom = { ...settings.customLayouts };
    delete nextCustom[activeLayoutId];
    onUpdate({ customLayouts: nextCustom });
    setDraftRows(getEditableAlphaRows(activeLayoutId));
    setSelectedSlot(null);
    setSelectedExtra(null);
  };

  const handleSave = () => {
    onUpdate({
      customLayouts: {
        ...settings.customLayouts,
        [activeLayoutId]: draftRows,
      },
      activeLanguage: activeEditLang?.code || settings.activeLanguage,
    });
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2200);
  };

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader
        title="دەستکاریکردنی ڕیزبەندی"
        onBack={onBack}
        isLightApp={isLightApp}
        leftAction={
          <button
            type="button"
            onClick={handleReset}
            className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"
            title="گەڕاندنەوە بۆ بنەڕەتی"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        }
      />

      <div className="px-4 pt-3 space-y-4">
        {/* Header Info Card matching Screenshot 1 */}
        <div
          className={`rounded-3xl p-4 border space-y-3 ${
            isLightApp
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#101318] border-white/[0.06] text-white'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-2xl bg-[#1D2838] text-[#9AC5FF] flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold flex items-center gap-2 flex-wrap">
                <span>ڕیزبەندی تایبەت</span>
                <span className="text-[11px] font-semibold text-[#9AC5FF] bg-[#1D2838] px-2 py-0.5 rounded-lg">
                  {getCharacterLayoutLabel(activeLayoutId)}
                </span>
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                پیتەکان ڕابکێشە یان دایانگرە بۆ گۆڕینی شوێنیان
              </div>
            </div>
          </div>

          {/* Enabled Languages Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-0.5">
            {settings.enabledLanguages.map((lang) => {
              const isSelected = lang.code === activeEditLang?.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => switchLang(lang.code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-colors ${
                    isSelected
                      ? 'bg-[#A4C9FF] text-[#051B3A] border-[#A4C9FF]'
                      : isLightApp
                      ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      : 'bg-black/40 text-zinc-300 border-white/10 hover:text-white'
                  }`}
                >
                  {lang.nativeName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Extra Keys Pool matching Screenshot 1 */}
        <div
          className={`rounded-3xl p-4 border space-y-3 ${
            isLightApp
              ? 'bg-white border-slate-200'
              : 'bg-[#101215] border-white/10'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[#9AC5FF]">
            <Shapes className="w-4 h-4" />
            <span>پیت و هێما زیادەکان</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scroll pb-1" dir="ltr">
            {EXTRA_EDITOR_KEYS.map((ch) => {
              const active = selectedExtra === ch;
              return (
                <button
                  key={ch}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', `extra:${ch}`)}
                  onClick={() => {
                    setSelectedExtra(active ? null : ch);
                    setSelectedSlot(null);
                  }}
                  className={`min-w-[44px] h-11 px-2.5 rounded-xl text-sm font-bold flex items-center justify-center shrink-0 border transition-all ${
                    active
                      ? 'bg-[#A4C9FF] text-[#051B3A] border-[#A4C9FF] scale-105'
                      : 'bg-[#191B20] text-white border-white/10 hover:border-sky-400/50'
                  }`}
                >
                  {ch}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dashed Interactive Keyboard Layout Editor matching Screenshot 1 */}
        <div
          className="rounded-3xl p-3 border-2 border-dashed border-white/15 bg-[#08090C] space-y-2"
          dir="ltr"
        >
          {draftRows.map((row, rIdx) => {
            const isBottomAlpha = rIdx === draftRows.length - 1;
            const isCompactMid = rIdx === 1 && row.length <= 9 && (draftRows[0]?.length ?? 10) >= 10;
            return (
              <div
                key={`edit_row_${rIdx}`}
                className={`flex items-center gap-1 ${isCompactMid ? 'px-3' : ''}`}
              >
                {isBottomAlpha && (
                  <span className="h-11 w-10 rounded-xl bg-[#14161A] border border-white/10 text-zinc-500 flex items-center justify-center shrink-0">
                    <ArrowBigUp className="w-4 h-4" />
                  </span>
                )}

                {row.map((ch, cIdx) => {
                  const isSelected = selectedSlot?.r === rIdx && selectedSlot?.c === cIdx;
                  return (
                    <button
                      key={`slot_${rIdx}_${cIdx}`}
                      type="button"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', `slot:${rIdx}:${cIdx}`)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const data = e.dataTransfer.getData('text/plain');
                        if (data.startsWith('extra:')) {
                          const extraChar = data.slice(6);
                          const next = draftRows.map((rw) => [...rw]);
                          next[rIdx][cIdx] = extraChar;
                          setDraftRows(next);
                        } else if (data.startsWith('slot:')) {
                          const [, sr, sc] = data.split(':').map(Number);
                          if (!Number.isNaN(sr) && !Number.isNaN(sc)) {
                            const next = draftRows.map((rw) => [...rw]);
                            const tmp = next[sr][sc];
                            next[sr][sc] = next[rIdx][cIdx];
                            next[rIdx][cIdx] = tmp;
                            setDraftRows(next);
                          }
                        }
                      }}
                      onClick={() => handleSlotClick(rIdx, cIdx)}
                      className={`flex-1 min-w-0 h-11 rounded-xl text-sm font-bold flex items-center justify-center border transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-[#A4C9FF] text-[#051B3A] border-[#A4C9FF] scale-105 shadow-lg'
                          : 'bg-[#191B20] text-white border-white/10 hover:border-sky-400/50'
                      }`}
                    >
                      <span className="truncate px-0.5">{ch}</span>
                    </button>
                  );
                })}

                {isBottomAlpha && (
                  <span className="h-11 w-10 rounded-xl bg-[#14161A] border border-white/10 text-zinc-500 flex items-center justify-center shrink-0">
                    <Delete className="w-4 h-4" />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Save Changes Sky-Blue CTA matching Screenshot 1 */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full h-13 rounded-2xl bg-[#A4C9FF] hover:bg-[#B8D5FF] text-[#051B3A] font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/15 active:scale-[0.98] transition-all"
        >
          {savedToast ? (
            <>
              <Check className="w-5 h-5" />
              <span>گۆڕانکارییەکان پاشەکەوت کران!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>پاشەکەوتکردنی گۆڕانکارییەکان</span>
            </>
          )}
        </button>

        {/* Tutorial Outlined Button matching Screenshot 1 */}
        <button
          type="button"
          onClick={() => setShowTutorial((v) => !v)}
          className="w-full h-12 rounded-2xl border border-sky-400/35 text-sm font-bold flex items-center justify-center gap-2 hover:bg-sky-500/10 transition-colors"
        >
          <span>فێرکاری و ڕێنمایی</span>
          <span className="w-6 h-6 rounded-full bg-[#A4C9FF] text-[#051B3A] flex items-center justify-center">
            <Play className="w-3 h-3 fill-current" />
          </span>
        </button>

        {showTutorial && (
          <div className="rounded-2xl bg-[#13161C] border border-white/10 p-4 text-xs text-zinc-300 space-y-2 leading-relaxed">
            <p>• بۆ گۆڕینی شوێنی دوو پیت: لەسەر پیتی یەکەم و پاشان پیتی دووەم دابگرە (یان ڕایبکێشە سەری).</p>
            <p>• بۆ دانانی پیتێکی زیادە: لە لیستی «پیت و هێما زیادەکان» پیتێک هەڵبژێرە و لەسەر هەر خانەیەکی تەختەکلیل دابگرە.</p>
            <p>• لە کۆتاییدا لەسەر «پاشەکەوتکردنی گۆڕانکارییەکان» دابگرە بۆ ئەوەی ڕاستەوخۆ لەسەر تەختەکلیل جێبەجێ ببێت.</p>
          </div>
        )}
      </div>
    </div>
  );
};
