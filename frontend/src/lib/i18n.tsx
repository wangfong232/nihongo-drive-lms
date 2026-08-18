"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "vi";

const translations = {
  en: {
    appTitle: "Nihongo LMS",
    navCourses: "Learner Portal",
    navAdmin: "Course Builder",
    navVocabulary: "Vocabulary",
    navKanji: "Kanji Hub",
    navQuizzes: "Quiz & Exams",
    navMockTest: "JLPT Practice",
    navSettings: "Settings & Sync",
    syncDrive: "Sync Drive Tree",
    syncing: "Syncing...",
    syncSuccess: "Drive Tree Synced",
    rawDriveTree: "Raw Google Drive Tree",
    searchNodes: "Search files & folders...",
    autoSuggestHelper: "Auto-Suggest Lessons",
    curatedCourses: "Curated Course Structure",
    addCourse: "Add Course",
    addSection: "Add Section",
    addLesson: "Add Lesson",
    assignToLesson: "Assign to Lesson",
    resourceVideo: "Video",
    resourceAudio: "Audio",
    resourcePdf: "PDF Exercise",
    resourceDoc: "Document",
    resourceImage: "Image",
    resourceOther: "Other File",
    applyPattern: "Analyze Pattern",
    suggestedMatches: "Suggested Lessons Found",
    applySelected: "Apply Selected Suggestions",
    jlptLevel: "JLPT Level",
    selectSection: "Select Target Section",
    cancel: "Cancel",
    confirm: "Confirm",
    patternPreset: "Pattern Preset",
    customRegex: "Custom Regex",
    noNodesFound: "No Drive nodes found. Make sure you synced your Drive tree.",
    noCoursesYet: "No curated courses created yet. Create a course to start mapping!",
    themeDark: "Dark Mode",
    themeLight: "Light Mode",
    // ─── Delete CRUD ──────────────────────────────────────────────────────
    deleteCourse: "Delete Course",
    deleteSection: "Delete Section",
    deleteLesson: "Delete Lesson",
    confirmDelete: "Confirm Deletion",
    deleteWarning: "This action is permanent and cannot be undone.",
    deleteCourseWarning: "Are you sure you want to delete the course",
    deleteCourseDetail: "All sections, lessons and resources will be permanently deleted.",
    deleteSectionWarning: "Are you sure you want to delete the section",
    deleteSectionDetail: "All lessons and resources inside this section will be permanently deleted.",
    deleteLessonWarning: "Are you sure you want to delete the lesson",
    deleteLessonDetail: "All resources attached to this lesson will be permanently deleted.",
    deleteConfirmButton: "Yes, Delete Permanently",
    // ─── Drag & Drop ──────────────────────────────────────────────────────
    dropFileHere: "Drop file here to assign",
    dragToAssign: "Drag files from Drive tree to assign",
    // ─── Kanji Canvas ─────────────────────────────────────────────────────
    kanjiSpeed: "Speed",
    kanjiStepNext: "Next Stroke",
    kanjiUndo: "Undo Stroke",
    kanjiToggleGuide: "Toggle Guide",
    kanjiClear: "Clear Canvas",
    kanjiViewMode: "View Mode",
    kanjiDrawMode: "Practice Mode",
  },
  vi: {
    appTitle: "Học Tiếng Nhật LMS",
    navCourses: "Học Viên",
    navAdmin: "CMS Khóa Học",
    navVocabulary: "Từ Vựng",
    navKanji: "Kho Chữ Hán",
    navQuizzes: "Bộ Đề & Quiz",
    navMockTest: "Luyện JLPT",
    navSettings: "Cài Đặt & Đồng Bộ",
    syncDrive: "Đồng Bộ Cây Drive",
    syncing: "Đang đồng bộ...",
    syncSuccess: "Đã Đồng Bộ Cây Drive",
    rawDriveTree: "Cây Thư Mục Google Drive Gốc",
    searchNodes: "Tìm kiếm tệp & thư mục...",
    autoSuggestHelper: "Tự Động Gợi Ý Bài Học",
    curatedCourses: "Cấu Trúc Khóa Học Đã Biên Soạn",
    addCourse: "Thêm Khóa Học",
    addSection: "Thêm Chặng / Mục",
    addLesson: "Thêm Bài Học",
    assignToLesson: "Gán Vào Bài Học",
    resourceVideo: "Bài Giảng Video",
    resourceAudio: "Tệp Âm Thanh",
    resourcePdf: "Bài Tập PDF",
    resourceDoc: "Tài Liệu",
    resourceImage: "Hình Ảnh",
    resourceOther: "Tệp Khác",
    applyPattern: "Phân Tích Mẫu Thư Mục",
    suggestedMatches: "Kết Quả Gợi Ý Tìm Thấy",
    applySelected: "Áp Dụng Các Gợi Ý Đã Chọn",
    jlptLevel: "Trình Độ JLPT",
    selectSection: "Chọn Chặng Đích",
    cancel: "Hủy Bỏ",
    confirm: "Xác Nhận",
    patternPreset: "Mẫu Định Dạng Có Sẵn",
    customRegex: "Regex Tùy Chỉnh",
    noNodesFound: "Chưa tìm thấy tệp/thư mục. Vui lòng bấm Đồng Bộ Drive.",
    noCoursesYet: "Chưa có khóa học nào được tạo. Hãy tạo khóa học mới để bắt đầu!",
    themeDark: "Chế Độ Tối",
    themeLight: "Chế Độ Sáng",
    // ─── Delete CRUD ──────────────────────────────────────────────────────
    deleteCourse: "Xóa Khóa Học",
    deleteSection: "Xóa Chặng",
    deleteLesson: "Xóa Bài Học",
    confirmDelete: "Xác Nhận Xóa",
    deleteWarning: "Hành động này không thể hoàn tác.",
    deleteCourseWarning: "Bạn có chắc chắn muốn xóa khóa học",
    deleteCourseDetail: "Toàn bộ chặng, bài học và tài nguyên con sẽ bị xóa vĩnh viễn.",
    deleteSectionWarning: "Bạn có chắc chắn muốn xóa chặng",
    deleteSectionDetail: "Toàn bộ bài học và tài nguyên trong chặng này sẽ bị xóa vĩnh viễn.",
    deleteLessonWarning: "Bạn có chắc chắn muốn xóa bài học",
    deleteLessonDetail: "Toàn bộ tài nguyên đính kèm bài học này sẽ bị xóa vĩnh viễn.",
    deleteConfirmButton: "Xóa Vĩnh Viễn",
    // ─── Drag & Drop ──────────────────────────────────────────────────────
    dropFileHere: "Thả tệp vào đây để gán",
    dragToAssign: "Kéo tệp từ cây Drive để gán vào bài học",
    // ─── Kanji Canvas ─────────────────────────────────────────────────────
    kanjiSpeed: "Tốc Độ",
    kanjiStepNext: "Nét Tiếp Theo",
    kanjiUndo: "Hoàn Tác Nét",
    kanjiToggleGuide: "Ẩn/Hiện Chữ Mẫu",
    kanjiClear: "Xóa Bảng",
    kanjiViewMode: "Chế Độ Xem",
    kanjiDrawMode: "Chế Độ Luyện Viết",
  },
};

interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: keyof typeof translations.en) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => translations.en[key] || key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("nihongo_lms_lang") as Language;
    if (saved === "en" || saved === "vi") setLangState(saved);
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("nihongo_lms_lang", l);
  };

  const t = (key: keyof typeof translations.en) => {
    return translations[lang]?.[key] || translations.en[key] || key;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
