# 🌸 DriveLearn — Nihongo LMS (Japanese Learning Management System)

<div align="center">

[![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![EF Core](https://img.shields.io/badge/EF%20Core-10.0-512BD4)](https://docs.microsoft.com/ef/core/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Nền tảng Quản lý và Học tập Tiếng Nhật Toàn Diện — Tự động đồng bộ và chuyển hóa Google Drive thành khóa học JLPT tương tác theo mô hình chuẩn Prep / Riki.**

[Hình Ảnh Demo](#-hình-ảnh-giao-diện-demo--showcase) • [Tính Năng](#-tính-năng-nổi-bật) • [Kiến Trúc](#-kiến-trúc-hệ-thống) • [Cài Đặt & Chạy](#-hướng-dẫn-cài-đặt--chạy-dự-án) • [Cấu Hình Google Drive](#-cấu-hình-google-drive-api) • [Tài Liệu API](#-danh-sách-api-chính-api-reference)

---

<img src="demo/course.png" alt="DriveLearn Course Player" width="100%" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);" />

</div>

---

## 📖 Giới Thiệu (Overview)

**DriveLearn (Nihongo LMS)** là giải pháp LMS mã nguồn mở chuyên sâu cho việc học và giảng dạy tiếng Nhật (từ N5 đến N1). Hệ thống giải quyết bài toán lớn nhất của các trung tâm và giáo viên: **Kho học liệu khổng lồ trên Google Drive (Video, Audio, PDF, Đề thi, Flashcard) được tự động ánh xạ thành cây khóa học phân cấp (Course $\rightarrow$ Section $\rightarrow$ Lesson) mà không cần sao chép tệp hay tốn chi phí lưu trữ server.**

---

## 📸 Hình Ảnh Giao Diện Demo (Showcase)

### 1. 🎓 Giao Diện Học Tập Toàn Diện (Learner Experience)
> Phát video bài giảng HD, tài liệu đính kèm, danh sách từ vựng & Kanji theo bài học, cùng trình phát âm thanh hỗ trợ luyện nghe Chōkai chuyên sâu.

<p align="center">
  <img src="demo/course.png" alt="Giao diện học tập DriveLearn" width="95%" />
</p>

---

### 2. 🛠️ Trình Quản Lý & Xây Dựng Khóa Học (Course Builder CMS)
> Quản lý cây bài học phân cấp (Course $\rightarrow$ Chặng $\rightarrow$ Bài học), kéo thả tự do, và công cụ **Auto-Suggest** tự động phân loại tài nguyên Google Drive.

<p align="center">
  <img src="demo/CMS.png" alt="Course Builder CMS" width="95%" />
</p>

---

### 3. 🀄 Trung Tâm Kanji & Bảng Luyện Viết Tương Tác (Kanji Hub & Stroke Recognition)
> Tra cứu Kanji N5–N1, phân tích bộ thủ, âm Hán Việt, On/Kun. Bảng vẽ tương tác Canvas hỗ trợ hiển thị hoạt họa thứ tự nét (KanjiVG) và chấm điểm nét vẽ trực tiếp.

<p align="center">
  <img src="demo/KanjiHub.png" alt="Kanji Hub Dictionary" width="48%" />
  <img src="demo/KanjiCanvas.png" alt="Kanji Stroke Practice Canvas" width="48%" />
</p>

---

### 4. 🧠 Thẻ Ghi Nhớ & Lặp Lại Ngắt Quãng SM-2 (Spaced Repetition Flashcards)
> Thuật toán SuperMemo SM-2 tự động tính toán chu kỳ lặp lại tối ưu cho từng từ vựng dựa trên mức độ ghi nhớ (*Again, Hard, Good, Easy*).

<p align="center">
  <img src="demo/SRS.png" alt="Spaced Repetition System (SRS)" width="95%" />
</p>

---

### 5. 📝 Hệ Thống Thi Thử JLPT & Làm Bài Tập Tương Tác (Exam & Quiz Hub)
> Ngân hàng đề thi thử bấm giờ thực tế chuẩn format JLPT, đa dạng dạng câu hỏi (Trắc nghiệm, Điền từ, Nghe hiểu Audio, Sắp xếp từ) kèm phiếu chấm điểm tức thì.

<p align="center">
  <img src="demo/TestHub.png" alt="JLPT Exam Hub" width="48%" />
  <img src="demo/Test.png" alt="Interactive Quiz Taking" width="48%" />
</p>

---

### 6. 📥 Import Đề Thi & Câu Hỏi Hàng Loạt (Bulk Quiz Importer)
> Nhập nhanh hàng trăm câu hỏi trắc nghiệm từ file CSV, TXT, Excel với định dạng phân cách thông minh, tải file mẫu 1-click và phân bổ theo cấp độ JLPT.

<p align="center">
  <img src="demo/ImportData.png" alt="Bulk Quiz Importer (CSV / TXT / Excel)" width="95%" />
</p>

---

### 7. 📚 Ngân Hàng Quản Lý Từ Vựng (Vocabulary CMS)
> Tra cứu, lọc theo cấp độ JLPT, chỉnh sửa nghĩa, phiên âm Hiragana, ví dụ mẫu và phát âm từ vựng bằng công nghệ Speech Synthesis (TTS).

<p align="center">
  <img src="demo/VocabCMS.png" alt="Vocabulary Management CMS" width="95%" />
</p>

---

## ✨ Tính Năng Nổi Bật (Key Features)

- **📂 Google Drive Raw Mirror & Smart Auto-Curator:** Đồng bộ hóa Google Drive sang database PostgreSQL theo mô hình phân cấp, hỗ trợ gom nhóm bài học tự động với Regex pattern.
- **🎵 Zero-CORS Adaptive Media Streamer:** Tối ưu hóa phát Audio/Video trực tiếp với hỗ trợ HTTP 206 Partial Content (Byte Range requests), tự động chuyển đổi giữa Direct Stream và Google Drive Preview Player.
- **🧠 SM-2 Spaced Repetition Engine:** Hệ thống Flashcard thông minh giúp ghi nhớ từ vựng vĩnh viễn, hỗ trợ quản lý theo chuyên đề và theo dõi chuỗi ngày học (*Streak*).
- **🀄 Interactive Kanji Canvas:** Nhận diện nét viết Kanji với KanjiVG & HanziWriter, hỗ trợ cả chuột máy tính và màn hình cảm ứng Touch/Tablet.
- **📝 JLPT Quiz & Exam Engine:** Chấm điểm tự động 8 dạng câu hỏi, hỗ trợ lưu lịch sử làm bài và công cụ **Bulk Import câu hỏi từ CSV/TXT/Excel**.
- **🌓 Modern UI & Next.js 16 App Router:** Giao diện song ngữ Việt - Nhật - Anh, Dark/Light Mode, tối ưu SEO và Dynamic Import giúp tải trang mượt mà.

---

## 🏛 Kiến Trúc Hệ Thống (Clean Architecture)

```
DriveLearn_v1.0/
├── src/
│   ├── NihongoLms.Domain/           # Entities (Course, Lesson, Quiz, Vocabulary, DriveNode)
│   ├── NihongoLms.Application/      # DTOs, Interfaces (ICuratorService, ISrsService, IProgressService)
│   ├── NihongoLms.Infrastructure/   # EF Core DbContext, PostgreSQL, Services, SM-2 Engine, Quartz Sync
│   └── NihongoLms.Api/              # ASP.NET Core Web API Controllers, DI Registration, CORS
├── frontend/                        # Next.js 16 (App Router), Tailwind CSS, TypeScript
│   ├── src/app/                     # Pages: / (LMS), /admin/builder, /admin/quizzes, /kanji, /quiz/mock
│   ├── src/components/              # Reusable UI, KanjiCanvas, AudioPlayer, Modals
│   └── src/lib/                     # API Client, SRS, TTS, i18n, Favorites
└── demo/                            # Screenshots & Interface Demo Assets
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án (Quick Start)

### Yêu Cầu Hệ Thống
- **.NET 10 SDK** (hoặc .NET 9+)
- **Node.js 18+** & **npm**
- **Docker Desktop** (cho PostgreSQL)

---

### Khởi Chạy Tự Động 1-Click (Windows)
Chỉ cần nhấp đúp file [`start.bat`](start.bat) hoặc chạy lệnh trong terminal:
```bash
.\start.bat
```
Hệ thống sẽ tự động khởi động cơ sở dữ liệu PostgreSQL container, biên dịch Backend .NET API (port `5222`) và chạy Frontend Next.js (port `3000`).

---

### Khởi Chạy Thủ Công

#### 1. Khởi động PostgreSQL Container
```bash
docker run --name nihongo-postgres -e POSTGRES_DB=nihongo_lms -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres:16-alpine
```

#### 2. Khởi chạy Backend .NET 10
```bash
dotnet ef database update --project src/NihongoLms.Infrastructure --startup-project src/NihongoLms.Api
dotnet run --project src/NihongoLms.Api/NihongoLms.Api.csproj
```
* Backend API: `http://localhost:5222`
* Swagger UI: `http://localhost:5222/swagger`

#### 3. Khởi chạy Frontend Next.js 16
```bash
cd frontend
npm install
npm run dev
```
* Ứng dụng Web: `http://localhost:3000`

---

## 🔑 Cấu Hình Google Drive API

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/) và tạo một Project mới.
2. Bật **Google Drive API**.
3. Tạo **OAuth 2.0 Client ID** (chọn *Web Application*):
   - **Authorized redirect URIs:** `http://localhost:5222/api/auth/google/callback`
4. Cập nhật thông tin vào file cấu hình môi trường phát triển:
   ```json
   {
     "Authentication": {
       "Google": {
         "ClientId": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
         "ClientSecret": "YOUR_GOOGLE_CLIENT_SECRET",
         "RedirectUri": "http://localhost:5222/api/auth/google/callback"
       }
     },
     "GoogleDrive": {
       "RootFolderId": "YOUR_GOOGLE_DRIVE_ROOT_FOLDER_ID"
     }
   }
   ```
5. Đăng nhập tại `http://localhost:5222/api/auth/google/login` hoặc nút **"Kết Nối Google OAuth"** trong trang Builder để bắt đầu đồng bộ.

---

## 📡 Danh Sách API Chính (API Reference)

| Phương Thức | Tuyến Đường (Route) | Mô Tả |
|:---|:---|:---|
| `GET` | `/api/course` | Lấy danh sách toàn bộ khóa học và cây bài học |
| `GET` | `/api/course/{id}` | Lấy chi tiết khóa học theo ID |
| `POST` | `/api/sync/drive` | Kích hoạt quét và đồng bộ cấu trúc Google Drive |
| `GET` | `/api/sync/nodes` | Lấy danh sách tệp/thư mục đã đồng bộ từ Drive |
| `GET` | `/api/audio/proxy-drive` | Proxy & Cache stream âm thanh trực tiếp từ Google Drive |
| `GET` | `/api/srs/due` | Lấy danh sách từ vựng đến hạn ôn tập hôm nay |
| `POST` | `/api/srs/review` | Gửi đánh giá thẻ SRS (Cập nhật khoảng cách SM-2) |
| `GET` | `/api/srs/stats` | Thống kê số thẻ và chuỗi ngày học liên tục |
| `GET` | `/api/quiz/{id}` | Lấy đề thi dành cho học viên |
| `POST` | `/api/quiz/{id}/submit` | Nộp bài và chấm điểm tự động |
| `GET` | `/api/vocabulary` | Tra cứu danh sách từ vựng theo cấp độ JLPT / bài học |
| `GET` | `/api/progress/{lessonId}` | Lấy tiến độ học và vị trí phát media của bài học |
| `POST` | `/api/progress/playback` | Lưu vị trí phát video/audio theo thời gian thực |

---

## 📄 Bản Quyền & Giấy Phép (License)

Phát hành theo giấy phép mã nguồn mở **MIT License**. Mọi cá nhân, tổ chức đều có quyền sử dụng, sửa đổi và triển khai cho mục đích giáo dục hoặc thương mại.

---

<div align="center">
  <sub>Được phát triển với ❤️ cho cộng đồng người học và giáo viên tiếng Nhật.</sub>
</div>
