# 🎌 DriveLearn - Nền Tảng Học Tiếng Nhật Toàn Diện

## 📚 Giới thiệu

**DriveLearn** là hệ thống quản lý học tập (LMS) hiện đại được thiết kế đặc biệt cho việc học tiếng Nhật (JLPT N5-N1), tích hợp hoàn toàn với **Google Drive** để quản lý tài nguyên học tập (video, audio, PDF) một cách linh hoạt và hiệu quả.

### ✨ Tính năng nổi bật

#### 🎓 Dành cho Học Viên (Learner)
- ✅ **Video Player HD**: Phát video bài giảng trực tiếp từ Google Drive với Theater Mode
- ✅ **Lưu Tiến Độ Tự Động**: Thoát giữa chừng vẫn nhớ vị trí xem của bạn
- ✅ **Flashcard SRS**: Hệ thống ôn tập ngắt quãng thông minh (Spaced Repetition)
- ✅ **Kanji Canvas**: Luyện viết chữ Hán với hiển thị thứ tự nét từ KanjiVG
- ✅ **Quiz System**: Bài tập tự luyện với nhiều dạng câu hỏi
- ✅ **Từ Vựng Tích Hợp**: Học từ vựng với furigana, ví dụ và âm thanh

#### 🛠️ Dành cho Giảng Viên (Admin/Curator)
- ✅ **Course Builder CMS**: Tạo và quản lý khóa học trực quan
- ✅ **Auto-Assign**: Gán hàng loạt bài học từ Google Drive tự động
- ✅ **Drive Sync**: Đồng bộ cây thư mục Drive theo thời gian thực
- ✅ **Drag & Drop**: Kéo thả file từ Drive vào bài học dễ dàng
- ✅ **Quiz Builder**: Tạo đề thi với 8+ loại câu hỏi
- ✅ **Vocabulary CMS**: Quản lý ngân hàng từ vựng theo JLPT level

---

## 🚀 Bắt Đầu Nhanh

### 1. Yêu cầu hệ thống
- **Backend**: .NET 10 / ASP.NET Core
- **Frontend**: Next.js 15.1.7 / React 19
- **Database**: PostgreSQL 15+
- **Storage**: Google Drive API access

### 2. Cài đặt Backend
```bash
cd src/NihongoLms.Api
dotnet restore
dotnet run
```

Backend sẽ chạy tại: `http://localhost:5222`

### 3. Cài đặt Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:3000`

