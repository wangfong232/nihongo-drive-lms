"use client";

import React, { useState } from "react";
import { DriveNode, Course, AutoSuggestResult, SuggestedLesson, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cleanLessonTitle } from "@/lib/utils";
import { Wand2, X, Check, Loader2, Video, FileAudio, FileText, CheckSquare, Square } from "lucide-react";

interface AutoSuggestModalProps {
  folderNode: DriveNode;
  courses: Course[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AutoSuggestModal: React.FC<AutoSuggestModalProps> = ({ folderNode, courses, onClose, onSuccess }) => {
  const { t } = useI18n();

  const [patternPreset, setPatternPreset] = useState<string>("bai");
  const [customRegex, setCustomRegex] = useState<string>("Bài\\s*(\\d+)");
  const [targetSectionId, setTargetSectionId] = useState<string>(
    courses[0]?.sections[0]?.id || ""
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<AutoSuggestResult | null>(null);
  const [selectedLessons, setSelectedLessons] = useState<Record<number, boolean>>({});

  // All sections list from courses
  const allSections = courses.flatMap((c) =>
    c.sections.map((s) => ({
      id: s.id,
      name: `${c.jlptLevel} — ${c.title} -> ${s.title}`,
    }))
  );

  const handlePresetChange = (preset: string) => {
    setPatternPreset(preset);
    if (preset === "bai") setCustomRegex("Bài\\s*(\\d+)");
    else if (preset === "lesson") setCustomRegex("Lesson\\s*(\\d+)");
    else if (preset === "number") setCustomRegex("^(\\d+)");
    else if (preset === "all") setCustomRegex(".*");
    else setCustomRegex("");
  };

  const handleAnalyze = async () => {
    if (!targetSectionId) {
      alert("Please select a target Section first.");
      return;
    }

    try {
      setAnalyzing(true);
      const res = await api.analyzeAutoSuggest({
        parentFolderDriveNodeId: folderNode.id,
        patternRegex: customRegex,
        targetSectionId,
      });

      // Clean lesson titles
      res.suggestedLessons.forEach((l) => {
        l.lessonTitle = cleanLessonTitle(l.lessonTitle);
      });

      setResult(res);

      // Default select all matched lessons
      const initialSelection: Record<number, boolean> = {};
      res.suggestedLessons.forEach((l, idx) => {
        initialSelection[idx] = true;
      });
      setSelectedLessons(initialSelection);
    } catch (err: any) {
      alert(`Error analyzing folder pattern: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSelectAll = () => {
    if (!result) return;
    const allSelected = result.suggestedLessons.every((_, idx) => selectedLessons[idx]);
    const next: Record<number, boolean> = {};
    result.suggestedLessons.forEach((_, idx) => {
      next[idx] = !allSelected;
    });
    setSelectedLessons(next);
  };

  const handleApply = async () => {
    if (!result) return;
    const approvedLessons = result.suggestedLessons.filter((_, idx) => selectedLessons[idx]);
    if (approvedLessons.length === 0) {
      alert("Please select at least one suggested lesson to apply.");
      return;
    }

    try {
      setApplying(true);
      await api.applyAutoSuggest(targetSectionId, approvedLessons);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Failed to apply auto-suggested lessons: ${err.message}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#f8f9ff] dark:bg-[#0b1c30] border-2 border-[#d3e4fe] dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b-2 border-[#d3e4fe] dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#090d16]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 shadow-inner">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-[#0b1c30] dark:text-white">{t("autoSuggestHelper")}</h3>
              <p className="text-xs text-[#3c4a42] dark:text-slate-400">
                Đang quét thư mục: <span className="font-black text-[#006c49] dark:text-emerald-400">{folderNode.name}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-500 border border-[#d3e4fe] dark:border-slate-700 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 custom-scrollbar">
          {/* Section 1: Form Config */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-slate-900 border-2 border-[#d3e4fe] dark:border-slate-800 p-5 rounded-2xl shadow-xs">
            {/* Target Section */}
            <div>
              <label className="block text-xs font-black text-[#0b1c30] dark:text-slate-300 mb-1.5">{t("selectSection")}</label>
              <select
                value={targetSectionId}
                onChange={(e) => setTargetSectionId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-bold text-[#0b1c30] dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">-- Choose Section --</option>
                {allSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Pattern Presets */}
            <div>
              <label className="block text-xs font-black text-[#0b1c30] dark:text-slate-300 mb-1.5">{t("patternPreset")}</label>
              <select
                value={patternPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs text-[#0b1c30] dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-bold"
              >
                <option value="bai">Bài NN (e.g. Bài 01, Bài 02, Bài 1)</option>
                <option value="lesson">Lesson NN (e.g. Lesson 01, Lesson 1)</option>
                <option value="number">Số thứ tự đầu file/folder (01, 02, 1...)</option>
                <option value="all">Tất cả thư mục / tệp con trong folder này</option>
                <option value="custom">Regex tùy chỉnh</option>
              </select>
            </div>

            {/* Custom Regex Input */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-[#0b1c30] dark:text-slate-300 mb-1.5">{t("customRegex")}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customRegex}
                  onChange={(e) => setCustomRegex(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 font-mono text-xs text-[#0b1c30] dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-bold"
                  placeholder="e.g. (?i)Bài\s*(\d+)"
                />

                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-[0_4px_0_#581c87] hover:shadow-[0_2px_0_#581c87] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50"
                >
                  {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  {t("applyPattern")}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Results Preview */}
          {result && (
            <div className="flex flex-col gap-3 pt-4 border-t-2 border-[#d3e4fe] dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs text-[#0b1c30] dark:text-white">{t("suggestedMatches")}:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-black text-xs border border-emerald-500/20">
                    {result.matchesFound} lessons found
                  </span>
                </div>

                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1 text-xs font-black text-purple-600 dark:text-purple-400 hover:underline"
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Toggle All
                </button>
              </div>

              {/* Lessons Preview List */}
              <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {result.suggestedLessons.map((lesson, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border-2 transition-all ${
                      selectedLessons[idx]
                        ? "border-purple-500/50 bg-purple-50/30 dark:bg-purple-950/20"
                        : "border-[#d3e4fe] dark:border-slate-800 bg-white dark:bg-slate-900 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="cursor-pointer shrink-0"
                        onClick={() => setSelectedLessons((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      >
                        {selectedLessons[idx] ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <input
                        type="text"
                        value={lesson.lessonTitle}
                        onChange={(e) => {
                          const updated = [...result.suggestedLessons];
                          updated[idx].lessonTitle = e.target.value;
                          setResult({ ...result, suggestedLessons: updated });
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-black text-[#0b1c30] dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">({lesson.resources.length} tài nguyên)</span>
                    </div>

                    {/* Resources */}
                    <div className="flex flex-wrap gap-1.5 pl-6 mt-2">
                      {lesson.resources.map((res, rIdx) => (
                        <span key={rIdx} className="px-2 py-0.5 rounded-lg bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-[10px] font-bold text-[#0b1c30] dark:text-slate-300">
                          {res.fileName}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-[#d3e4fe] dark:border-slate-800 flex items-center justify-end gap-3 bg-white dark:bg-[#090d16]/80">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-xs font-black text-[#0b1c30] dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
          >
            {t("cancel")}
          </button>

          {result && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-[#006c49] hover:bg-[#005237] text-white text-xs font-black shadow-[0_4px_0_#00422b] hover:shadow-[0_2px_0_#00422b] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50"
            >
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {t("applySelected")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
