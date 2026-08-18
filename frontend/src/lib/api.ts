
const rawBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5222").replace(/\/+$/, "");
const API_BASE = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

export interface DriveNode {
  id: string;
  driveFileId: string;
  parentDriveFileId?: string;
  parentNodeId?: string;
  name: string;
  nodeType: number; // 0: Folder, 1: File
  mimeType: string;
  fileExtension?: string;
  size?: number;
  webViewLink?: string;
  thumbnailLink?: string;
  rawPath: string;
  isDeletedInDrive: boolean;
}

export interface Resource {
  id: string;
  lessonId: string;
  title: string;
  resourceType: number; // 0: PrimaryVideo, 1: Audio, 2: ExercisePdf, 3: Document, 4: Image, 5: Other
  driveNodeId?: string;
  driveFileId?: string;
  webViewLink?: string;
  customUrl?: string;
  displayOrder: number;
}

export interface Lesson {
  id: string;
  sectionId: string;
  title: string;
  description?: string;
  displayOrder: number;
  estimatedDurationMinutes?: number;
  isPublished: boolean;
  resources: Resource[];
  quizzes?: {
    id: string;
    title: string;
    quizType: number;
    passPercentage: number;
    questionCount: number;
  }[];
}

export interface Section {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  displayOrder: number;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description?: string;
  jlptLevel: string;
  displayOrder: number;
  isPublished: boolean;
  sections: Section[];
}

export interface VocabularyEntry {
  id: string;
  lessonId?: string;
  lessonTitle?: string;
  word: string;
  reading: string;
  meaning: string;
  exampleSentence?: string;
  exampleSentenceTranslation?: string;
  partOfSpeech: string;
  jlptLevel: string;
  audioDriveNodeId?: string;
  audioDriveFileId?: string;
  strokeOrderDriveNodeId?: string;
  strokeOrderDriveFileId?: string;
  tagsJson?: string;
  createdAtUtc: string;
}

export interface SrsDueItem {
  scheduleId: string;
  vocabulary: VocabularyEntry;
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
}

export interface LessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  isCompleted: boolean;
  isQuizPassed: boolean;
  isManuallyCompleted: boolean;
  lastPlaybackPositionSeconds?: number;
  totalDurationSeconds?: number;
  completedAtUtc?: string;
  lastAccessedAtUtc: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionType: number; // 0..7
  prompt: string;
  audioDriveNodeId?: string;
  audioDriveFileId?: string;
  imageDriveNodeId?: string;
  imageDriveFileId?: string;
  points: number;
  displayOrder: number;
  payloadJson: string;
}

export interface Quiz {
  id: string;
  lessonId?: string;
  lessonTitle?: string;
  title: string;
  description?: string;
  quizType: number; // 0: LessonQuiz, 1: GlobalReviewQuiz, 2: PracticeTest
  passPercentage: number;
  timeLimitMinutes?: number;
  shuffleQuestions: boolean;
  questions: QuizQuestion[];
}

export interface AutoSuggestRequest {
  parentFolderDriveNodeId: string;
  patternRegex: string;
  targetSectionId: string;
}

export interface SuggestedResource {
  resourceTitle: string;
  driveNodeId: string;
  fileName: string;
  resourceType: number;
}

export interface SuggestedLesson {
  lessonTitle: string;
  lessonNumber: number;
  folderDriveNodeId: string;
  folderName: string;
  resources: SuggestedResource[];
}

export interface AutoSuggestResult {
  targetSectionId: string;
  matchesFound: number;
  suggestedLessons: SuggestedLesson[];
}

export interface MultipleChoicePayload {
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  audioUrl?: string;
  imageUrl?: string;
}

export interface FillBlankPayload {
  acceptableAnswers?: string[];
  explanation?: string;
}

export interface TokenArrangePayload {
  tokens?: string[];
  correctOrder?: number[];
  explanation?: string;
}

export interface MatchingPairsPayload {
  pairs?: { left: string; right: string }[];
  explanation?: string;
}

export interface QuizQuestionPayload {
  options?: string[];
  correctIndex?: number;
  acceptableAnswers?: string[];
  tokens?: string[];
  pairs?: { left: string; right: string }[];
  leftItems?: string[];
  rightItems?: string[];
  audioUrl?: string;
  imageUrl?: string;
  explanation?: string;
}

export interface QuestionGradeResult {
  questionId: string;
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  feedback?: string;
  correctAnswerExplanation?: string;
}

export interface QuizSubmissionResult {
  quizId: string;
  score: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean;
  questionResults: QuestionGradeResult[];
}

export interface QuestionResultItem {
  questionId: string;
  prompt: string;
  questionType: number;
  payload: QuizQuestionPayload;
  userAnswer?: string;
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  explanation?: string;
}

export interface ReportCardData {
  score: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean;
  passPercentage: number;
  questionResults: QuestionResultItem[];
  isTimeout?: boolean;
}

export interface DriveSyncResult {
  nodesAdded?: number;
  nodesUpdated?: number;
  errors?: string[];
  message?: string;
}