### 4. Cấu hình Google OAuth
1. Tạo project tại [Google Cloud Console](https://console.cloud.google.com)
2. Enable **Google Drive API**
3. Tạo **OAuth 2.0 credentials** (Web Application)
4. Thêm **Authorized redirect URIs**: `http://localhost:5222/api/auth/google/callback`
5. Copy Client ID & Secret vào `appsettings.json`:

```json
{
  "GoogleOAuth": {
    "ClientId": "YOUR_CLIENT_ID",
    "ClientSecret": "YOUR_CLIENT_SECRET",
    "RedirectUri": "http://localhost:5222/api/auth/google/callback"
  }
}
```

### 5. Database Migration
```bash
cd src/NihongoLms.Api
dotnet ef database update
```

---

## 📖 Hướng Dẫn Sử Dụng

### 🎯 Dành cho Admin - Tạo Khóa Học

#### Bước 1: Kết nối Google Drive
1. Truy cập `/admin/builder`
2. Click nút **"Kết Nối Google OAuth"** ở góc trên bên phải
3. Đăng nhập Google và cấp quyền truy cập Drive
4. Sau khi thành công, badge sẽ hiển thị "Drive OAuth Connected" ✅

#### Bước 2: Đồng bộ thư mục Drive
1. Mở thư mục khóa học trên Google Drive
2. Copy **Folder ID** từ URL (ví dụ: `1A2B3C4D5E6F7G8H9I0J`)
3. Paste vào ô **"Root ID"** trong Builder
4. Click **"Sync Drive"** và chờ đồng bộ hoàn tất

#### Bước 3: Tạo cấu trúc khóa học
1. Click **"+ Thêm Khóa Học"** → Nhập tên và chọn level (N5-N1)
2. Click **"+ Thêm Chặng / Section"** → Nhập tên chương
3. Click **"+ Thêm Bài Học / Lesson"** → Nhập tên bài học

#### Bước 4: Gán tài nguyên
**Cách 1: Drag & Drop (Khuyên dùng)**
- Kéo file từ cột **"Raw Drive Tree"** (bên trái)
- Thả vào bài học ở cột **"Curated Courses"** (bên phải)
- File sẽ tự động được gán với đúng Resource Type

**Cách 2: Auto-Assign (Cho hàng loạt bài học)**
1. Hover chuột vào folder cha trong Drive Tree
2. Click icon **✨ "Auto Suggest"**
3. Cấu hình **Pattern Regex** (ví dụ: `^Bài \d+`)
4. Chọn **Target Section**
5. Click **"Analyze"** → Xem trước kết quả
6. Click **"Apply"** → Hệ thống tự tạo lessons + gán resources

📘 **Hướng dẫn chi tiết**: Xem file [`HUONG_DAN_AUTO_ASSIGN.md`](./HUONG_DAN_AUTO_ASSIGN.md)

#### Bước 5: Tạo từ vựng & quiz
1. Truy cập `/admin/vocabulary` → Tạo từ vựng cho từng bài học
2. Truy cập `/admin/quizzes` → Tạo đề kiểm tra
3. Gán quiz vào lesson tương ứng

---

### 🎓 Dành cho Học Viên - Học Bài

#### 1. Xem Bài Giảng
1. Truy cập trang chủ `/` → Chọn khóa học
2. Click vào bài học → Video tự động load
3. **Theater Mode**: Click nút "Bật Rạp Chiếu" để xem toàn màn hình
4. **Resume**: Nếu đã xem trước đó, modal sẽ hỏi "Tiếp tục xem từ phút XX:XX?"

📹 **Chi tiết về Video Progress**: Xem file [`VIDEO_PROGRESS_TRACKING.md`](./VIDEO_PROGRESS_TRACKING.md)

#### 2. Học Từ Vựng
1. Tab **"📚 Từ Vựng"** → Xem danh sách từ vựng của bài
2. Toggle **"Hiện/Ẩn Furigana"** để tự kiểm tra
3. Click icon **"+"** để thêm từ vào bộ thẻ SRS
4. Click icon **"🎌"** để xem Kanji Canvas (thứ tự nét viết)

#### 3. Luyện Nghe & Đọc Tài Liệu
1. Tab **"🎧 Luyện Nghe"** → Phát file audio
2. Tab **"📄 Tài Liệu"** → Mở PDF bài tập

#### 4. Làm Quiz
1. Tab **"✍️ Quiz"** → Click "Bắt Đầu Làm Bài"
2. Trả lời câu hỏi → Submit
3. Xem kết quả và giải thích chi tiết

#### 5. Ôn Tập SRS (Flashcard)
1. Truy cập `/srs` hoặc click "Ôn Tập SRS" trong sidebar
2. Hệ thống hiển thị từ vựng cần ôn hôm nay
3. Đánh giá độ khó (Again / Hard / Good / Easy)
4. Thuật toán SM-2 tự động lên lịch ôn tập tiếp theo

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 15)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Learner   │  │    Admin     │  │   SRS Flashcard  │   │
│  │  View (/)   │  │ Builder CMS  │  │   System (/srs)  │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▼ HTTP/REST API
┌─────────────────────────────────────────────────────────────┐
│                Backend (ASP.NET Core 10)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Course     │  │   Progress   │  │   SRS Scheduler  │  │
│  │  Controller  │  │  Controller  │  │   (SM-2 Algo)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Vocabulary  │  │     Quiz     │  │   Drive Sync     │  │
│  │  Controller  │  │  Controller  │  │   Controller     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ▼ EF Core ORM
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (Relational)                │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌────────────────┐   │
│  │ Courses │ │ Lessons │ │ Quizzes  │ │ LessonProgress │   │
│  └─────────┘ └─────────┘ └──────────┘ └────────────────┘   │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────────┐    │
│  │  Vocabulary  │ │ SrsSchedule │ │   DriveNodes     │    │
│  └──────────────┘ └─────────────┘ └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ▼ External API
┌─────────────────────────────────────────────────────────────┐
│                   Google Drive API v3                        │
│           (OAuth 2.0 + Files.list + Metadata)                │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema (Simplified)

