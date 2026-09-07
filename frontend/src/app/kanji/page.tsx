"use client";

import React, { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/Header";
import { KANJI_DATABASE, RADICALS_LIST, KanjiItem, KanjiExample } from "@/lib/kanji-data";
import { useI18n } from "@/lib/i18n";
import { useFavorites } from "@/lib/favorites";
import { useCustomKanji } from "@/lib/customKanji";
import { api } from "@/lib/api";
import {
  BookOpen,
  Search,
  Pencil,
  Sparkles,
  Layers,
  X,
  ChevronRight,
  ChevronLeft,
  Filter,
  CheckCircle2,
  ExternalLink,
  Flame,
  Star,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Tag,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Upload,
  AlertTriangle,
} from "lucide-react";

const KanjiCanvas = dynamic(
  () => import("@/components/learner/KanjiCanvas").then((mod) => mod.KanjiCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8 text-slate-400 text-xs gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        <span>Đang nạp công cụ vẽ Kanji...</span>
      </div>
    ),
  }
);

interface ParsedImportKanji {
  character: string;
  hanViet: string;
  meaning: string;
  onyomi: string[];
  kunyomi: string[];
  strokeCount: number;
  jlpt: "N5" | "N4" | "N3" | "N2" | "N1";
  radical: string;
  radicalName: string;
  examples: KanjiExample[];
  isValid: boolean;
}