// Global server connection state tracking
export let isBackendConnected = false;

export const isGuid = (val?: string | null): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
};

async function safeFetch<T>(url: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    isBackendConnected = true;

    // Xử lý status 204 No Content hoặc response không có nội dung
    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return (fallback !== undefined ? fallback : { success: true }) as T;
    }

    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ((fallback !== undefined ? fallback : { success: true }) as T);
  } catch (err) {
    // Only log if fallback is not provided or in development mode
    if (fallback === undefined) {
      console.warn(`[DriveLearn API Warning] Fetch failed for ${url}:`, err);
    }
    isBackendConnected = false;
    if (fallback !== undefined) {
      return fallback;
    }
    throw err;
  }
}
// Rich Local Fallback Data (Prep / Riki Japanese Course Decks)
const FALLBACK_COURSES: Course[] = [
  {
    id: "course-n5",
    title: "Tiếng Nhật N5 - Sơ Cấp (Minna no Nihongo)",
    slug: "n5-so-cap",
    description: "Khóa học N5 toàn diện thiết kế theo phong cách Prep / Riki với hơn 50 bài học từ vựng, ngữ pháp, chữ Hán Kanji và luyện nghe bài bản.",
    jlptLevel: "N5",
    displayOrder: 1,
    isPublished: true,
    sections: [
      {
        id: "sec-1",
        courseId: "course-n5",
        title: "Chặng 1: Nhập Môn & Chữ Cái (Bài 01 - 05)",
        description: "Bảng chữ cái Hiragana, Katakana và ngữ pháp chào hỏi cơ bản.",
        displayOrder: 1,
        lessons: [
          {
            id: "les-1",
            sectionId: "sec-1",
            title: "Bài 01: Giới thiệu bản thân & Danh từ N1 は N2 です",
            description: "Học cách tự giới thiệu tên, quốc tịch, nghề nghiệp với mẫu câu N1 は N2 です và câu hỏi か.",
            displayOrder: 1,
            estimatedDurationMinutes: 45,
            isPublished: true,
            resources: [
              {
                id: "res-1-v",
                lessonId: "les-1",
                title: "Bài Giảng Video Bài 01 - Thầy Riki",
                resourceType: 0,
                customUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
                displayOrder: 1,
              },
              {
                id: "res-1-a",
                lessonId: "les-1",
                title: "Luyện Nghe Audio Kaiwa Bài 01",
                resourceType: 1,
                customUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
                displayOrder: 2,
              },
              {
                id: "res-1-p",
                lessonId: "les-1",
                title: "Bài Tập Thực Hành PDF Bài 01",
                resourceType: 2,
                displayOrder: 3,
              },
            ],
          },
          {
            id: "les-2",
            sectionId: "sec-1",
            title: "Bài 02: Chỉ thị từ これ / それ / あれ (Chỉ vật)",
            description: "Cách sử dụng chỉ thị từ xác định vị trí đồ vật và sở hữu từ の.",
            displayOrder: 2,
            estimatedDurationMinutes: 40,
            isPublished: true,
            resources: [],
          },
          {
            id: "les-3",
            sectionId: "sec-1",
            title: "Bài 03: Chỉ thị vị trí ここ / そこ / あそこ",
            description: "Hỏi và chỉ địa điểm, nhà hàng, công ty, tầng 1 2 3.",
            displayOrder: 3,
            estimatedDurationMinutes: 50,
            isPublished: true,
            resources: [],
          },
        ],
      },
      {
        id: "sec-2",
        courseId: "course-n5",
        title: "Chặng 2: Động Từ & Thời Gian (Bài 06 - 10)",
        description: "Thời gian, ngày tháng, động từ thì hiện tại/quá khứ ます / ました.",
        displayOrder: 2,
        lessons: [
          {
            id: "les-4",
            sectionId: "sec-2",
            title: "Bài 04: Thời gian, Giờ giấc & Động từ 行きます / 来ます",
            description: "Học cách nói giờ, phút và động từ di chuyển với trợ từ へ.",
            displayOrder: 1,
            estimatedDurationMinutes: 45,
            isPublished: true,
            resources: [],
          },
        ],
      },
    ],
  },
  {
    id: "course-n4",
    title: "Tiếng Nhật N4 - Trung Cấp Minna II",
    slug: "n4-trung-cap",
    description: "Khóa học N4 nâng cao chuẩn bị cho kỳ thi JLPT N4 với cấu trúc thể て, thể た và thể ない.",
    jlptLevel: "N4",
    displayOrder: 2,
    isPublished: true,
    sections: [],
  },
];