```sql
-- Core Course Structure
Courses (id, title, slug, jlptLevel, isPublished)
  └─> Sections (id, courseId, title, displayOrder)
       └─> Lessons (id, sectionId, title, description, estimatedDurationMinutes)
            └─> Resources (id, lessonId, resourceType, driveFileId, customUrl)

-- Content Management
VocabularyEntries (id, lessonId, word, reading, meaning, jlptLevel, exampleSentence)
Quizzes (id, lessonId, title, quizType, passPercentage)
  └─> QuizQuestions (id, quizId, questionType, prompt, payloadJson)

-- User Progress
LessonProgresses (id, userId, lessonId, isCompleted, lastPlaybackPositionSeconds)
ReviewSchedules (id, userId, vocabularyEntryId, nextReviewDate, easeFactor, intervalDays)

-- Drive Integration
DriveNodes (id, driveFileId, parentDriveFileId, name, nodeType, mimeType, rawPath)
```

---

## 🔧 Các Vấn Đề Đã Khắc Phục

### ✅ Issue #1: UI Responsive - Bài 2+ không tương tác được
**Root cause**: Nested overflow issue, thiếu `min-h-0` trong flexbox
**Fix**: Thêm `min-h-0` và `max-h-[600px]` với `overflow-y-auto` cho lessons container

### ✅ Issue #2: Tính năng Auto-Assign không rõ cách dùng
**Root cause**: Thiếu documentation và UI hints
**Fix**: Tạo file `HUONG_DAN_AUTO_ASSIGN.md` với step-by-step guide và pattern examples

### ✅ Issue #3: Không lưu tiến độ xem video
**Root cause**: Frontend chưa gọi API save playback position
**Fix**: 
- Auto-save mỗi 5 giây
- Load saved position on mount
- Hiển thị Resume Modal khi quay lại

📄 **Chi tiết đầy đủ**: Xem [`FIXED_ISSUES_SUMMARY.md`](./FIXED_ISSUES_SUMMARY.md)

---

## 📂 Cấu Trúc Project

```
DriveLearn_v1.0/
├── frontend/                          # Next.js 15 frontend
│   ├── src/
│   │   ├── app/                       # App Router pages
│   │   │   ├── page.tsx              # Learner home (course list)
│   │   │   ├── admin/
│   │   │   │   ├── builder/          # Course Builder CMS
│   │   │   │   ├── vocabulary/       # Vocabulary CMS
│   │   │   │   └── quizzes/          # Quiz Builder
│   │   │   └── quiz/mock/            # Mock quiz practice
│   │   ├── components/
│   │   │   ├── builder/              # Admin CMS components
│   │   │   │   ├── CuratedCourseTree.tsx
│   │   │   │   ├── RawDriveTree.tsx
│   │   │   │   └── AutoSuggestModal.tsx
│   │   │   └── learner/              # Student UI components
│   │   │       ├── DriveVideoPlayer.tsx
│   │   │       ├── AudioPlayer.tsx
│   │   │       ├── KanjiCanvas.tsx
│   │   │       └── SrsFlashcardModal.tsx
│   │   └── lib/
│   │       ├── api.ts                # REST API client
│   │       ├── i18n.tsx              # Internationalization
│   │       └── theme.tsx             # Dark mode support
│   ├── HUONG_DAN_AUTO_ASSIGN.md      # Auto-Assign guide (Vietnamese)
│   ├── VIDEO_PROGRESS_TRACKING.md    # Video tracking docs
│   └── FIXED_ISSUES_SUMMARY.md       # Bug fixes summary
│
├── src/                               # .NET Backend
│   └── NihongoLms.Api/
│       ├── Controllers/
│       │   ├── CourseController.cs   # Course CRUD
│       │   ├── CuratorController.cs  # Drive sync & auto-assign
│       │   ├── ProgressController.cs # Lesson progress tracking
│       │   ├── QuizController.cs     # Quiz submission
│       │   ├── SrsController.cs      # SRS flashcard system
│       │   └── VocabularyController.cs
│       ├── Domain/Entities.cs        # EF Core models
│       └── appsettings.json          # Configuration
│
└── README_VI.md                      # This file
```