export default function KanjiHubPage() {
  const { t } = useI18n();
  const { isKanjiFavorite, toggleKanjiFavorite, favoriteKanjis } = useFavorites();
  const {
    customKanjis,
    addCustomKanji,
    addMultipleCustomKanji,
    updateCustomKanji,
    deleteCustomKanji,
    syncKanjiFromVocab,
  } = useCustomKanji();

  // Filters State
  const [selectedJlpt, setSelectedJlpt] = useState<string>("all");
  const [selectedRadical, setSelectedRadical] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [strokeFilter, setStrokeFilter] = useState<string>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [showCustomOnly, setShowCustomOnly] = useState<boolean>(false);

  // Selected Kanji for Practice Modal
  const [activeKanji, setActiveKanji] = useState<KanjiItem | null>(null);

  // Modal State for Adding/Editing Kanji
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingKanjiId, setEditingKanjiId] = useState<string | null>(null);
  const [formCharacter, setFormCharacter] = useState<string>("");
  const [formHanViet, setFormHanViet] = useState<string>("");
  const [formMeaning, setFormMeaning] = useState<string>("");
  const [formOnyomi, setFormOnyomi] = useState<string>("");
  const [formKunyomi, setFormKunyomi] = useState<string>("");
  const [formStrokeCount, setFormStrokeCount] = useState<number>(4);
  const [formJlpt, setFormJlpt] = useState<"N5" | "N4" | "N3" | "N2" | "N1">("N5");
  const [formRadical, setFormRadical] = useState<string>("日");
  const [formRadicalName, setFormRadicalName] = useState<string>("Bộ Nhật");
  const [formExamplesText, setFormExamplesText] = useState<string>("");

  // Batch Import Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [importDelimiter, setImportDelimiter] = useState<";" | "," | "\t">(";");
  const [parsedImportList, setParsedImportList] = useState<ParsedImportKanji[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Sync Kanji from backend vocabulary entries on mount
  useEffect(() => {
    api.getVocabulary().then((vocabList) => {
      if (vocabList && vocabList.length > 0) {
        syncKanjiFromVocab(vocabList);
      }
    }).catch(() => {
      // Ignore if offline
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Combined Master Kanji Database (Default DB + User Custom DB)
  const masterKanjiList = useMemo(() => {
    const list: KanjiItem[] = [...customKanjis];
    const customChars = new Set(customKanjis.map((k) => k.character));

    for (const item of KANJI_DATABASE) {
      if (!customChars.has(item.character)) {
        list.push(item);
      }
    }
    return list;
  }, [customKanjis]);

  // Filtered Kanji list
  const filteredKanjiList = useMemo(() => {
    return masterKanjiList.filter((item) => {
      // Custom Only Filter
      if (showCustomOnly && !item.id.startsWith("custom-") && !item.id.startsWith("synced-vocab-")) return false;

      // Favorites Filter
      if (showFavoritesOnly && !isKanjiFavorite(item.character)) return false;

      // JLPT Filter
      if (!showFavoritesOnly && !showCustomOnly && selectedJlpt !== "all" && item.jlpt !== selectedJlpt) return false;

      // Radical Filter
      if (selectedRadical !== "all" && item.radical !== selectedRadical) return false;

      // Stroke Count Filter
      if (strokeFilter === "1-4" && (item.strokeCount < 1 || item.strokeCount > 4)) return false;
      if (strokeFilter === "5-8" && (item.strokeCount < 5 || item.strokeCount > 8)) return false;
      if (strokeFilter === "9-12" && (item.strokeCount < 9 || item.strokeCount > 12)) return false;
      if (strokeFilter === "13+" && item.strokeCount < 13) return false;

      // Search query (character, hanViet, meaning, onyomi, kunyomi, examples)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchChar = item.character.toLowerCase().includes(q);
        const matchHanViet = item.hanViet.toLowerCase().includes(q);
        const matchMeaning = item.meaning.toLowerCase().includes(q);
        const matchOn = item.onyomi.some((o) => o.toLowerCase().includes(q));
        const matchKun = item.kunyomi.some((k) => k.toLowerCase().includes(q));
        const matchEx = item.examples.some(
          (ex) =>
            ex.word.toLowerCase().includes(q) ||
            ex.reading.toLowerCase().includes(q) ||
            ex.meaning.toLowerCase().includes(q)
        );

        if (!matchChar && !matchHanViet && !matchMeaning && !matchOn && !matchKun && !matchEx) {
          return false;
        }
      }

      return true;
    });
  }, [masterKanjiList, selectedJlpt, selectedRadical, strokeFilter, searchQuery, showFavoritesOnly, showCustomOnly, favoriteKanjis]);

  // Open Create / Edit Modal
  const handleOpenAddModal = (item?: KanjiItem) => {
    if (item) {
      setEditingKanjiId(item.id);
      setFormCharacter(item.character);
      setFormHanViet(item.hanViet);
      setFormMeaning(item.meaning);
      setFormOnyomi(item.onyomi.join(", "));
      setFormKunyomi(item.kunyomi.join(", "));
      setFormStrokeCount(item.strokeCount || 4);
      setFormJlpt(item.jlpt || "N5");
      setFormRadical(item.radical || "日");
      setFormRadicalName(item.radicalName || "Bộ Nhật");
      setFormExamplesText(
        item.examples.map((ex) => `${ex.word}|${ex.reading}|${ex.meaning}`).join("\n")
      );
    } else {
      setEditingKanjiId(null);
      setFormCharacter("");
      setFormHanViet("");
      setFormMeaning("");
      setFormOnyomi("");
      setFormKunyomi("");
      setFormStrokeCount(4);
      setFormJlpt("N5");
      setFormRadical("日");
      setFormRadicalName("Bộ Nhật");
      setFormExamplesText("");
    }
    setShowAddModal(true);
  };

  const handleSaveKanji = () => {
    if (!formCharacter.trim() || !formHanViet.trim() || !formMeaning.trim()) {
      alert("Vui lòng nhập Chữ Hán, Âm Hán Việt và Ý nghĩa.");
      return;
    }

    const examples = formExamplesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split("|").map((p) => p.trim());
        return {
          word: parts[0] || formCharacter.trim(),
          reading: parts[1] || "",
          meaning: parts[2] || formMeaning.trim(),
        };
      });

    const payload = {
      character: formCharacter.trim(),
      hanViet: formHanViet.trim().toUpperCase(),
      meaning: formMeaning.trim(),
      onyomi: formOnyomi.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
      kunyomi: formKunyomi.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
      strokeCount: Number(formStrokeCount) || 4,
      jlpt: formJlpt,
      radical: formRadical,
      radicalName: formRadicalName,
      examples: examples.length > 0 ? examples : [{ word: formCharacter.trim(), reading: formKunyomi || formOnyomi || "", meaning: formMeaning.trim() }],
    };

    if (editingKanjiId) {
      updateCustomKanji(editingKanjiId, payload);
    } else {
      addCustomKanji(payload);
    }

    setShowAddModal(false);
  };

  const handleDeleteCustomKanji = (id: string, char: string) => {
    if (confirm(`Bạn có chắc muốn xóa chữ Hán "${char}" khỏi kho cá nhân?`)) {
      deleteCustomKanji(id);
      if (activeKanji?.id === id) setActiveKanji(null);
    }
  };

  // ─── Kanji Batch Import Logic ─────────────────────────────────────────────
  const parseKanjiImportData = (rawText: string, delim: string) => {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const parsed: ParsedImportKanji[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header row if matches common terms
      if (
        i === 0 &&
        (line.toLowerCase().includes("chữ hán") ||
          line.toLowerCase().includes("kanji") ||
          line.toLowerCase().includes("character") ||
          line.toLowerCase().includes("hán việt"))
      ) {
        continue;
      }

      const effectiveDelim = delim === "\t" ? "\t" : line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
      const parts = line.split(effectiveDelim).map((p) => p.trim());

      if (parts.length >= 3) {
        const char = parts[0] || "";
        const hanViet = (parts[1] || "").toUpperCase();
        const meaning = parts[2] || "";
        const onStr = parts[3] || "";
        const kunStr = parts[4] || "";
        const strokeStr = parts[5] || "";
        const jlptStr = (parts[6] || "N5").toUpperCase();
        const radStr = parts[7] || "";
        const radNameStr = parts[8] || "";
        const examplesStr = parts[9] || "";

        // Onyomi & Kunyomi
        const onyomi = onStr ? onStr.split(/[,，/、]/).map((s) => s.trim()).filter(Boolean) : [];
        const kunyomi = kunStr ? kunStr.split(/[,，/、]/).map((s) => s.trim()).filter(Boolean) : [];

        // Auto find radical if missing
        const matchedRad = RADICALS_LIST.find((r) => r.radical === (radStr || char)) || {
          radical: radStr || "日",
          name: radNameStr || "Bộ Nhật",
          strokeCount: 4,
        };

        const strokeCount = Number(strokeStr) > 0 ? Number(strokeStr) : matchedRad.strokeCount || 4;

        // JLPT level
        const validJlpt = (["N5", "N4", "N3", "N2", "N1"].includes(jlptStr.startsWith("N") ? jlptStr : `N${jlptStr}`)
          ? (jlptStr.startsWith("N") ? jlptStr : `N${jlptStr}`)
          : "N5") as "N5" | "N4" | "N3" | "N2" | "N1";

        // Examples
        const examples: KanjiExample[] = [];
        if (examplesStr) {
          const exItems = examplesStr.split(/[/\\&]/).map((s) => s.trim()).filter(Boolean);
          for (const exItem of exItems) {
            const exParts = exItem.split(/[|:]/).map((p) => p.trim());
            if (exParts.length >= 1) {
              examples.push({
                word: exParts[0],
                reading: exParts[1] || "",
                meaning: exParts[2] || meaning,
              });
            }
          }
        }

        if (examples.length === 0 && char) {
          examples.push({
            word: char,
            reading: kunyomi[0] || onyomi[0] || "",
            meaning: meaning,
          });
        }

        parsed.push({
          character: char,
          hanViet,
          meaning,
          onyomi,
          kunyomi,
          strokeCount,
          jlpt: validJlpt,
          radical: radStr || matchedRad.radical,
          radicalName: radNameStr || (matchedRad.name.startsWith("Bộ") ? matchedRad.name : `Bộ ${matchedRad.name}`),
          examples,
          isValid: Boolean(char && hanViet && meaning),
        });
      }
    }

    setParsedImportList(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setImportText(content);
        parseKanjiImportData(content, importDelimiter);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      "Chữ Hán;Âm Hán Việt;Ý nghĩa tiếng Việt;Âm On (Onyomi);Âm Kun (Kunyomi);Số nét;Cấp độ JLPT;Bộ thủ;Tên bộ thủ;Từ ghép ví dụ (Từ|Cách đọc|Nghĩa)\n" +
      "学;HỌC;Học tập, trường học;ガク;まな.ぶ;8;N5;子;Bộ Tử;学生|がくせい|Học sinh, sinh viên / 学校|がっこう|Trường học\n" +
      "語;NGỮ;Ngôn ngữ, từ ngữ, tiếng;ゴ;かた.る;14;N5;言;Bộ Ngôn;日本語|にほんご|Tiếng Nhật / 単語|たんご|Từ vựng\n" +
      "車;XA;Xe cộ, phương tiện;シャ;くるま;7;N5;車;Bộ Xa;車|くるま|Xe hơi / 電車|でんしゃ|Tàu điện / 自動車|じどうしゃ|Xe ô tô\n" +
      "食;THỰC;Ăn uống, món ăn;ショク, ジキ;た.べる, く.う;9;N5;食;Bộ Thực;食べる|たべる|Ăn / 食堂|しょくどう|Nhà ăn / 朝食|ちょうしょく|Bữa sáng\n" +
      "行;HÀNH / HÀNG;Đi lại, tiến hành, ngân hàng;コウ, ギョウ;い.く, ゆ.く, おこな.う;6;N5;行;Bộ Hành;行く|いく|Đi / 旅行|りょこう|Du lịch / 銀行|ぎんこう|Ngân hàng\n";

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "chu_han_kanji_mau_jlpt.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteBatchImport = () => {
    const validItems = parsedImportList.filter((item) => item.isValid);
    if (validItems.length === 0) {
      alert("Không có dòng chữ Hán hợp lệ nào để nạp. Vui lòng kiểm tra lại định dạng.");
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: validItems.length });

    try {
      const count = addMultipleCustomKanji(
        validItems.map((item) => ({
          character: item.character,
          hanViet: item.hanViet,
          meaning: item.meaning,
          onyomi: item.onyomi,
          kunyomi: item.kunyomi,
          strokeCount: item.strokeCount,
          jlpt: item.jlpt,
          radical: item.radical,
          radicalName: item.radicalName,
          examples: item.examples,
        }))
      );

      setImportProgress({ current: validItems.length, total: validItems.length });
      setShowImportModal(false);
      setImportText("");
      setParsedImportList([]);
      alert(`Đã nạp thành công ${count} chữ Hán vào kho cá nhân!`);
    } catch (err: any) {
      alert(`Lỗi khi nạp chữ Hán: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Navigate next / prev in modal
  const handleNextKanji = () => {
    if (!activeKanji) return;
    const idx = filteredKanjiList.findIndex((k) => k.id === activeKanji.id);
    if (idx !== -1 && idx < filteredKanjiList.length - 1) {
      setActiveKanji(filteredKanjiList[idx + 1]);
    } else if (filteredKanjiList.length > 0) {
      setActiveKanji(filteredKanjiList[0]);
    }
  };

  const handlePrevKanji = () => {
    if (!activeKanji) return;
    const idx = filteredKanjiList.findIndex((k) => k.id === activeKanji.id);
    if (idx > 0) {
      setActiveKanji(filteredKanjiList[idx - 1]);
    } else if (filteredKanjiList.length > 0) {
      setActiveKanji(filteredKanjiList[filteredKanjiList.length - 1]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] dark:bg-[#090d16] text-[#0b1c30] dark:text-slate-100 font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col gap-5 pt-20">
        {/* ── 1. Top Bento Hub Header ── */}
        <div className="bento-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/10 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-2xl shrink-0 border border-orange-200/60 dark:border-orange-800/40 shadow-xs">
              漢
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-[#0b1c30] dark:text-white tracking-tight">
                  Kho Tra Cứu & Luyện Viết Chữ Hán
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-extrabold text-[11px] border border-orange-200 dark:border-orange-800">
                  {filteredKanjiList.length} chữ Hán
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Tổng hợp Chữ Hán JLPT N5 — N1, phân loại 214 Bộ thủ, tra cứu Âm Hán Việt, On/Kun & luyện viết từng nét tương tác.
              </p>
            </div>
          </div>

          {/* Action Pills */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => {
                setImportText("");
                setParsedImportList([]);
                setShowImportModal(true);
              }}
              className="btn-tactile-emerald px-4 py-2 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import CSV / Excel</span>
            </button>

            <button
              onClick={() => handleOpenAddModal()}
              className="btn-tactile-amber px-4 py-2 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Chữ Hán</span>
            </button>
          </div>
        </div>

        {/* ── 2. Search & Filters Bento Control Center ── */}
        <div className="bento-card p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm">
          {/* Top Row: Search input & JLPT level tabs */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* JLPT Level Tabs + Favorite Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "all", label: "Tất Cả" },
                { id: "N5", label: "JLPT N5" },
                { id: "N4", label: "JLPT N4" },
                { id: "N3", label: "JLPT N3" },
                { id: "N2", label: "JLPT N2" },
                { id: "N1", label: "JLPT N1" },
              ].map((lvl) => {
                const isSelected = !showFavoritesOnly && !showCustomOnly && selectedJlpt === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    onClick={() => {
                      setShowFavoritesOnly(false);
                      setShowCustomOnly(false);
                      setSelectedJlpt(lvl.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#fd761a] text-white shadow-[0_3px_0_#9d4300]"
                        : "bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 text-[#0b1c30] dark:text-slate-200 border border-[#d3e4fe] dark:border-slate-700 shadow-[0_2px_0_#d3e4fe] dark:shadow-[0_2px_0_#1e293b]"
                    }`}
                  >
                    {lvl.label}
                  </button>
                );
              })}

              <button
                onClick={() => {
                  setShowCustomOnly(!showCustomOnly);
                  setShowFavoritesOnly(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  showCustomOnly
                    ? "bg-purple-600 text-white shadow-[0_3px_0_#6d28d9]"
                    : "bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-[0_2px_0_#ddd6fe] dark:shadow-[0_2px_0_#581c87]"
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Tự Thêm ({customKanjis.length})</span>
              </button>

              <button
                onClick={() => {
                  setShowFavoritesOnly(!showFavoritesOnly);
                  setShowCustomOnly(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  showFavoritesOnly
                    ? "bg-amber-500 text-white shadow-[0_3px_0_#c2410c]"
                    : "bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-[0_2px_0_#fde68a] dark:shadow-[0_2px_0_#78350f]"
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Yêu Thích ({favoriteKanjis.length})</span>
              </button>
            </div>

            {/* Search Input & Stroke filter */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm chữ Hán, Hán Việt, Romaji, nghĩa..."
                  className="w-full pl-9 pr-3 py-2 rounded-full bg-[#eff4ff] dark:bg-slate-800 text-xs font-bold text-[#0b1c30] dark:text-white placeholder:text-slate-400 border border-[#d3e4fe] dark:border-slate-700 focus:border-orange-400 dark:focus:border-orange-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 shadow-inner transition-all"
                />
              </div>

              <select
                value={strokeFilter}
                onChange={(e) => setStrokeFilter(e.target.value)}
                className="px-3 py-2 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs text-[#0b1c30] dark:text-white font-bold focus:outline-none shadow-2xs cursor-pointer"
              >
                <option value="all">Số Nét: Tất Cả</option>
                <option value="1-4">1 — 4 nét</option>
                <option value="5-8">5 — 8 nét</option>
                <option value="9-12">9 — 12 nét</option>
                <option value="13+">13+ nét</option>
              </select>
            </div>
          </div>

          {/* Bottom Row: 214 Radicals (Bộ Thủ) Horizontal Carousel */}
          <div className="flex flex-col gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-[#0b1c30] dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-500" />
                Lọc Theo Bộ Thủ Gốc:
              </span>
              {selectedRadical !== "all" && (
                <button
                  onClick={() => setSelectedRadical("all")}
                  className="text-orange-600 dark:text-orange-400 font-black hover:underline cursor-pointer"
                >
                  Xóa lọc bộ thủ (Hiện tất cả)
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedRadical("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedRadical === "all"
                    ? "bg-[#0b1c30] dark:bg-white text-white dark:text-[#0b1c30] shadow-sm"
                    : "bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#d3e4fe] dark:border-slate-700"
                }`}
              >
                Tất Cả Bộ Thủ
              </button>

              {RADICALS_LIST.map((rad) => (
                <button
                  key={rad.radical}
                  onClick={() => setSelectedRadical(rad.radical)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all border cursor-pointer ${
                    selectedRadical === rad.radical
                      ? "bg-orange-50 dark:bg-orange-950/40 border-orange-400 text-orange-700 dark:text-orange-300 shadow-2xs"
                      : "bg-[#eff4ff]/60 hover:bg-[#dce9ff] dark:bg-slate-800/80 border-[#d3e4fe] dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="text-sm font-black">{rad.radical}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({rad.name})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 3. Kanji Cards Grid (Playful Bento Tiles) ── */}
        {filteredKanjiList.length === 0 ? (
          <div className="bento-card p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-3">
            <p className="font-semibold">Không tìm thấy chữ Hán nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm.</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenAddModal()}
                className="btn-tactile-amber px-4 py-2 text-xs font-black cursor-pointer"
              >
                + Thêm Chữ Hán Này Vào Kho
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-tactile-emerald px-4 py-2 text-xs font-black cursor-pointer"
              >
                Import CSV / Excel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredKanjiList.map((item) => {
              const isCustom = item.id.startsWith("custom-") || item.id.startsWith("synced-vocab-");
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveKanji(item)}
                  className="bento-card p-4 hover:border-orange-300 dark:hover:border-orange-600 transition-all cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden group shadow-2xs active:scale-[0.99]"
                >
                  {/* Card Top: Kanji & Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[10px]">
                          {item.jlpt}
                        </span>
                        {isCustom && (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold text-[9px] border border-purple-200 dark:border-purple-800">
                            {item.id.startsWith("synced-vocab-") ? "Từ vựng" : "Tự thêm"}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleKanjiFavorite(item.character);
                          }}
                          title={isKanjiFavorite(item.character) ? "Bỏ yêu thích" : "Lưu vào chữ Hán yêu thích"}
                          className={`p-1 rounded-lg border transition-all cursor-pointer ${
                            isKanjiFavorite(item.character)
                              ? "bg-amber-50 border-amber-300 text-amber-500"
                              : "bg-[#eff4ff] dark:bg-slate-800 border-[#d3e4fe] dark:border-slate-700 text-slate-400 hover:text-amber-500"
                          }`}
                        >
                          <Star className={`w-3 h-3 ${isKanjiFavorite(item.character) ? "fill-amber-500 text-amber-500" : ""}`} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-400 font-mono">
                          {item.strokeCount} nét
                        </span>
                        {isCustom && (
                          <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAddModal(item);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-purple-600 cursor-pointer"
                              title="Chỉnh sửa chữ Hán"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomKanji(item.id, item.character);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-500 cursor-pointer"
                              title="Xóa khỏi kho"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 my-2">
                      <div className="w-16 h-16 rounded-2xl bg-[#eff4ff] dark:bg-slate-800/80 border border-[#d3e4fe] dark:border-slate-700 flex items-center justify-center text-3xl font-black text-[#0b1c30] dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:scale-110 transition-all shadow-inner">
                        {item.character}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-black text-[#0b1c30] dark:text-white tracking-wide uppercase truncate">
                          {item.hanViet}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 font-medium">
                          {item.meaning}
                        </p>
                      </div>
                    </div>

                    {/* Readings */}
                    <div className="flex flex-col gap-1 text-[11px] mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold w-9 shrink-0">On:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate">
                          {item.onyomi.length > 0 ? item.onyomi.join(", ") : "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold w-9 shrink-0">Kun:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate">
                          {item.kunyomi.length > 0 ? item.kunyomi.join(", ") : "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Practice Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveKanji(item);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full bg-[#eff4ff] hover:bg-[#fd761a] dark:bg-slate-800 text-[#0b1c30] dark:text-slate-300 hover:text-white dark:hover:text-white font-extrabold text-xs transition-all shadow-2xs border border-[#d3e4fe] dark:border-slate-700 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Tập Viết & Xem Nét</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ════════════════════════════ ADD / EDIT KANJI MODAL ════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bento-card p-6 max-w-xl w-full flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-[#0b1c30] dark:text-white flex items-center gap-2">
                <span className="text-orange-500 font-black text-xl">漢</span>
                {editingKanjiId ? "Chỉnh Sửa Chữ Hán" : "Thêm Chữ Hán Mới Vào Kho"}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Chữ Hán (Ký tự) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formCharacter}
                  onChange={(e) => setFormCharacter(e.target.value)}
                  placeholder="e.g. 学 hoặc 語"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-bold text-[#0b1c30] dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Âm Hán Việt <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formHanViet}
                  onChange={(e) => setFormHanViet(e.target.value)}
                  placeholder="e.g. HỌC, NGỮ"
                  className="w-full px-4 py-2.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-black text-[#0b1c30] dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 focus:outline-none uppercase"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Ý nghĩa tiếng Việt <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formMeaning}
                  onChange={(e) => setFormMeaning(e.target.value)}
                  placeholder="e.g. Học tập, trường học, ngôn ngữ"
                  className="w-full px-4 py-2.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-bold text-[#0b1c30] dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Âm Onyomi (cách nhau dấu phẩy)
                </label>
                <input
                  type="text"
                  value={formOnyomi}
                  onChange={(e) => setFormOnyomi(e.target.value)}
                  placeholder="e.g. ガク, ゴ"
                  className="w-full px-4 py-2.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-bold text-[#0b1c30] dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Âm Kunyomi (cách nhau dấu phẩy)
                </label>
                <input
                  type="text"
                  value={formKunyomi}
                  onChange={(e) => setFormKunyomi(e.target.value)}
                  placeholder="e.g. まな.ぶ, かた.る"
                  className="w-full px-4 py-2.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-bold text-[#0b1c30] dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Cấp độ JLPT
                </label>
                <select
                  value={formJlpt}
                  onChange={(e) => setFormJlpt(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-bold text-[#0b1c30] dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="N5">JLPT N5</option>
                  <option value="N4">JLPT N4</option>
                  <option value="N3">JLPT N3</option>
                  <option value="N2">JLPT N2</option>
                  <option value="N1">JLPT N1</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Số nét vẽ
                </label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={formStrokeCount}
                  onChange={(e) => setFormStrokeCount(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-bold text-[#0b1c30] dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Bộ thủ gốc
                </label>
                <select
                  value={formRadical}
                  onChange={(e) => {
                    const rad = RADICALS_LIST.find((r) => r.radical === e.target.value);
                    setFormRadical(e.target.value);
                    if (rad) setFormRadicalName(`Bộ ${rad.name}`);
                  }}
                  className="w-full px-4 py-2.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-bold text-[#0b1c30] dark:text-white focus:outline-none cursor-pointer"
                >
                  {RADICALS_LIST.map((r) => (
                    <option key={r.radical} value={r.radical}>
                      {r.radical} — {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Tên bộ thủ
                </label>
                <input
                  type="text"
                  value={formRadicalName}
                  onChange={(e) => setFormRadicalName(e.target.value)}
                  placeholder="e.g. Bộ Nhật, Bộ Mộc"
                  className="w-full px-4 py-2.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-bold text-[#0b1c30] dark:text-white focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Từ ghép ví dụ (Mỗi dòng một từ: Từ|Cách đọc|Nghĩa)
                </label>
                <textarea
                  rows={3}
                  value={formExamplesText}
                  onChange={(e) => setFormExamplesText(e.target.value)}
                  placeholder="e.g.&#10;学生|がくせい|Học sinh, sinh viên&#10;学校|がっこう|Trường học"
                  className="w-full p-3 rounded-2xl bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-mono text-[#0b1c30] dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-tactile-secondary px-4 py-2 rounded-full text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveKanji}
                className="btn-tactile-amber px-5 py-2 rounded-full text-xs font-black cursor-pointer"
              >
                {editingKanjiId ? "Cập Nhật" : "Lưu Chữ Hán"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════ BATCH IMPORT KANJI MODAL ════════════════════════════ */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bento-card p-6 max-w-3xl w-full flex flex-col gap-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                <h3 className="font-black text-base text-[#0b1c30] dark:text-white">
                  Import Chữ Hán Hàng Loạt (CSV / Excel / TXT)
                </h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Download Guide Banner */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Mẫu file chuẩn: Chữ Hán; Hán Việt; Ý nghĩa; On; Kun; Số nét; JLPT; Bộ thủ; Tên bộ thủ; Ví dụ
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                  Tải file CSV mẫu có sẵn dữ liệu chuẩn để mở bằng Excel hoặc Google Sheets.
                </p>
              </div>

              <button
                onClick={handleDownloadTemplate}
                className="btn-tactile-emerald px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải File Mẫu (.CSV)</span>
              </button>
            </div>

            {/* Upload File or Paste Text */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-orange-500" />
                  1. Tải lên file CSV / TXT hoặc Dán nội dung bên dưới:
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-medium">Dấu phân cách:</span>
                  <select
                    value={importDelimiter}
                    onChange={(e) => {
                      const d = e.target.value as any;
                      setImportDelimiter(d);
                      if (importText) parseKanjiImportData(importText, d);
                    }}
                    className="px-2.5 py-1 rounded-full bg-[#eff4ff] dark:bg-slate-800 text-xs font-bold border border-[#d3e4fe] dark:border-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value=";">Chấm phẩy (;)</option>
                    <option value=",">Dấu phẩy (,)</option>
                    <option value="	">Tab (Excel copy)</option>
                  </select>
                </div>
              </div>

              <input
                type="file"
                accept=".csv, .txt, .tsv"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#eff4ff] dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-[#dce9ff] cursor-pointer"
              />

              <textarea
                rows={5}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  parseKanjiImportData(e.target.value, importDelimiter);
                }}
                placeholder="Dán dữ liệu chữ Hán vào đây (Ví dụ: 学;HỌC;Học tập;ガク;まな.ぶ;8;N5;子;Bộ Tử;学生|がくせい|Học sinh)..."
                className="w-full p-3 rounded-2xl bg-[#eff4ff] dark:bg-slate-800 border border-[#d3e4fe] dark:border-slate-700 text-xs font-mono text-[#0b1c30] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
              />
            </div>

            {/* Parsed Preview Table */}
            {parsedImportList.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-[#0b1c30] dark:text-slate-200">
                    2. Xem trước kết quả nạp ({parsedImportList.filter((k) => k.isValid).length} hợp lệ / {parsedImportList.length} dòng):
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-[#d3e4fe] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#eff4ff] dark:bg-slate-800 border-b border-[#d3e4fe] dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase sticky top-0">
                      <tr>
                        <th className="p-2.5">Trạng thái</th>
                        <th className="p-2.5">Chữ Hán</th>
                        <th className="p-2.5">Hán Việt</th>
                        <th className="p-2.5">Ý nghĩa</th>
                        <th className="p-2.5">On / Kun</th>
                        <th className="p-2.5">Số nét</th>
                        <th className="p-2.5">JLPT</th>
                        <th className="p-2.5">Bộ thủ</th>
                        <th className="p-2.5">Ví dụ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedImportList.map((item, idx) => (
                        <tr key={idx} className={item.isValid ? "" : "bg-rose-50/50 dark:bg-rose-950/20"}>
                          <td className="p-2.5">
                            {item.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500">
                                <AlertTriangle className="w-3.5 h-3.5" /> Thiếu thông tin
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-black text-sm text-[#0b1c30] dark:text-white">{item.character}</td>
                          <td className="p-2.5 font-black uppercase text-orange-600 dark:text-orange-400">{item.hanViet}</td>
                          <td className="p-2.5 max-w-[140px] truncate">{item.meaning}</td>
                          <td className="p-2.5 text-[11px] text-slate-500">
                            {item.onyomi.join(", ") || "-"} / {item.kunyomi.join(", ") || "-"}
                          </td>
                          <td className="p-2.5 font-mono font-bold">{item.strokeCount}</td>
                          <td className="p-2.5 font-bold">{item.jlpt}</td>
                          <td className="p-2.5 text-slate-500">{item.radicalName} ({item.radical})</td>
                          <td className="p-2.5 text-[11px] text-slate-500 max-w-[120px] truncate">
                            {item.examples.map((ex) => ex.word).join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Progress Bar during import */}
            {isImporting && (
              <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <span>Đang nạp chữ Hán vào hệ thống...</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="w-full h-2 bg-emerald-200 dark:bg-emerald-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-150"
                    style={{
                      width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowImportModal(false)}
                disabled={isImporting}
                className="btn-tactile-secondary px-4 py-2 rounded-full text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleExecuteBatchImport}
                disabled={isImporting || parsedImportList.filter((k) => k.isValid).length === 0}
                className="btn-tactile-emerald px-5 py-2 rounded-full text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Nạp {parsedImportList.filter((k) => k.isValid).length} Chữ Hán Vào Kho</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════ KANJI PRACTICE MODAL ════════════════════════════ */}
      {activeKanji && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bento-card p-6 max-w-4xl w-full flex flex-col gap-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-orange-500 text-white font-black text-2xl flex items-center justify-center shadow-xs">
                  {activeKanji.character}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[10px]">
                      {activeKanji.jlpt}
                    </span>
                    <h2 className="text-lg font-black text-[#0b1c30] dark:text-white tracking-tight">
                      Chữ Hán: <span className="text-orange-600 dark:text-orange-400">{activeKanji.hanViet}</span>
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {activeKanji.meaning} • {activeKanji.strokeCount} nét • {activeKanji.radicalName} ({activeKanji.radical})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleKanjiFavorite(activeKanji.character)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                    isKanjiFavorite(activeKanji.character)
                      ? "bg-amber-50 border-amber-300 text-amber-600"
                      : "bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 border-[#d3e4fe] dark:border-slate-700 text-slate-500 hover:text-amber-500"
                  }`}
                  title={isKanjiFavorite(activeKanji.character) ? "Bỏ yêu thích" : "Lưu vào chữ Hán yêu thích"}
                >
                  <Star className={`w-3.5 h-3.5 ${isKanjiFavorite(activeKanji.character) ? "fill-amber-500 text-amber-500" : ""}`} />
                  <span className="hidden sm:inline font-black">{isKanjiFavorite(activeKanji.character) ? "Đã Lưu" : "Lưu Yêu Thích"}</span>
                </button>

                <button
                  onClick={handlePrevKanji}
                  className="p-2 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#d3e4fe] dark:border-slate-700 shadow-2xs transition-all active:scale-90 cursor-pointer"
                  title="Chữ Hán trước (‹)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextKanji}
                  className="p-2 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#d3e4fe] dark:border-slate-700 shadow-2xs transition-all active:scale-90 cursor-pointer"
                  title="Chữ Hán tiếp theo (›)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveKanji(null)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: 2 Columns (Canvas vs Details) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: HanziWriter Canvas (7 cols) */}
              <div className="md:col-span-7 flex flex-col items-center justify-center p-5 rounded-3xl bg-[#eff4ff]/60 dark:bg-slate-800/40 border border-[#d3e4fe] dark:border-slate-700 shadow-inner">
                <KanjiCanvas
                  kanji={activeKanji.character}
                  size={290}
                  hanViet={activeKanji.hanViet}
                  meaning={activeKanji.meaning}
                />
              </div>

              {/* Right Column: Readings, Meaning & Examples (5 cols) */}
              <div className="md:col-span-5 flex flex-col gap-4">
                {/* On / Kun Box */}
                <div className="p-4 rounded-2xl bg-[#eff4ff] dark:bg-slate-800/60 border border-[#d3e4fe] dark:border-slate-700 shadow-2xs flex flex-col gap-2">
                  <h4 className="text-xs font-black text-[#0b1c30] dark:text-white uppercase tracking-wider">
                    Cách Đọc Âm On & Kun
                  </h4>
                  <div className="text-xs flex flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-black text-[10px] shrink-0 border border-orange-200">
                        Onyomi
                      </span>
                      <span className="font-bold text-[#0b1c30] dark:text-slate-200">
                        {activeKanji.onyomi.length > 0 ? activeKanji.onyomi.join("、") : "—"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-black text-[10px] shrink-0 border border-emerald-200">
                        Kunyomi
                      </span>
                      <span className="font-bold text-[#0b1c30] dark:text-slate-200">
                        {activeKanji.kunyomi.length > 0 ? activeKanji.kunyomi.join("、") : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Common Words & Examples */}
                <div className="flex flex-col gap-2 flex-1">
                  <h4 className="text-xs font-black text-[#0b1c30] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-orange-500" />
                    Từ Vựng Ghép Thường Gặp
                  </h4>

                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                    {activeKanji.examples.map((ex, exIdx) => (
                      <div
                        key={exIdx}
                        className="p-2.5 rounded-2xl bg-[#eff4ff]/60 dark:bg-slate-800/60 border border-[#d3e4fe] dark:border-slate-700 shadow-2xs flex flex-col gap-0.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-black text-sm text-[#0b1c30] dark:text-white">
                            {ex.word}
                          </span>
                          <span className="font-bold text-xs text-orange-600 dark:text-orange-400">
                            {ex.reading}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {ex.meaning}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-400 font-semibold">
                Sử dụng các phím mũi tên hoặc nút Next/Prev để chuyển nhanh chữ Hán.
              </span>
              <button
                onClick={() => setActiveKanji(null)}
                className="btn-tactile-amber px-5 py-2 rounded-full text-xs font-black cursor-pointer"
              >
                Hoàn Thành Luyện Viết
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