const FALLBACK_VOCABULARY: VocabularyEntry[] = [
  {
    id: "vocab-1",
    lessonId: "les-1",
    lessonTitle: "Bài 01",
    word: "私",
    reading: "わたし",
    meaning: "Tôi / Bản thân tôi (Ngôi thứ nhất)",
    exampleSentence: "わたしはマイク・ミラーです。",
    exampleSentenceTranslation: "Tôi là Mike Miller.",
    partOfSpeech: "Danh từ",
    jlptLevel: "N5",
    createdAtUtc: new Date().toISOString(),
  },
  {
    id: "vocab-2",
    lessonId: "les-1",
    lessonTitle: "Bài 01",
    word: "あなた",
    reading: "あなた",
    meaning: "Bạn / Anh / Chị (Ngôi thứ hai)",
    exampleSentence: "あなたは学生ですか。",
    exampleSentenceTranslation: "Bạn có phải là sinh viên không?",
    partOfSpeech: "Danh từ",
    jlptLevel: "N5",
    createdAtUtc: new Date().toISOString(),
  },
  {
    id: "vocab-3",
    lessonId: "les-1",
    lessonTitle: "Bài 01",
    word: "学生",
    reading: "がくせい",
    meaning: "Học sinh / Sinh viên",
    exampleSentence: "あの人は学生です。",
    exampleSentenceTranslation: "Người kia là sinh viên.",
    partOfSpeech: "Danh từ",
    jlptLevel: "N5",
    createdAtUtc: new Date().toISOString(),
  },
  {
    id: "vocab-4",
    lessonId: "les-1",
    lessonTitle: "Bài 01",
    word: "先生",
    reading: "せんせい",
    meaning: "Thầy giáo / Cô giáo / Bác sĩ",
    exampleSentence: "たなか先生は日本語の先生です。",
    exampleSentenceTranslation: "Thầy Tanaka là giáo viên tiếng Nhật.",
    partOfSpeech: "Danh từ",
    jlptLevel: "N5",
    createdAtUtc: new Date().toISOString(),
  },
  {
    id: "vocab-5",
    lessonId: "les-1",
    lessonTitle: "Bài 01",
    word: "会社員",
    reading: "かいしゃいん",
    meaning: "Nhân viên công ty",
    exampleSentence: "父は会社員です。",
    exampleSentenceTranslation: "Bố tôi là nhân viên công ty.",
    partOfSpeech: "Danh từ",
    jlptLevel: "N5",
    createdAtUtc: new Date().toISOString(),
  },
];

