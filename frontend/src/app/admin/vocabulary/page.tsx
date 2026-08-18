"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/Header";
import { VocabularyEntry, Course, api } from "@/lib/api";
import { playJapaneseSpeech } from "@/lib/tts";
import { useI18n } from "@/lib/i18n";
import { useFavorites } from "@/lib/favorites";
import { useVocabFolders, VocabFolder } from "@/lib/vocabFolders";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Filter,
  Volume2,
  Image as ImageIcon,
  X,
  BrainCircuit,
  Pencil,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  ExternalLink,
  Star,
  Loader2,
  Folder,
  FolderPlus,
  Tag,
  Check,
  Edit2,
} from "lucide-react";

export interface VocabMetadata {
  hanViet?: string;
  imageUrl?: string;
  folderId?: string;
  folderName?: string;
}

export interface ParsedImportVocab {
  word: string;
  reading: string;
  hanViet: string;
  meaning: string;
  imageUrl: string;
  partOfSpeech: string;
  jlptLevel: string;
  exampleSentence: string;
  exampleSentenceTranslation: string;
  folderId?: string;
  isValid: boolean;
}

const KanjiCanvas = dynamic(
  () => import("@/components/learner/KanjiCanvas").then((mod) => mod.KanjiCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-6 text-slate-400 text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
        <span>Đang nạp bảng vẽ Kanji...</span>
      </div>
    ),
  }
);

