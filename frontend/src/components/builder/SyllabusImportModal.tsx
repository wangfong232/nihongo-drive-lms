'use client';

import React, { useState, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────

interface SuggestedDriveFile {
  driveNodeId: string;
  fileName: string;
  rawPath?: string;
  webViewLink?: string;
  matchScore: number;
  matchedKeyword: string;
  resourceType: number;
}

interface ParsedLesson {
  displayOrder: number;
  dayNumber: number;
  title: string;
  description: string;
  estimatedDurationMinutes: number;
  skills: string[];
  searchKeywords: string[];
  suggestedDriveFiles: SuggestedDriveFile[];
  // Confirmed state (mutated by curator)
  _confirmedFileIds: string[];
  _isEditing: boolean;
}

interface ParsedSection {
  displayOrder: number;
  title: string;
  lessons: ParsedLesson[];
}

interface ParsedSyllabus {
  courseTitle: string;
  jlptLevel: string;
  description: string;
  sections: ParsedSection[];
}

interface SyllabusImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateCreated?: (templateId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────

const SKILL_COLORS: Record<string, string> = {
  Grammar:    'bg-green-100 text-green-800',
  Kanji:      'bg-blue-100 text-blue-800',
  Vocabulary: 'bg-yellow-100 text-yellow-800',
  Choukai:    'bg-purple-100 text-purple-800',
  Quiz:       'bg-red-100 text-red-800',
  Kaiwa:      'bg-orange-100 text-orange-800',
  Dokkai:     'bg-pink-100 text-pink-800',
};

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const PACE_OPTIONS = [
  { value: 0, label: 'Bình thường (1 ngày/bài)', desc: '~150 ngày cho N5' },
  { value: 1, label: 'Cấp tốc (2 bài/ngày)',     desc: '~75 ngày cho N5' },
  { value: 2, label: 'Giãn nhịp (1 bài/2 ngày)', desc: '~300 ngày cho N5' },
];

function SkillBadge({ skill }: { skill: string }) {
  const color = SKILL_COLORS[skill] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {skill}
    </span>
  );
}

function MatchScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-gray-400';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs text-white font-bold ${color}`}>
      {score}%
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function SyllabusImportModal({
  isOpen, onClose, onTemplateCreated
}: SyllabusImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [jlptLevel, setJlptLevel] = useState('N4');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syllabus, setSyllabus] = useState<ParsedSyllabus | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [savedStats, setSavedStats] = useState({ totalDays: 0, totalMinutes: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_BASE = 'http://localhost:5222/api/roadmap';

  // ─── Step 1 handlers ───

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') setPdfFile(file);
    else setError('Chỉ chấp nhận file PDF.');
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPdfFile(file);
  };

  const handleParsePdf = async () => {
    if (!pdfFile) { setError('Vui lòng chọn file PDF.'); return; }
    setIsLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', pdfFile);
      const res = await fetch(`${API_BASE}/parse-syllabus`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Lỗi ${res.status}`);
      }
      const data: ParsedSyllabus = await res.json();
      // Inject mutation state vào từng lesson
      data.sections.forEach(s => s.lessons.forEach(l => {
        (l as any)._confirmedFileIds = l.suggestedDriveFiles.slice(0, 3).map(f => f.driveNodeId);
        (l as any)._isEditing = false;
      }));
      setSyllabus(data);
      setTemplateTitle(prev => prev || data.courseTitle);
      setJlptLevel(data.jlptLevel || 'N4');
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 2 handlers ───

  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const updateLessonTitle = (sIdx: number, lIdx: number, title: string) => {
    if (!syllabus) return;
    const updated = { ...syllabus };
    updated.sections[sIdx].lessons[lIdx].title = title;
    setSyllabus(updated);
  };

  const toggleConfirmedFile = (sIdx: number, lIdx: number, fileId: string) => {
    if (!syllabus) return;
    const updated = { ...syllabus };
    const lesson = updated.sections[sIdx].lessons[lIdx] as any;
    const confirmed: string[] = lesson._confirmedFileIds;
    const idx = confirmed.indexOf(fileId);
    if (idx > -1) confirmed.splice(idx, 1);
    else if (confirmed.length < 3) confirmed.push(fileId);
    setSyllabus({ ...updated });
  };

  const handleSaveTemplate = async () => {
    if (!syllabus) return;
    setIsSaving(true);
    setError(null);
    try {
      // Build payload từ syllabus đã edit
      let dayCounter = 0;
      const sections = syllabus.sections.map((sec, sIdx) => ({
        displayOrder: sec.displayOrder,
        title: sec.title,
        lessons: sec.lessons.map((lesson: any, lIdx: number) => {
          dayCounter++;
          return {
            dayNumber: lesson.dayNumber || dayCounter,
            title: lesson.title,
            description: lesson.description,
            estimatedDurationMinutes: lesson.estimatedDurationMinutes,
            skills: lesson.skills,
            searchKeywords: lesson.searchKeywords,
            linkedLessonId: null,
            confirmedDriveFiles: lesson.suggestedDriveFiles
              .filter((f: SuggestedDriveFile) => lesson._confirmedFileIds.includes(f.driveNodeId))
              .map((f: SuggestedDriveFile, i: number) => ({
                driveNodeId: f.driveNodeId,
                matchScore: f.matchScore,
                resourceType: f.resourceType,
                displayOrder: i + 1,
              }))
          };
        })
      }));

      const payload = {
        title: templateTitle || syllabus.courseTitle,
        jlptLevel,
        description: syllabus.description,
        sourcePdfName: pdfFile?.name,
        sections,
      };

      const res = await fetch(`${API_BASE}/save-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Lỗi ${res.status}`);
      }

      const saved = await res.json();
      setSavedTemplateId(saved.id);
      setSavedStats({
        totalDays: saved.totalDays,
        totalMinutes: saved.totalEstimatedMinutes ?? 0,
      });
      onTemplateCreated?.(saved.id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('roadmap-template-created', { detail: { id: saved.id } }));
      }
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setPdfFile(null);
    setSyllabus(null);
    setError(null);
    setTemplateTitle('');
    setSavedTemplateId(null);
    onClose();
  };

  if (!isOpen) return null;

  // ─── Render ───

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <h2 className="text-white font-bold text-lg">Smart Syllabus Extractor</h2>
              <p className="text-indigo-200 text-xs">Import lộ trình học từ PDF → AI phân tích → Lưu Template</p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${step === s ? 'bg-white text-indigo-600' : step > s ? 'bg-indigo-400 text-white' : 'bg-indigo-800 text-indigo-300'}`}>
                  {step > s ? '✓' : s}
                </div>
                {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-indigo-400' : 'bg-indigo-800'}`} />}
              </React.Fragment>
            ))}
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white text-2xl leading-none ml-4">×</button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center gap-2 text-red-700 text-sm">
            <span>⚠️</span> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP 1: Upload ── */}
          {step === 1 && (
            <div className="p-8 max-w-xl mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Template (tuỳ chỉnh)</label>
                <input
                  type="text"
                  value={templateTitle}
                  onChange={e => setTemplateTitle(e.target.value)}
                  placeholder="VD: Lộ trình N4 180 ngày (Minna no Nihongo)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cấp độ JLPT</label>
                <select
                  value={jlptLevel}
                  onChange={e => setJlptLevel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {JLPT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                  ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'}`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />
                <div className="text-5xl mb-3">{pdfFile ? '✅' : '📄'}</div>
                {pdfFile ? (
                  <div>
                    <p className="font-medium text-gray-800">{pdfFile.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{(pdfFile.size / 1024).toFixed(0)} KB • Nhấn để đổi file</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-700">Kéo thả file PDF vào đây</p>
                    <p className="text-sm text-gray-400 mt-1">hoặc nhấp để duyệt file • Tối đa 50 MB</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleParsePdf}
                disabled={!pdfFile || isLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    AI đang phân tích PDF...
                  </>
                ) : (
                  <>🤖 Phân tích AI</>
                )}
              </button>
            </div>
          )}

          {/* ── STEP 2: Preview & Edit ── */}
          {step === 2 && syllabus && (
            <div className="p-6 space-y-4">
              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{templateTitle || syllabus.courseTitle}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{syllabus.description}</p>
                </div>
                <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full">{jlptLevel}</span>
                <span className="text-sm text-gray-600">
                  {syllabus.sections.length} tuần •{' '}
                  {syllabus.sections.reduce((a, s) => a + s.lessons.length, 0)} ngày
                </span>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="font-medium">Kỹ năng:</span>
                {Object.entries(SKILL_COLORS).map(([s, c]) => (
                  <span key={s} className={`px-2 py-0.5 rounded-full text-xs font-medium ${c}`}>{s}</span>
                ))}
              </div>

              {/* Sections accordion */}
              {syllabus.sections.map((section, sIdx) => (
                <div key={sIdx} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection(sIdx)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                        {sIdx + 1}
                      </span>
                      <span className="font-medium text-gray-800">{section.title}</span>
                      <span className="text-xs text-gray-400">{section.lessons.length} ngày</span>
                    </div>
                    <span className="text-gray-400">{expandedSections.has(sIdx) ? '▲' : '▼'}</span>
                  </button>

                  {expandedSections.has(sIdx) && (
                    <div className="divide-y divide-gray-100">
                      {section.lessons.map((lesson: any, lIdx: number) => (
                        <div key={lIdx} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start gap-3">
                            {/* Day badge */}
                            <span className="w-10 h-10 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              N{lesson.dayNumber}
                            </span>

                            <div className="flex-1 min-w-0">
                              {/* Lesson title — inline editable */}
                              <input
                                type="text"
                                value={lesson.title}
                                onChange={e => updateLessonTitle(sIdx, lIdx, e.target.value)}
                                className="w-full text-sm font-medium text-gray-800 bg-transparent border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 focus:outline-none py-0.5 transition-colors"
                              />

                              {/* Skills + Duration */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {lesson.skills.map((skill: string) => (
                                  <SkillBadge key={skill} skill={skill} />
                                ))}
                                <span className="text-xs text-gray-400 ml-auto">⏱ {lesson.estimatedDurationMinutes} phút</span>
                              </div>

                              {/* Drive file suggestions */}
                              {lesson.suggestedDriveFiles.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {lesson.suggestedDriveFiles.map((file: SuggestedDriveFile) => {
                                    const isConfirmed = lesson._confirmedFileIds.includes(file.driveNodeId);
                                    const typeIcon = file.resourceType === 0 ? '🎬' : file.resourceType === 1 ? '🎧' : file.resourceType === 2 ? '📝' : '📄';
                                    return (
                                      <div
                                        key={file.driveNodeId}
                                        className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer
                                          ${isConfirmed
                                            ? 'border-emerald-300 bg-emerald-50/80 shadow-xs'
                                            : 'border-gray-200 bg-gray-50 opacity-60'}`}
                                        onClick={() => toggleConfirmedFile(sIdx, lIdx, file.driveNodeId)}
                                      >
                                        <span className="text-sm">{isConfirmed ? '✅' : '⬜'}</span>
                                        <span className="text-sm">{typeIcon}</span>
                                        <MatchScoreBadge score={file.matchScore} />
                                        <div className="flex-1 min-w-0 flex flex-col">
                                          <span className="truncate text-gray-800 font-semibold">{file.fileName}</span>
                                          {file.rawPath && (
                                            <span className="truncate text-[10px] text-gray-400 font-mono">📂 {file.rawPath}</span>
                                          )}
                                        </div>
                                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-medium border border-indigo-100 flex-shrink-0">
                                          {file.matchedKeyword}
                                        </span>
                                        {file.webViewLink && (
                                          <a
                                            href={file.webViewLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="text-indigo-500 hover:text-indigo-700 p-0.5 ml-1"
                                            title="Xem trên Drive"
                                          >🔗</a>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 3: Success ── */}
          {step === 3 && (
            <div className="p-12 text-center space-y-6">
              <div className="text-7xl">🎉</div>
              <h3 className="text-2xl font-bold text-gray-800">Template đã được lưu thành công!</h3>
              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                <div className="bg-indigo-50 rounded-xl p-4">
                  <p className="text-3xl font-bold text-indigo-600">{savedStats.totalDays}</p>
                  <p className="text-xs text-gray-500 mt-1">Ngày học</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-3xl font-bold text-purple-600">
                    {Math.round(savedStats.totalMinutes / 60)}h
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Tổng thời lượng</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Xuất bản template để học viên có thể đăng ký lộ trình này.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={step === 1 ? handleClose : () => setStep(s => (s - 1) as any)}
            disabled={isLoading || isSaving}
            className="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-white transition-colors"
          >
            {step === 1 ? 'Hủy' : '← Quay lại'}
          </button>

          {step === 2 && (
            <button
              onClick={handleSaveTemplate}
              disabled={isSaving}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Đang lưu...
                </>
              ) : <>💾 Lưu Template</>}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all"
            >
              Đóng ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