const FALLBACK_QUIZZES: Quiz[] = [
  {
    id: "mock-jlpt-n5",
    title: "Đề Thi Thử JLPT N5 — Đề Số 01 (Chuẩn 2026)",
    description: "Bộ đề thi thử chuẩn JLPT N5 gồm 3 phần thi: Chữ Hán - Từ vựng (文字・語彙), Ngữ pháp - Đọc hiểu (文法・読解), và Nghe hiểu (聴解).",
    quizType: 2, // PracticeTest
    passPercentage: 60,
    timeLimitMinutes: 105,
    shuffleQuestions: false,
    questions: [
      {
        id: "n5-q1",
        quizId: "mock-jlpt-n5",
        questionType: 0,
        prompt: "【文字・語彙】「先生」の読み方はどれですか。",
        points: 2,
        displayOrder: 1,
        payloadJson: JSON.stringify({
          options: ["せんせい", "がくせい", "いしゃ", "かいしゃいん"],
          correctIndex: 0,
          explanation: "「先生」は「せんせい」と読みます。意味は Thầy cô giáo.",
        }),
      },
      {
        id: "n5-q2",
        quizId: "mock-jlpt-n5",
        questionType: 0,
        prompt: "【文字・語彙】「わたしは まいにち 日本語を _____。」に当てはまるものは？",
        points: 2,
        displayOrder: 2,
        payloadJson: JSON.stringify({
          options: ["べんきょうします", "たべます", "のみます", "ねます"],
          correctIndex: 0,
          explanation: "日本語を勉強します nghĩa là 'Học tiếng Nhật'.",
        }),
      },
      {
        id: "n5-q3",
        quizId: "mock-jlpt-n5",
        questionType: 0,
        prompt: "【文法】田中さん _____ どこに行きますか。",
        points: 2,
        displayOrder: 3,
        payloadJson: JSON.stringify({
          options: ["は", "が", "を", "に"],
          correctIndex: 0,
          explanation: "は (wa) làm trợ từ chỉ chủ đề câu hỏi.",
        }),
      },
      {
        id: "n5-q4",
        quizId: "mock-jlpt-n5",
        questionType: 2,
        prompt: "【文法 - Điền từ】日曜日 (にちようび) に 友だち _____ 会います。(Điền trợ từ đúng)",
        points: 2,
        displayOrder: 4,
        payloadJson: JSON.stringify({
          acceptableAnswers: ["に", "ni", "と", "to"],
          explanation: "Gặp ai đó dùng trợ từ に (hoặc と khi cùng làm hành động): 友だちに会います.",
        }),
      },
      {
        id: "n5-q5",
        quizId: "mock-jlpt-n5",
        questionType: 0,
        prompt: "【読解】「木村さんは 毎朝 7時に 起きます。シャワーを 浴びて、パンを 食べてから 会社へ 行きます。」— 木村さんは 朝 何時に 起きますか。",
        points: 3,
        displayOrder: 5,
        payloadJson: JSON.stringify({
          options: ["7時", "6時", "8時", "7時半"],
          correctIndex: 0,
          explanation: "Câu đầu tiên nêu rõ: '木村さんは 毎朝 7時に 起きます' (7 giờ).",
        }),
      },
      {
        id: "n5-q6",
        quizId: "mock-jlpt-n5",
        questionType: 6, // Listening
        prompt: "【聴解 - Nghe hiểu】男の人と女の人が話しています。男の人は何を買いますか？",
        points: 3,
        displayOrder: 6,
        payloadJson: JSON.stringify({
          options: ["お茶 (Trà xanh)", "コーヒー (Cà phê)", "水 (Nước lọc)", "ジュース (Nước ép)"],
          correctIndex: 1,
          explanation: "Trong đoạn đối thoại: 男『私はコーヒーにします』-> Người nam chọn Cà phê.",
        }),
      },
    ],
  },
  {
    id: "mock-jlpt-n4",
    title: "Đề Thi Thử JLPT N4 — Đề Số 01",
    description: "Đề thi thử JLPT N4 cấu trúc hoàn chỉnh kiểm tra thể て, thể た, câu bị động/sai khiến cơ bản và đọc hiểu đoạn văn ngắn.",
    quizType: 2,
    passPercentage: 60,
    timeLimitMinutes: 115,
    shuffleQuestions: false,
    questions: [
      {
        id: "n4-q1",
        quizId: "mock-jlpt-n4",
        questionType: 0,
        prompt: "【文字・語彙】「注意」の正しい読み方はどれですか。",
        points: 2,
        displayOrder: 1,
        payloadJson: JSON.stringify({
          options: ["ちゅうい", "じゅうい", "ちゅうじ", "しゅうい"],
          correctIndex: 0,
          explanation: "注意 đọc là ちゅうい (chú ý, cẩn thận).",
        }),
      },
      {
        id: "n4-q2",
        quizId: "mock-jlpt-n4",
        questionType: 0,
        prompt: "【文法】窓を _____ まま、寝てしまいました。",
        points: 2,
        displayOrder: 2,
        payloadJson: JSON.stringify({
          options: ["開けた", "開ける", "開けて", "開け"],
          correctIndex: 0,
          explanation: "Mẫu câu V-た + まま: Giữ nguyên trạng thái để mở cửa sổ mà ngủ quên.",
        }),
      },
      {
        id: "n4-q3",
        quizId: "mock-jlpt-n4",
        questionType: 0,
        prompt: "【文法】この荷物は 重すぎて、一人では _____ そうにありません。",
        points: 2,
        displayOrder: 3,
        payloadJson: JSON.stringify({
          options: ["運べ", "運ぶ", "運んだ", "運ば"],
          correctIndex: 0,
          explanation: "V thể khả năng bỏ ます + そうにない: 運べそうにありません (dường như không thể mang nổi).",
        }),
      },
    ],
  },
  {
    id: "mock-jlpt-n3",
    title: "Đề Thi Thử JLPT N3 — Trung Cấp Toàn Diện",
    description: "Kiểm tra ngữ pháp N3 (わけではない, に違いない, ようにする, について), chữ Hán cao cấp và đọc hiểu đoạn văn trung cấp.",
    quizType: 2,
    passPercentage: 65,
    timeLimitMinutes: 140,
    shuffleQuestions: false,
    questions: [
      {
        id: "n3-q1",
        quizId: "mock-jlpt-n3",
        questionType: 0,
        prompt: "【文字・語彙】「改善」の同義語として最も適切なものはどれですか。",
        points: 2,
        displayOrder: 1,
        payloadJson: JSON.stringify({
          options: ["より良く改めること", "完全に壊すこと", "そのままにすること", "元に戻すこと"],
          correctIndex: 0,
          explanation: "改善 (かいぜん) nghĩa là sửa đổi, cải tiến để tốt hơn.",
        }),
      },
      {
        id: "n3-q2",
        quizId: "mock-jlpt-n3",
        questionType: 0,
        prompt: "【文法】日本に住んでいるからといって、日本語がペラペラ話せる _____。",
        points: 2,
        displayOrder: 2,
        payloadJson: JSON.stringify({
          options: ["わけではない", "はずだ", "に違いない", "ばかりだ"],
          correctIndex: 0,
          explanation: "〜からといって…わけではない: Không phải cứ... thì đương nhiên là...",
        }),
      },
    ],
  },
  {
    id: "mock-jlpt-n2",
    title: "Đề Thi Thử JLPT N2 — Thượng Cấp Chuẩn",
    description: "Bộ đề N2 nâng cao: Ngữ pháp kính ngữ, thể sai khiến bị động phức hợp, đọc hiểu bình luận và nghe hiểu tốc độ cao.",
    quizType: 2,
    passPercentage: 65,
    timeLimitMinutes: 155,
    shuffleQuestions: false,
    questions: [
      {
        id: "n2-q1",
        quizId: "mock-jlpt-n2",
        questionType: 0,
        prompt: "【文法】長年の努力が実を結び、_____ 新薬の開発に成功した。",
        points: 2,
        displayOrder: 1,
        payloadJson: JSON.stringify({
          options: ["ついに", "めったに", "ろくに", "たいして"],
          correctIndex: 0,
          explanation: "ついに: Cuối cùng thì (sau nỗ lực lâu dài thành công).",
        }),
      },
    ],
  },
  {
    id: "mock-jlpt-n1",
    title: "Đề Thi Thử JLPT N1 — Cao Cấp Master",
    description: "Đề thi N1 chuyên sâu phục vụ học thuật, môi trường doanh nghiệp Nhật Bản và thi lấy chứng chỉ cấp độ cao nhất.",
    quizType: 2,
    passPercentage: 65,
    timeLimitMinutes: 170,
    shuffleQuestions: false,
    questions: [
      {
        id: "n1-q1",
        quizId: "mock-jlpt-n1",
        questionType: 0,
        prompt: "【文法】いかに困難であろうと、この計画を中止する _____ にはいかない。",
        points: 2,
        displayOrder: 1,
        payloadJson: JSON.stringify({
          options: ["わけ", "もの", "こと", "はず"],
          correctIndex: 0,
          explanation: "〜わけにはいかない: Không thể (vì lý do đạo đức/xã hội/trách nhiệm).",
        }),
      },
    ],
  },
  {
    id: "quiz-1",
    lessonId: "les-1",
    lessonTitle: "Bài 01",
    title: "Bài Kiểm Tra Từ Vựng & Ngữ Pháp Bài 01 (Minna N5)",
    description: "Đánh giá khả năng ghi nhớ từ vựng và cấu trúc N1 は N2 です.",
    quizType: 0,
    passPercentage: 70,
    timeLimitMinutes: 10,
    shuffleQuestions: true,
    questions: [
      {
        id: "q-1",
        quizId: "quiz-1",
        questionType: 0, // MultipleChoice
        prompt: "Ý nghĩa của từ 私 (わたし) trong tiếng Việt là gì?",
        points: 1,
        displayOrder: 1,
        payloadJson: JSON.stringify({
          options: ["Tôi / Bản thân tôi", "Bạn / Anh chị", "Thầy giáo", "Học sinh"],
          correctIndex: 0,
          explanation: "私 (わたし) có nghĩa là Tôi (ngôi thứ nhất số ít).",
        }),
      },
      {
        id: "q-2",
        quizId: "quiz-1",
        questionType: 2, // FillInTheBlank
        prompt: "Điền trợ từ thích hợp vào chỗ trống: わたし _____ マイク・ミラーです。",
        points: 1,
        displayOrder: 2,
        payloadJson: JSON.stringify({
          acceptableAnswers: ["は", "wa"],
          explanation: "Trợ từ は (đọc là wa) đứng sau chủ ngữ わたし.",
        }),
      },
      {
        id: "q-3",
        quizId: "quiz-1",
        questionType: 0,
        prompt: "Từ 学生 (がくせい) có nghĩa là gì?",
        points: 1,
        displayOrder: 3,
        payloadJson: JSON.stringify({
          options: ["Giáo viên", "Bác sĩ", "Học sinh / Sinh viên", "Kỹ sư"],
          correctIndex: 2,
          explanation: "学生 (がくせい) nghĩa là học sinh hoặc sinh viên.",
        }),
      },
    ],
  },
];