---

## 🎨 Screenshots

### Learner View - Video Player
![Video Player](https://placeholder-for-screenshot.com/learner-video.png)

### Admin Builder CMS
![Course Builder](https://placeholder-for-screenshot.com/admin-builder.png)

### SRS Flashcard System
![SRS Flashcard](https://placeholder-for-screenshot.com/srs-flashcard.png)

### Kanji Canvas
![Kanji Canvas](https://placeholder-for-screenshot.com/kanji-canvas.png)

---

## 🛣️ Roadmap

### Q1 2027
- [ ] HTML5 Video Player (thay thế Drive iframe)
- [ ] Mobile App (React Native / Flutter)
- [ ] Real-time collaboration (WebSocket)
- [ ] AI-powered vocab suggestions (GPT-4)

### Q2 2027
- [ ] Multi-user support (teachers & students)
- [ ] Certificate system (JLPT mock test)
- [ ] Payment integration (Stripe / VNPay)
- [ ] Advanced analytics dashboard

### Q3 2027
- [ ] Live streaming classes (WebRTC)
- [ ] Community forum & discussion
- [ ] Gamification (badges, leaderboard)
- [ ] Offline mode (PWA caching)

---

## 🤝 Đóng Góp

Contributions are welcome! Please follow these steps:

1. Fork repository
2. Create feature branch: `git checkout -b feature/AmazingFeature`
3. Commit changes: `git commit -m 'Add AmazingFeature'`
4. Push to branch: `git push origin feature/AmazingFeature`
5. Open Pull Request

### Development Guidelines
- **Code Style**: Follow .NET & TypeScript conventions
- **Commits**: Use conventional commits (feat, fix, docs, refactor)
- **Testing**: Write unit tests for new features
- **Documentation**: Update README & inline comments

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) file for details.

---

## 📞 Support & Contact

### Bug Reports
- **GitHub Issues**: https://github.com/nihongo-drive-lms/issues
- **Email**: tranquangphong232@gmail.com

### Community
- **Discord**: https://discord.gg/84FUJWUR6s
- **Facebook Group**: 

### Developer
- **Author**: wangfong
- **Website**: https://beacons.ai/wangfong
- **Documentation**: https://docs.google.com/document/d/1vNPb5CA-ctXFW8VXtP1JF3y0pCgIYAS4ncCREz9tzg0/edit?usp=sharing

---

## 🙏 Acknowledgments

- **Minna no Nihongo**: Giáo trình tham khảo chính
- **KanjiVG**: Dữ liệu thứ tự nét viết Kanji
- **Google Drive API**: Hệ thống lưu trữ tài nguyên
- **Next.js Team**: Framework tuyệt vời
- **Tailwind CSS**: UI styling
- **shadcn/ui**: Component library

---

**🎌 Cùng nhau học tiếng Nhật hiệu quả với NihongoDriveLMS! がんばって！📚**
