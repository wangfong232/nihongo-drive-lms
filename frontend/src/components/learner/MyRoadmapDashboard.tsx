'use client';

import React, { useState, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────

interface RoadmapTemplate {
  id: string;
  title: string;
  jlptLevel: string;
  description?: string;
  totalDays: number;
  totalEstimatedMinutes?: number;
  isPublished: boolean;
}

interface Enrollment {
  id: string;
  roadmapTemplateId: string;
  templateTitle: string;
  startDate: string;
  paceMode: number;
  estimatedEndDate: string;
  isActive: boolean;
  completedDays: number;
  totalDays: number;
}

interface DriveFile {
  id: string;
  driveNodeId: string;
  fileName: string;
  webViewLink?: string;
  matchScore: number;
  resourceType: number;
}

interface ScheduleDay {
  date: string;
  dayNumber: number;
  title: string;
  description?: string;
  estimatedDurationMinutes: number;
  skills: string[];
  isCompleted: boolean;
  completedAtUtc?: string;
  linkedLessonId?: string;
  linkedLessonTitle?: string;
  driveFiles: DriveFile[];
  isToday: boolean;
  isOverdue: boolean;
}

// ─── Constants ───────────────────────────────────────────────

const SKILL_COLORS: Record<string, string> = {
  Grammar:    'bg-green-100 text-green-700 border-green-200',
  Kanji:      'bg-blue-100 text-blue-700 border-blue-200',
  Vocabulary: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Choukai:    'bg-purple-100 text-purple-700 border-purple-200',
  Quiz:       'bg-red-100 text-red-700 border-red-200',
  Kaiwa:      'bg-orange-100 text-orange-700 border-orange-200',
  Dokkai:     'bg-pink-100 text-pink-700 border-pink-200',
};

const PACE_LABELS: Record<number, { label: string; icon: string }> = {
  0: { label: 'Bình thường', icon: '🚶' },
  1: { label: 'Cấp tốc',    icon: '🏃' },
  2: { label: 'Giãn nhịp',  icon: '🧘' },
};

const JLPT_COLORS: Record<string, string> = {
  N5: 'bg-gray-100 text-gray-700',
  N4: 'bg-green-100 text-green-700',
  N3: 'bg-blue-100 text-blue-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

const API_BASE = 'http://localhost:5222/api/roadmap';

// ─── Sub-components ──────────────────────────────────────────

function SkillBadge({ skill }: { skill: string }) {
  const color = SKILL_COLORS[skill] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>{skill}</span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 w-10 text-right">{pct}%</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function MyRoadmapDashboard() {
  const [tab, setTab] = useState<'browse' | 'my'>('my');
  const [templates, setTemplates] = useState<RoadmapTemplate[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enroll dialog state
  const [enrollTarget, setEnrollTarget] = useState<RoadmapTemplate | null>(null);
  const [enrollStartDate, setEnrollStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [enrollPace, setEnrollPace] = useState(0);
  const [isEnrolling, setIsEnrolling] = useState(false);

  // ─── Effects ───

  useEffect(() => {
    loadTemplates();
    loadEnrollments();

    const handleCreated = () => {
      loadTemplates();
    };
    window.addEventListener('roadmap-template-created', handleCreated);
    return () => window.removeEventListener('roadmap-template-created', handleCreated);
  }, []);

  useEffect(() => {
    if (selectedEnrollment) loadSchedule(selectedEnrollment.id);
  }, [selectedEnrollment]);

  // ─── API calls ───

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/templates`);
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch { setError('Không tải được danh sách template.'); }
  };

  const loadEnrollments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/my-enrollments`);
      const data = await res.json();
      setEnrollments(data);
      if (data.length > 0 && !selectedEnrollment)
        setSelectedEnrollment(data[0]);
    } catch { setError('Không tải được lộ trình của bạn.'); }
    finally { setIsLoading(false); }
  };

  const loadSchedule = async (enrollmentId: string) => {
    setScheduleLoading(true);
    try {
      const res = await fetch(`${API_BASE}/my-schedule/${enrollmentId}`);
      const data = await res.json();
      setSchedule(data);
    } catch { setError('Không tải được lịch học.'); }
    finally { setScheduleLoading(false); }
  };

  const handleEnroll = async () => {
    if (!enrollTarget) return;
    setIsEnrolling(true);
    try {
      const res = await fetch(`${API_BASE}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmapTemplateId: enrollTarget.id,
          startDate: enrollStartDate,
          paceMode: enrollPace,
        }),
      });
      if (!res.ok) throw new Error('Đăng ký thất bại.');
      await loadEnrollments();
      setEnrollTarget(null);
      setTab('my');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  const toggleDayComplete = async (day: ScheduleDay) => {
    if (!selectedEnrollment) return;
    const newState = !day.isCompleted;
    // Optimistic update
    setSchedule(prev => prev.map(d =>
      d.dayNumber === day.dayNumber ? { ...d, isCompleted: newState } : d
    ));
    try {
      await fetch(
        `${API_BASE}/my-schedule/${selectedEnrollment.id}/day/${day.dayNumber}/complete?isCompleted=${newState}`,
        { method: 'POST' }
      );
      // Refresh enrollment stats
      await loadEnrollments();
    } catch {
      // Revert on error
      setSchedule(prev => prev.map(d =>
        d.dayNumber === day.dayNumber ? { ...d, isCompleted: !newState } : d
      ));
    }
  };

  // ─── Render helpers ───

  const todayIdx = schedule.findIndex(d => d.isToday);
  const completedCount = schedule.filter(d => d.isCompleted).length;
  const overdueCount = schedule.filter(d => d.isOverdue).length;

  // ─── Render ───

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">📅 Lộ trình học của tôi</h1>
          <p className="text-gray-500 text-sm mt-1">Kế hoạch học tập cá nhân hóa theo nhịp độ của bạn</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
            ⚠️ {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400">×</button>
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1 mb-6 bg-gray-200 p-1 rounded-xl w-fit">
          {[
            { key: 'my', label: '📚 Lộ trình của tôi' },
            { key: 'browse', label: '🔍 Khám phá template' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: My Enrollments ── */}
        {tab === 'my' && (
          isLoading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3 animate-bounce">📖</div>
              <p>Đang tải lộ trình...</p>
            </div>
          ) : enrollments.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">🗺️</div>
              <p className="font-medium text-gray-600">Bạn chưa đăng ký lộ trình nào</p>
              <button
                onClick={() => setTab('browse')}
                className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
              >
                Khám phá template →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar: enrollment list */}
              <div className="lg:col-span-1 space-y-2">
                {enrollments.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setSelectedEnrollment(e)}
                    className={`w-full text-left p-3 rounded-xl border transition-all
                      ${selectedEnrollment?.id === e.id
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-indigo-200'}`}
                  >
                    <p className="font-medium text-sm text-gray-800 truncate">{e.templateTitle}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs">{PACE_LABELS[e.paceMode]?.icon}</span>
                      <span className="text-xs text-gray-500">{PACE_LABELS[e.paceMode]?.label}</span>
                    </div>
                    <ProgressBar value={e.completedDays} max={e.totalDays} />
                    <p className="text-xs text-gray-400 mt-1">{e.completedDays}/{e.totalDays} ngày</p>
                  </button>
                ))}
              </div>

              {/* Main: schedule */}
              {selectedEnrollment && (
                <div className="lg:col-span-3">
                  {/* Stats bar */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="text-xl font-bold text-gray-800">{completedCount}</p>
                        <p className="text-xs text-gray-400">Đã hoàn thành</p>
                      </div>
                    </div>
                    {overdueCount > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <p className="text-xl font-bold text-red-600">{overdueCount}</p>
                          <p className="text-xs text-red-400">Quá hạn</p>
                        </div>
                      </div>
                    )}
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2">
                      <span className="text-2xl">🏁</span>
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {new Date(selectedEnrollment.estimatedEndDate).toLocaleDateString('vi-VN')}
                        </p>
                        <p className="text-xs text-gray-400">Dự kiến hoàn thành</p>
                      </div>
                    </div>
                  </div>

                  {/* Schedule list */}
                  {scheduleLoading ? (
                    <div className="text-center py-12 text-gray-400">Đang tải lịch học...</div>
                  ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                      {schedule.map((day, idx) => (
                        <div
                          key={day.dayNumber}
                          className={`bg-white rounded-xl border p-4 transition-all
                            ${day.isToday ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-md' : ''}
                            ${day.isOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}
                            ${day.isCompleted ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Day number + complete toggle */}
                            <button
                              onClick={() => toggleDayComplete(day)}
                              className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 transition-all font-bold text-xs
                                ${day.isCompleted
                                  ? 'bg-emerald-500 text-white'
                                  : day.isToday
                                    ? 'bg-indigo-600 text-white'
                                    : day.isOverdue
                                      ? 'bg-red-100 text-red-600 border-2 border-red-300'
                                      : 'bg-gray-100 text-gray-500 border-2 border-gray-200'}`}
                              title={day.isCompleted ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                            >
                              {day.isCompleted ? '✓' : `N${day.dayNumber}`}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {day.isToday && (
                                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full font-bold animate-pulse">
                                    HÔM NAY
                                  </span>
                                )}
                                {day.isOverdue && !day.isCompleted && (
                                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">
                                    QUÁ HẠN
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  {new Date(day.date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                                </span>
                              </div>

                              <p className={`font-medium text-sm mt-0.5 ${day.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {day.title}
                              </p>

                              {/* Skills */}
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {day.skills.map(s => <SkillBadge key={s} skill={s} />)}
                                <span className="ml-auto text-xs text-gray-400">⏱ {day.estimatedDurationMinutes} phút</span>
                              </div>

                              {/* LinkedLesson button OR drive files */}
                              {day.linkedLessonId ? (
                                <a
                                  href={`/?lesson=${day.linkedLessonId}`}
                                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs rounded-lg border border-indigo-200 transition-colors"
                                >
                                  ▶ Xem bài học: {day.linkedLessonTitle}
                                </a>
                              ) : day.driveFiles.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {day.driveFiles.map(f => (
                                    <a
                                      key={f.id}
                                      href={f.webViewLink || '#'}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-2 text-xs px-2 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                                    >
                                      <span>{f.resourceType === 0 ? '🎬' : f.resourceType === 1 ? '🎧' : '📄'}</span>
                                      <span className="flex-1 truncate text-gray-700">{f.fileName}</span>
                                      <span className="text-gray-400">🔗</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}

        {/* ── TAB: Browse Templates ── */}
        {tab === 'browse' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <p className="text-gray-400 col-span-3 text-center py-12">Chưa có template nào được xuất bản.</p>
            ) : templates.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-gray-800 leading-snug">{t.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${JLPT_COLORS[t.jlptLevel] ?? 'bg-gray-100'}`}>
                    {t.jlptLevel}
                  </span>
                </div>
                {t.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.description}</p>}
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                  <span>📅 {t.totalDays} ngày</span>
                  {t.totalEstimatedMinutes && (
                    <span>⏱ {Math.round(t.totalEstimatedMinutes / 60)}h tổng</span>
                  )}
                </div>
                <button
                  onClick={() => setEnrollTarget(t)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Đăng ký lộ trình này →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ENROLL DIALOG ── */}
      {enrollTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Đăng ký lộ trình</h3>
              <p className="text-sm text-gray-500 mt-1">{enrollTarget.title}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
              <input
                type="date"
                value={enrollStartDate}
                onChange={e => setEnrollStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nhịp học</label>
              <div className="space-y-2">
                {Object.entries(PACE_LABELS).map(([v, { label, icon }]) => {
                  const paceDesc = v === '0'
                    ? `~${enrollTarget.totalDays} ngày`
                    : v === '1'
                      ? `~${Math.ceil(enrollTarget.totalDays / 2)} ngày`
                      : `~${enrollTarget.totalDays * 2} ngày`;
                  return (
                    <label
                      key={v}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                        ${enrollPace === Number(v) ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}
                    >
                      <input
                        type="radio"
                        name="pace"
                        value={v}
                        checked={enrollPace === Number(v)}
                        onChange={() => setEnrollPace(Number(v))}
                        className="sr-only"
                      />
                      <span className="text-xl">{icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400">Hoàn thành trong {paceDesc}</p>
                      </div>
                      {enrollPace === Number(v) && <span className="ml-auto text-indigo-500">✓</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEnrollTarget(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleEnroll}
                disabled={isEnrolling}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isEnrolling ? '...' : '🚀 Bắt đầu học'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