const FALLBACK_NODES: DriveNode[] = [
  {
    id: "node-root",
    driveFileId: "root_drive_folder",
    name: "Kho Khoá Học Tiếng Nhật N5-N1",
    nodeType: 0,
    mimeType: "application/vnd.google-apps.folder",
    rawPath: "/Kho Khoá Học Tiếng Nhật N5-N1",
    isDeletedInDrive: false,
  },
  {
    id: "node-n5",
    driveFileId: "folder_n5",
    parentDriveFileId: "root_drive_folder",
    parentNodeId: "node-root",
    name: "N5_Bài_Giảng",
    nodeType: 0,
    mimeType: "application/vnd.google-apps.folder",
    rawPath: "/Kho Khoá Học Tiếng Nhật N5-N1/N5_Bài_Giảng",
    isDeletedInDrive: false,
  },
  {
    id: "node-bai01",
    driveFileId: "folder_bai01",
    parentDriveFileId: "folder_n5",
    parentNodeId: "node-n5",
    name: "Bài 01",
    nodeType: 0,
    mimeType: "application/vnd.google-apps.folder",
    rawPath: "/Kho Khoá Học Tiếng Nhật N5-N1/N5_Bài_Giảng/Bài 01",
    isDeletedInDrive: false,
  },
  {
    id: "node-video01",
    driveFileId: "file_video01",
    parentDriveFileId: "folder_bai01",
    parentNodeId: "node-bai01",
    name: "Bài 01 - Video Ngữ Pháp.mp4",
    nodeType: 1,
    mimeType: "video/mp4",
    fileExtension: ".mp4",
    size: 245000000,
    webViewLink: "https://drive.google.com/file/d/demo/preview",
    rawPath: "/Kho Khoá Học Tiếng Nhật N5-N1/N5_Bài_Giảng/Bài 01/Bài 01 - Video Ngữ Pháp.mp4",
    isDeletedInDrive: false,
  },
];