export default function AdminVocabularyPage() {
  const { t } = useI18n();
  const { isVocabFavorite, toggleVocabFavorite, favoriteVocabIds } = useFavorites();
  const { folders, createFolder, updateFolder, deleteFolder } = useVocabFolders();

  const [vocabList, setVocabList] = useState<VocabularyEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Kanji Practice Modal state
  const [practiceKanji, setPracticeKanji] = useState<string | null>(null);

  // Filters
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");

  // Single Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingVocabId, setEditingVocabId] = useState<string | null>(null);
  const [word, setWord] = useState("");
  const [reading, setReading] = useState("");
  const [hanViet, setHanViet] = useState("");
  const [meaning, setMeaning] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [exampleSentence, setExampleSentence] = useState("");
  const [exampleTranslation, setExampleTranslation] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("Danh từ");
  const [jlptLevel, setJlptLevel] = useState("N5");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [vocabFolderId, setVocabFolderId] = useState("");

  // Folder Management Modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [folderDescInput, setFolderDescInput] = useState("");
  const [folderColorInput, setFolderColorInput] = useState("orange");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // Batch Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importDelimiter, setImportDelimiter] = useState<";" | "," | "\t">(";");
  const [parsedImportList, setParsedImportList] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importFolderId, setImportFolderId] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [vData, cData] = await Promise.all([
        api.getVocabulary(undefined, selectedLevel || undefined, searchQuery || undefined),
        api.getCourses(),
      ]);
      setVocabList(vData);
      setCourses(cData);
    } catch (err) {
      console.error("Failed to load vocabulary data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedLevel, searchQuery]);

  const handleSaveVocab = async () => {
    if (!word || !reading || !meaning) {
      alert("Vui lòng nhập Từ vựng, Cách đọc và Ý nghĩa.");
      return;
    }

    try {
      const meta = {
        imageUrl: imageUrl.trim() || undefined,
        hanViet: hanViet.trim() || undefined,
        folderId: vocabFolderId || undefined,
      };

      if (editingVocabId) {
        await api.updateVocabulary(editingVocabId, {
          word: word.trim(),
          reading: reading.trim(),
          meaning: meaning.trim(),
          exampleSentence: exampleSentence.trim(),
          exampleSentenceTranslation: exampleTranslation.trim(),
          partOfSpeech,
          jlptLevel,
          lessonId: selectedLessonId || undefined,
          tagsJson: JSON.stringify(meta),
        });
      } else {
        await api.createVocabulary({
          word: word.trim(),
          reading: reading.trim(),
          meaning: meaning.trim(),
          exampleSentence: exampleSentence.trim(),
          exampleSentenceTranslation: exampleTranslation.trim(),
          partOfSpeech,
          jlptLevel,
          lessonId: selectedLessonId || undefined,
          tagsJson: JSON.stringify(meta),
        });
      }

      setWord("");
      setReading("");
      setHanViet("");
      setMeaning("");
      setImageUrl("");
      setExampleSentence("");
      setExampleTranslation("");
      setVocabFolderId("");
      setEditingVocabId(null);
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(`Lỗi lưu từ vựng: ${err.message}`);
    }
  };

  const handleOpenEdit = (item: VocabularyEntry) => {
    let parsedMeta: any = {};
    if (item.tagsJson) {
      try {
        parsedMeta = JSON.parse(item.tagsJson);
      } catch {}
    }

    setEditingVocabId(item.id);
    setWord(item.word);
    setReading(item.reading);
    setMeaning(item.meaning);
    setHanViet(parsedMeta.hanViet || "");
    setImageUrl(parsedMeta.imageUrl || "");
    setVocabFolderId(parsedMeta.folderId || "");
    setExampleSentence(item.exampleSentence || "");
    setExampleTranslation(item.exampleSentenceTranslation || "");
    setPartOfSpeech(item.partOfSpeech || "Danh từ");
    setJlptLevel(item.jlptLevel || "N5");
    setSelectedLessonId(item.lessonId || "");
    setShowModal(true);
  };

  const handleDeleteVocab = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa từ vựng này?")) {
      await api.deleteVocabulary(id);
      loadData();
    }
  };

  // Folder creation / updating
  const handleSaveFolder = () => {
    if (!folderNameInput.trim()) {
      alert("Vui lòng nhập tên thư mục / chủ đề.");
      return;
    }

    if (editingFolderId) {
      updateFolder(editingFolderId, folderNameInput, folderDescInput, folderColorInput);
    } else {
      createFolder(folderNameInput, folderDescInput, folderColorInput);
    }

    setFolderNameInput("");
    setFolderDescInput("");
    setEditingFolderId(null);
    setShowFolderModal(false);
  };

  const handleOpenEditFolder = (f: VocabFolder) => {
    setEditingFolderId(f.id);
    setFolderNameInput(f.name);
    setFolderDescInput(f.description || "");
    setFolderColorInput(f.color || "orange");
    setShowFolderModal(true);
  };

  const handleDeleteFolder = (id: string, name: string) => {
    if (confirm(`Bạn có chắc muốn xóa thư mục "${name}"? (Các từ vựng trong thư mục sẽ không bị xóa mà chuyển về dạng chung).`)) {
      deleteFolder(id);
      if (selectedFolderId === id) setSelectedFolderId("all");
    }
  };

  // ─── Batch Import Logic ───────────────────────────────────────────────────
  const parseImportData = (rawText: string, delim: string) => {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const parsed: ParsedImportVocab[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && (line.toLowerCase().includes("từ vựng") || line.toLowerCase().includes("kanji") || line.toLowerCase().includes("word"))) {
        continue;
      }

      const effectiveDelim = delim === "\t" ? "\t" : line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
      const parts = line.split(effectiveDelim).map((p) => p.trim());

      if (parts.length >= 3) {
        const itemWord = parts[0] || "";
        const itemReading = parts[1] || "";
        const itemHanViet = parts.length >= 4 ? parts[2] : "";
        const itemMeaning = parts.length >= 4 ? parts[3] : parts[2];
        const itemPos = parts.length >= 5 ? parts[4] || "Danh từ" : "Danh từ";
        const itemLevel = parts.length >= 6 ? parts[5] || "N5" : "N5";
        const itemEx = parts.length >= 7 ? parts[6] : "";
        const itemExTrans = parts.length >= 8 ? parts[7] : "";
        const itemImg = parts.length >= 9 ? parts[8] : "";

        parsed.push({
          word: itemWord,
          reading: itemReading,
          hanViet: itemHanViet,
          meaning: itemMeaning,
          partOfSpeech: itemPos,
          jlptLevel: itemLevel.toUpperCase().startsWith("N") ? itemLevel.toUpperCase() : `N${itemLevel}`,
          exampleSentence: itemEx,
          exampleSentenceTranslation: itemExTrans,
          imageUrl: itemImg,
          isValid: Boolean(itemWord && itemReading && itemMeaning),
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
        parseImportData(content, importDelimiter);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      "Từ vựng (Kanji/Kana);Cách đọc (Furigana);Hán Việt;Ý nghĩa tiếng Việt;Loại từ;Cấp độ JLPT;Câu ví dụ;Dịch câu ví dụ;Link Hình Ảnh Minh Họa\n" +
      "先生;せんせい;TIÊN SINH;Thầy giáo, cô giáo;Danh từ;N5;田中先生は日本語を教えます。;Thầy Tanaka dạy tiếng Nhật.;https://images.unsplash.com/photo-1580894732488-8eb133036577\n" +
      "学生;がくせい;HỌC SINH;Học sinh, sinh viên;Danh từ;N5;私はハノイ大学の学生です。;Tôi là sinh viên trường Đại học Hà Nội.;https://images.unsplash.com/photo-1523240795612-9a054b0db644\n" +
      "本;ほん;BẢN;Quyển sách;Danh từ;N5;机の上に本があります。;Có quyển sách ở trên bàn.;https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c\n" +
      "日本;にほん;NHẬT BẢN;Nước Nhật Bản;Danh từ;N5;来年、日本へ行きます。;Năm sau tôi sẽ đi Nhật Bản.;https://images.unsplash.com/photo-1503899036084-c55cdd92da26\n";

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "tu_vung_mau_anki_jlpt.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteBatchImport = async () => {
    const validItems = parsedImportList.filter((item) => item.isValid);
    if (validItems.length === 0) {
      alert("Không có dòng từ vựng hợp lệ nào để nạp.");
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: validItems.length });

    try {
      let successCount = 0;
      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        const meta = {
          imageUrl: item.imageUrl ? item.imageUrl.trim() : undefined,
          hanViet: item.hanViet ? item.hanViet.trim() : undefined,
          folderId: importFolderId || undefined,
        };

        await api.createVocabulary({
          word: item.word,
          reading: item.reading,
          meaning: item.meaning,
          partOfSpeech: item.partOfSpeech || "Danh từ",
          jlptLevel: item.jlptLevel || "N5",
          exampleSentence: item.exampleSentence || undefined,
          exampleSentenceTranslation: item.exampleSentenceTranslation || undefined,
          lessonId: selectedLessonId || undefined,
          tagsJson: JSON.stringify(meta),
        });

        successCount++;
        setImportProgress({ current: i + 1, total: validItems.length });
      }

      setShowImportModal(false);
      setImportText("");
      setParsedImportList([]);
      alert(`Đã nạp thành công ${successCount} từ vựng vào hệ thống!`);
      loadData();
    } catch (err: any) {
      alert(`Lỗi khi import từ vựng: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const allLessons = courses.flatMap((c) =>
    c.sections.flatMap((s) =>
      s.lessons.map((l) => ({
        id: l.id,
        name: `${c.jlptLevel} — ${s.title} -> ${l.title}`,
      }))
    )
  );

  // Helper to parse folder from item tagsJson
  const getItemFolderId = (item: VocabularyEntry): string | null => {
    if (!item.tagsJson) return null;
    try {
      const meta = JSON.parse(item.tagsJson);
      return meta.folderId || null;
    } catch {
      return null;
    }
  };

  // Filtered Vocab by Folder & Level
  const filteredVocabList = vocabList.filter((item) => {
    if (selectedFolderId === "fav") {
      return isVocabFavorite(item.id);
    }
    if (selectedFolderId !== "all") {
      const fId = getItemFolderId(item);
      return fId === selectedFolderId;
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-900/5 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 pt-20">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold uppercase tracking-wider">
                Vocabulary CMS & Folders
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-orange-500" />
                Quản Lý Kho Từ Vựng & Thư Mục Chủ Đề
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tạo folder/chủ đề tùy chỉnh, lưu từ vựng yêu thích (⭐), phát âm giọng Nhật (TTS), và import CSV Anki.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setEditingFolderId(null);
                setFolderNameInput("");
                setFolderDescInput("");
                setShowFolderModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all active:scale-95"
            >
              <FolderPlus className="w-4 h-4" />
              Tạo Thư Mục Mới
            </button>

            <button
              onClick={() => {
                setImportText("");
                setParsedImportList([]);
                setShowImportModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-500/20 transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import CSV / Excel
            </button>

            <button
              onClick={() => {
                setEditingVocabId(null);
                setWord("");
                setReading("");
                setMeaning("");
                setHanViet("");
                setImageUrl("");
                setExampleSentence("");
                setExampleTranslation("");
                setVocabFolderId(selectedFolderId !== "all" && selectedFolderId !== "fav" ? selectedFolderId : "");
                setShowModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-black shadow-md shadow-orange-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Thêm Từ Vựng
            </button>
          </div>
        </div>

        {/* ─── FOLDERS & COLLECTIONS HORIZONTAL BAR ─────────────────────────── */}
        <div className="flex flex-col gap-2 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-orange-500" />
              Thư Mục & Bộ Sưu Tập Từ Vựng:
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {folders.length} thư mục người dùng
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {/* All Words Button */}
            <button
              onClick={() => setSelectedFolderId("all")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedFolderId === "all"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Tất Cả ({vocabList.length})</span>
            </button>

            {/* Favorite Words Button */}
            <button
              onClick={() => setSelectedFolderId("fav")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border ${
                selectedFolderId === "fav"
                  ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Yêu Thích ({vocabList.filter((v) => isVocabFavorite(v.id)).length})</span>
            </button>

            {/* User Folders */}
            {folders.map((f) => {
              const count = vocabList.filter((v) => getItemFolderId(v) === f.id).length;
              const isSelected = selectedFolderId === f.id;

              return (
                <div
                  key={f.id}
                  className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border ${
                    isSelected
                      ? "bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/40 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-orange-400"
                  }`}
                >
                  <button onClick={() => setSelectedFolderId(f.id)} className="flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-orange-500" />
                    <span>{f.name}</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-slate-200/80 dark:bg-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                      {count}
                    </span>
                  </button>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 pl-1 border-l border-slate-200 dark:border-slate-700">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEditFolder(f); }}
                      className="p-0.5 text-slate-400 hover:text-indigo-500"
                      title="Sửa thư mục"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id, f.name); }}
                      className="p-0.5 text-slate-400 hover:text-rose-500"
                      title="Xóa thư mục"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Search & Level Filter Row ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-1.5 flex-wrap">
            {["", "N5", "N4", "N3", "N2", "N1"].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  selectedLevel === lvl
                    ? "bg-orange-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {lvl === "" ? "Tất Cả Cấp Độ" : lvl}
              </button>
            ))}
          </div>

          <div className="relative min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo từ, cách đọc, nghĩa..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>
        </div>

        {/* ─── Vocabulary Table ───────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              Đang tải danh sách từ vựng...
            </div>
          ) : filteredVocabList.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Không tìm thấy từ vựng nào trong thư mục / bộ lọc này. Bấm &ldquo;Thêm Từ Vựng Mới&rdquo; hoặc chọn thư mục khác!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Yêu Thích</th>
                    <th className="p-3.5">Từ Vựng & Phát Âm</th>
                    <th className="p-3.5">Cách Đọc & Hán Việt</th>
                    <th className="p-3.5">Thư Mục / Chủ Đề</th>
                    <th className="p-3.5">Hình Ảnh</th>
                    <th className="p-3.5">Ý Nghĩa</th>
                    <th className="p-3.5">Loại Từ</th>
                    <th className="p-3.5">Cấp Độ</th>
                    <th className="p-3.5">Ví Dụ</th>
                    <th className="p-3.5 text-right">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredVocabList.map((item) => {
                    let parsedMeta: VocabMetadata = {};
                    if (item.tagsJson) {
                      try {
                        parsedMeta = JSON.parse(item.tagsJson) as VocabMetadata;
                      } catch {}
                    }
                    const isFav = isVocabFavorite(item.id);
                    const folderObj = folders.find((f) => f.id === parsedMeta.folderId);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        {/* Favorite Star */}
                        <td className="p-3.5">
                          <button
                            onClick={() => toggleVocabFavorite(item.id)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              isFav
                                ? "bg-amber-500/20 border-amber-500/40 text-amber-500"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 hover:text-amber-500"
                            }`}
                            title={isFav ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
                          >
                            <Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-500 text-amber-500" : ""}`} />
                          </button>
                        </td>

                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-base text-slate-900 dark:text-white">
                              {item.word}
                            </span>
                            <button
                              onClick={() => playJapaneseSpeech(item.reading || item.word)}
                              className="p-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors"
                              title="Nghe phát âm chuẩn"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                            {/* Kanji Practice Button */}
                            {item.word.match(/[\u4e00-\u9faf]/) && (
                              <button
                                onClick={() => setPracticeKanji(item.word.match(/[\u4e00-\u9faf]/)![0])}
                                className="p-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 transition-colors"
                                title="Tập viết chữ Hán"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="flex flex-col">
                            <span className="text-orange-600 dark:text-orange-400 font-bold">{item.reading}</span>
                            {parsedMeta.hanViet && (
                              <span className="text-[10px] text-slate-400 uppercase font-extrabold">{parsedMeta.hanViet}</span>
                            )}
                          </div>
                        </td>

                        {/* Folder Tag */}
                        <td className="p-3.5">
                          {folderObj ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-500/20">
                              <Folder className="w-3 h-3" />
                              {folderObj.name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Chung</span>
                          )}
                        </td>

                        <td className="p-3.5">
                          {parsedMeta.imageUrl ? (
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs">
                              <img src={parsedMeta.imageUrl} alt={item.word} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>

                        <td className="p-3.5 text-slate-700 dark:text-slate-200 font-semibold">{item.meaning}</td>

                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                            {item.partOfSpeech}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[10px]">
                            {item.jlptLevel}
                          </span>
                        </td>

                        <td className="p-3.5 max-w-[180px]">
                          {item.exampleSentence ? (
                            <div>
                              <p className="text-slate-800 dark:text-slate-200 truncate">{item.exampleSentence}</p>
                              {item.exampleSentenceTranslation && (
                                <p className="text-[10px] text-slate-400 italic truncate">{item.exampleSentenceTranslation}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                              title="Chỉnh sửa từ vựng"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteVocab(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                              title="Xóa từ vựng"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ════════════════════════════ MODALS ══════════════════════════════════ */}

      {/* Single Add / Edit Vocabulary Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-lg w-full flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-orange-500" />
                {editingVocabId ? "Chỉnh Sửa Từ Vựng" : "Thêm Từ Vựng Mới"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Từ vựng (Kanji / Kana) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder="e.g. 先生"
                  autoFocus
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Cách đọc (Furigana) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={reading}
                  onChange={(e) => setReading(e.target.value)}
                  placeholder="e.g. せんせい"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Hán Việt
                </label>
                <input
                  type="text"
                  value={hanViet}
                  onChange={(e) => setHanViet(e.target.value)}
                  placeholder="e.g. TIÊN SINH"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-orange-500/50 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Ý nghĩa tiếng Việt <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder="e.g. Thầy cô giáo"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Folder Selection */}
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-indigo-500" />
                Thư Mục / Chủ Đề (Tùy chọn)
              </label>
              <select
                value={vocabFolderId}
                onChange={(e) => setVocabFolderId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none font-medium"
              >
                <option value="">-- Không xếp vào thư mục nào (Chung) --</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Image URL Field (Anki-style) */}
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-orange-500" />
                Link Hình Ảnh Minh Họa (Anki Image URL)
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Dán link ảnh online (VD: https://images.unsplash.com/...)"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
              />
              {imageUrl && (
                <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Loại từ
                </label>
                <select
                  value={partOfSpeech}
                  onChange={(e) => setPartOfSpeech(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none font-medium"
                >
                  <option value="Danh từ">Danh từ (Noun)</option>
                  <option value="Động từ">Động từ (Verb)</option>
                  <option value="Tính từ -i">Tính từ -i (i-Adjective)</option>
                  <option value="Tính từ -na">Tính từ -na (na-Adjective)</option>
                  <option value="Phó từ">Phó từ (Adverb)</option>
                  <option value="Trợ từ">Trợ từ (Particle)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Cấp độ JLPT
                </label>
                <select
                  value={jlptLevel}
                  onChange={(e) => setJlptLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none font-bold"
                >
                  <option value="N5">JLPT N5</option>
                  <option value="N4">JLPT N4</option>
                  <option value="N3">JLPT N3</option>
                  <option value="N2">JLPT N2</option>
                  <option value="N1">JLPT N1</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Câu ví dụ tiếng Nhật
              </label>
              <input
                type="text"
                value={exampleSentence}
                onChange={(e) => setExampleSentence(e.target.value)}
                placeholder="e.g. 田中先生は日本語を教えます。"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Dịch câu ví dụ
              </label>
              <input
                type="text"
                value={exampleTranslation}
                onChange={(e) => setExampleTranslation(e.target.value)}
                placeholder="e.g. Thầy Tanaka dạy tiếng Nhật."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Gắn với bài học (Tùy chọn)
              </label>
              <select
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
              >
                <option value="">-- Không gắn bài học nào --</option>
                {allLessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveVocab}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors"
              >
                {editingVocabId ? "Lưu Cập Nhật" : "Lưu Từ Vựng"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create / Edit Folder Modal ────────────────────────────────────── */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-indigo-500" />
                {editingFolderId ? "Chỉnh Sửa Thư Mục" : "Tạo Thư Mục / Chủ Đề Mới"}
              </h3>
              <button
                onClick={() => setShowFolderModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Tên Thư Mục / Chủ Đề <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={folderNameInput}
                onChange={(e) => setFolderNameInput(e.target.value)}
                placeholder="e.g. Minna no Nihongo Bài 1 - 5, Du Lịch, IT..."
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Mô tả (Tùy chọn)
              </label>
              <input
                type="text"
                value={folderDescInput}
                onChange={(e) => setFolderDescInput(e.target.value)}
                placeholder="Mục đích lưu trữ hoặc ghi chú..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveFolder}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
              >
                {editingFolderId ? "Cập Nhật Thư Mục" : "Tạo Thư Mục"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Batch Import Modal ────────────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-2xl w-full flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Import Từ Vựng Hàng Loạt (CSV / Excel / Anki)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Hỗ trợ đầy đủ các trường: Từ vựng, Furigana, Hán Việt, Nghĩa, Loại từ, Cấp độ, Ví dụ & Link Ảnh minh họa.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download & File Upload Buttons */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">1. Tải file mẫu CSV</span>
                <span className="text-[11px] text-slate-400">Xem cấu trúc mẫu đầy đủ để copy dán nhanh</span>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-orange-500 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-orange-500" />
                Tải File Mẫu .CSV
              </button>
            </div>

            {/* Folder selection for batch import */}
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-indigo-500" />
                Gán toàn bộ danh sách import vào thư mục (Tùy chọn):
              </label>
              <select
                value={importFolderId}
                onChange={(e) => setImportFolderId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium focus:outline-none"
              >
                <option value="">-- Không gán (Chung) --</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Textarea or Upload */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  2. Dán nội dung text hoặc chọn file CSV từ máy tính:
                </label>
                <label className="cursor-pointer flex items-center gap-1 text-xs font-bold text-orange-600 hover:underline">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn File .CSV</span>
                  <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <textarea
                rows={6}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  parseImportData(e.target.value, importDelimiter);
                }}
                placeholder="先生;せんせい;TIÊN SINH;Thầy giáo;Danh từ;N5;田中先生...;Thầy Tanaka...;https://...&#10;学生;がくせい;HỌC SINH;Học sinh;Danh từ;N5"
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {/* Preview Parsed Items */}
            {parsedImportList.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Đã nhận diện: {parsedImportList.filter((x) => x.isValid).length} / {parsedImportList.length} dòng từ vựng hợp lệ
                </span>

                <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {parsedImportList.map((item, idx) => (
                    <div key={idx} className="p-2 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/40">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 dark:text-white">{item.word}</span>
                        <span className="text-orange-500 font-bold">{item.reading}</span>
                        {item.hanViet && <span className="text-[10px] text-indigo-400 uppercase font-mono">({item.hanViet})</span>}
                        <span className="text-slate-600 dark:text-slate-300 truncate max-w-[200px]">: {item.meaning}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 text-[10px] font-bold shrink-0">
                        {item.jlptLevel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isImporting || parsedImportList.filter((x) => x.isValid).length === 0}
                onClick={handleExecuteBatchImport}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-500/20"
              >
                {isImporting ? `Đang nạp ${importProgress.current}/${importProgress.total}...` : `Nạp ${parsedImportList.filter((x) => x.isValid).length} Từ Vựng`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Kanji Canvas Practice Modal ───────────────────────────────────── */}
      {practiceKanji && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-sm w-full flex flex-col items-center gap-4 shadow-2xl">
            <div className="w-full flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Tập Viết Chữ Hán: <span className="text-orange-500 text-lg">{practiceKanji}</span>
                </h3>
              </div>
              <button onClick={() => setPracticeKanji(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 shadow-inner flex flex-col items-center">
              <KanjiCanvas kanji={practiceKanji} size={220} />
            </div>

            <button
              onClick={() => setPracticeKanji(null)}
              className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md"
            >
              Đóng Bảng Tập Viết
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