// SRS Fallback for offline mode
const FALLBACK_SRS_DUE: SrsDueItem[] = [
  {
    scheduleId: "sch-1",
    vocabulary: FALLBACK_VOCABULARY[0],
    easeFactor: 2.5,
    intervalDays: 1,
    repetitionCount: 0,
    state: 0,
  },
  {
    scheduleId: "sch-2",
    vocabulary: FALLBACK_VOCABULARY[2],
    easeFactor: 2.5,
    intervalDays: 1,
    repetitionCount: 0,
    state: 0,
  },
  {
    scheduleId: "sch-3",
    vocabulary: FALLBACK_VOCABULARY[3],
    easeFactor: 2.5,
    intervalDays: 1,
    repetitionCount: 0,
    state: 0,
  },
];

export const api = {
  // Sync & Nodes
  async triggerDriveSync(rootFolderId?: string) {
    return safeFetch(
      `${API_BASE}/sync/drive`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootFolderId: rootFolderId || undefined }),
      },
      { message: "Synced mock drive data." }
    );
  },

  async getDriveNodes(parentDriveFileId?: string, search?: string) {
    return safeFetch<DriveNode[]>(
      `${API_BASE}/sync/nodes?${new URLSearchParams({
        ...(parentDriveFileId ? { parentDriveFileId } : {}),
        ...(search ? { search } : {}),
      }).toString()}`,
      undefined,
      FALLBACK_NODES
    );
  },

  // Courses & Curator
  async getCourses() {
    return safeFetch<Course[]>(`${API_BASE}/course`, undefined, FALLBACK_COURSES);
  },

  async createCourse(data: { title: string; slug?: string; description?: string; jlptLevel: string }) {
    return safeFetch<Course>(
      `${API_BASE}/course`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id: `course-${Date.now()}`,
        title: data.title,
        slug: data.slug || data.title.toLowerCase().replace(/\s+/g, "-"),
        description: data.description,
        jlptLevel: data.jlptLevel,
        displayOrder: 99,
        isPublished: true,
        sections: [],
      }
    );
  },

  async updateCourse(id: string, data: { title: string; slug?: string; description?: string; jlptLevel: string; displayOrder?: number }) {
    return safeFetch<Course>(
      `${API_BASE}/course/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id,
        title: data.title,
        slug: data.slug || data.title.toLowerCase().replace(/\s+/g, "-"),
        description: data.description,
        jlptLevel: data.jlptLevel,
        displayOrder: data.displayOrder || 0,
        isPublished: true,
        sections: [],
      }
    );
  },

  async createSection(data: { courseId: string; title: string; description?: string }) {
    return safeFetch<Section>(
      `${API_BASE}/course/sections`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id: `sec-${Date.now()}`,
        courseId: data.courseId,
        title: data.title,
        description: data.description,
        displayOrder: 99,
        lessons: [],
      }
    );
  },

  async updateSection(id: string, data: { title: string; description?: string; displayOrder?: number }) {
    return safeFetch<Section>(
      `${API_BASE}/course/sections/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id,
        courseId: "",
        title: data.title,
        description: data.description,
        displayOrder: data.displayOrder || 0,
        lessons: [],
      }
    );
  },

  async createLesson(data: { sectionId: string; title: string; description?: string }) {
    return safeFetch<Lesson>(
      `${API_BASE}/course/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id: `les-${Date.now()}`,
        sectionId: data.sectionId,
        title: data.title,
        description: data.description,
        displayOrder: 99,
        isPublished: true,
        resources: [],
      }
    );
  },

  async updateLesson(id: string, data: { title: string; description?: string; displayOrder?: number }) {
    return safeFetch<Lesson>(
      `${API_BASE}/course/lessons/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id,
        sectionId: "",
        title: data.title,
        description: data.description,
        displayOrder: data.displayOrder || 0,
        isPublished: true,
        resources: [],
      }
    );
  },

  async assignDriveNode(data: { lessonId: string; driveNodeId: string; title?: string; resourceType: number }) {
    return safeFetch<Resource>(
      `${API_BASE}/curator/assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id: `res-${Date.now()}`,
        lessonId: data.lessonId,
        title: data.title || "Assigned File",
        resourceType: data.resourceType,
        driveNodeId: data.driveNodeId,
        displayOrder: 1,
      }
    );
  },

  async removeResource(resourceId: string) {
    return safeFetch(`${API_BASE}/curator/resources/${resourceId}`, { method: "DELETE" }, { success: true });
  },

  // ─── Cascade Delete APIs ──────────────────────────────────────────────────
  async deleteCourse(id: string) {
    return safeFetch(`${API_BASE}/course/${id}`, { method: "DELETE" }, { success: true });
  },

  async deleteSection(id: string) {
    return safeFetch(`${API_BASE}/course/sections/${id}`, { method: "DELETE" }, { success: true });
  },

  async deleteLesson(id: string) {
    return safeFetch(`${API_BASE}/course/lessons/${id}`, { method: "DELETE" }, { success: true });
  },

  async analyzeAutoSuggest(data: AutoSuggestRequest) {
    return safeFetch<AutoSuggestResult>(
      `${API_BASE}/curator/auto-suggest/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        targetSectionId: data.targetSectionId,
        matchesFound: 1,
        suggestedLessons: [
          {
            lessonTitle: "Bài 01 - Tự Giới Thiệu (Auto Suggested)",
            lessonNumber: 1,
            folderDriveNodeId: data.parentFolderDriveNodeId,
            folderName: "Bài 01",
            resources: [
              {
                resourceTitle: "Bài 01 Video.mp4",
                driveNodeId: "file_video01",
                fileName: "Bài 01 Video.mp4",
                resourceType: 0,
              },
            ],
          },
        ],
      }
    );
  },

  async applyAutoSuggest(targetSectionId: string, selectedLessons: SuggestedLesson[]) {
    return safeFetch(
      `${API_BASE}/curator/auto-suggest/apply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSectionId, selectedLessons }),
      },
      { message: `Applied ${selectedLessons.length} lessons to section.` }
    );
  },

  // ─── Vocabulary APIs ──────────────────────────────────────────────────────
  // FIX: Filter logic separated — fallback filters locally, API returns server data
  async getVocabulary(lessonId?: string, jlptLevel?: string, search?: string) {
    // If lessonId is non-GUID mock ID (e.g. les-1), return fallback directly
    if (lessonId && !isGuid(lessonId)) {
      let filteredFallback = [...FALLBACK_VOCABULARY].filter((v) => v.lessonId === lessonId);
      if (jlptLevel) filteredFallback = filteredFallback.filter((v) => v.jlptLevel === jlptLevel);
      if (search)
        filteredFallback = filteredFallback.filter(
          (v) =>
            v.word.includes(search) || v.reading.includes(search) || v.meaning.toLowerCase().includes(search.toLowerCase())
        );
      return filteredFallback;
    }

    const params = new URLSearchParams({
      ...(lessonId ? { lessonId } : {}),
      ...(jlptLevel ? { jlptLevel } : {}),
      ...(search ? { search } : {}),
    });

    // Compute filtered fallback (only used if API fails)
    let filteredFallback = [...FALLBACK_VOCABULARY];
    if (lessonId) filteredFallback = filteredFallback.filter((v) => v.lessonId === lessonId);
    if (jlptLevel) filteredFallback = filteredFallback.filter((v) => v.jlptLevel === jlptLevel);
    if (search)
      filteredFallback = filteredFallback.filter(
        (v) =>
          v.word.includes(search) || v.reading.includes(search) || v.meaning.toLowerCase().includes(search.toLowerCase())
      );

    return safeFetch<VocabularyEntry[]>(`${API_BASE}/vocabulary?${params.toString()}`, undefined, filteredFallback);
  },

  async createVocabulary(data: Partial<VocabularyEntry>) {
    return safeFetch<VocabularyEntry>(
      `${API_BASE}/vocabulary`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id: `vocab-${Date.now()}`,
        word: data.word || "",
        reading: data.reading || "",
        meaning: data.meaning || "",
        exampleSentence: data.exampleSentence,
        exampleSentenceTranslation: data.exampleSentenceTranslation,
        partOfSpeech: data.partOfSpeech || "Danh từ",
        jlptLevel: data.jlptLevel || "N5",
        createdAtUtc: new Date().toISOString(),
      }
    );
  },

  async updateVocabulary(id: string, data: Partial<VocabularyEntry>) {
    return safeFetch<VocabularyEntry>(
      `${API_BASE}/vocabulary/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id,
        word: data.word || "",
        reading: data.reading || "",
        meaning: data.meaning || "",
        exampleSentence: data.exampleSentence,
        exampleSentenceTranslation: data.exampleSentenceTranslation,
        partOfSpeech: data.partOfSpeech || "Danh từ",
        jlptLevel: data.jlptLevel || "N5",
        createdAtUtc: new Date().toISOString(),
      }
    );
  },

  async deleteVocabulary(id: string) {
    return safeFetch(`${API_BASE}/vocabulary/${id}`, { method: "DELETE" }, { success: true });
  },

  // ─── SRS APIs ─────────────────────────────────────────────────────────────
  async getSrsDueCards(jlptLevel?: string): Promise<SrsDueItem[]> {
    const params = new URLSearchParams({ ...(jlptLevel ? { jlptLevel } : {}) });
    return safeFetch<SrsDueItem[]>(`${API_BASE}/srs/due?${params.toString()}`, undefined, FALLBACK_SRS_DUE);
  },

  async submitSrsReview(vocabularyEntryId: string, qualityRating: number) {
    return safeFetch(
      `${API_BASE}/srs/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabularyEntryId, qualityRating }),
      },
      { vocabularyEntryId, intervalDays: 1, easeFactor: 2.5 }
    );
  },

  async addVocabToSrsDeck(vocabularyEntryId: string) {
    // POST to add a vocab entry into the SRS pool (creates ReviewSchedule if not exists)
    return safeFetch(
      `${API_BASE}/srs/add`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabularyEntryId }),
      },
      { success: true, vocabularyEntryId }
    );
  },

  async getSrsStats() {
    return safeFetch(
      `${API_BASE}/srs/stats`,
      undefined,
      { dueToday: 3, newToday: 5, reviewedToday: 0, streak: 7 }
    );
  },

  // ─── Quiz Admin APIs ──────────────────────────────────────────────────────
  async getQuizzes(lessonId?: string) {
    return safeFetch<Quiz[]>(
      `${API_BASE}/quizadmin?${new URLSearchParams({ ...(lessonId ? { lessonId } : {}) }).toString()}`,
      undefined,
      FALLBACK_QUIZZES
    );
  },

  async createQuiz(data: Partial<Quiz>) {
    return safeFetch<Quiz>(
      `${API_BASE}/quizadmin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id: `quiz-${Date.now()}`,
        title: data.title || "Quiz Mới",
        description: data.description,
        quizType: data.quizType || 0,
        passPercentage: data.passPercentage || 70,
        shuffleQuestions: true,
        questions: [],
      }
    );
  },

  async updateQuiz(id: string, data: Partial<Quiz>) {
    return safeFetch<Quiz>(
      `${API_BASE}/quizadmin/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id,
        title: data.title || "",
        description: data.description,
        quizType: data.quizType || 0,
        passPercentage: data.passPercentage || 70,
        shuffleQuestions: true,
        questions: data.questions || [],
      }
    );
  },

  async createQuizQuestion(data: Partial<QuizQuestion>) {
    return safeFetch<QuizQuestion>(
      `${API_BASE}/quizadmin/questions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id: `q-${Date.now()}`,
        quizId: data.quizId || "",
        questionType: data.questionType || 0,
        prompt: data.prompt || "Câu hỏi mới",
        points: data.points || 1,
        displayOrder: 1,
        payloadJson: data.payloadJson || "{}",
      }
    );
  },

  async updateQuizQuestion(id: string, data: Partial<QuizQuestion>) {
    return safeFetch<QuizQuestion>(
      `${API_BASE}/quizadmin/questions/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      {
        id,
        quizId: data.quizId || "",
        questionType: data.questionType || 0,
        prompt: data.prompt || "",
        points: data.points || 1,
        displayOrder: data.displayOrder || 1,
        payloadJson: data.payloadJson || "{}",
      }
    );
  },

  async deleteQuizQuestion(id: string) {
    return safeFetch(`${API_BASE}/quizadmin/questions/${id}`, { method: "DELETE" }, { success: true });
  },

  async deleteQuiz(id: string) {
    return safeFetch(`${API_BASE}/quizadmin/${id}`, { method: "DELETE" }, { success: true });
  },

  // ─── Quiz Learner APIs ────────────────────────────────────────────────────
  async getQuizById(quizId: string) {
    return safeFetch<Quiz>(`${API_BASE}/quiz/${quizId}`, undefined, FALLBACK_QUIZZES[0]);
  },

  async submitQuizAttempt(quizId: string, answers: { questionId: string; answerJson: string }[]) {
    return safeFetch(
      `${API_BASE}/quiz/${quizId}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, answers }),
      },
      null // null fallback = use local grading
    );
  },

  // ─── Lesson Progress APIs ─────────────────────────────────────────────────
  async getLessonProgress(lessonId: string) {
    if (!isGuid(lessonId)) {
      return null;
    }
    return safeFetch<LessonProgress | null>(
      `${API_BASE}/progress/${lessonId}`,
      undefined,
      null
    );
  },

  async markLessonComplete(lessonId: string, isManual = true) {
    if (!isGuid(lessonId)) {
      return { success: true, lessonId };
    }
    return safeFetch(
      `${API_BASE}/progress/${lessonId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isManuallyCompleted: isManual }),
      },
      { success: true, lessonId }
    );
  },

  async savePlaybackPosition(data: { lessonId: string; positionSeconds: number; durationSeconds: number }) {
    if (!isGuid(data.lessonId)) {
      return { success: true, ...data };
    }
    return safeFetch(
      `${API_BASE}/progress/playback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      { success: true, ...data }
    );
  },

  // ─── Lesson Reordering & Quiz Assignment ─────────────────────────────────
  async reorderLessons(sectionId: string, lessonIds: string[]) {
    return safeFetch(
      `${API_BASE}/course/reorder-lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, lessonIds }),
      },
      { success: true }
    );
  },

  async assignQuizToLesson(quizId: string, lessonId?: string | null) {
    return safeFetch(
      `${API_BASE}/course/assign-quiz`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, lessonId: lessonId || null }),
      },
      { success: true }
    );
  },

  // ─── Auth APIs ────────────────────────────────────────────────────────────
  async getAuthStatus() {
    return safeFetch<{ isAuthenticated: boolean; expiresAtUtc?: string; scope?: string }>(
      `${API_BASE}/auth/status`,
      undefined,
      { isAuthenticated: false }
    );
  },
};
