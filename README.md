# 🌸 DriveLearn — Nihongo LMS (Japanese Learning Management System)

<div align="center">

[![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![EF Core](https://img.shields.io/badge/EF%20Core-10.0-512BD4)](https://docs.microsoft.com/ef/core/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Nền tảng Quản lý và Học tập Tiếng Nhật Thông minh — Đồng bộ và chuyển hóa Google Drive thành khóa học JLPT tương tác chuẩn Prep / Riki.**

[Tính Năng](#-tính-năng-nổi-bật) • [Kiến Trúc](#-kiến-trúc-hệ-thống) • [Hướng Dẫn Cài Đặt](#-hướng-dẫn-cài-đặt--chạy-dự-án) • [Cấu Hình Google Drive](#-cấu-hình-google-drive-api) • [Tài Liệu API](#-tài-liệu-api) • [Đóng Góp](#-đóng-góp-phát-triển)

</div>

---

## 📖 Giới Thiệu (Overview)

**DriveLearn (Nihongo LMS)** là giải pháp LMS chuyên sâu cho việc học và giảng dạy tiếng Nhật (từ N5 đến N1). Hệ thống giải quyết bài toán lớn nhất của các trung tâm và giáo viên: **Kho học liệu khổng lồ trên Google Drive (Video, Audio, PDF, Đề thi, Flashcard) được tự động ánh xạ thành cây khóa học phân cấp (Course $\rightarrow$ Section $\rightarrow$ Lesson) mà không cần sao chép hay tốn chi phí lưu trữ máy chủ.**

---

## ✨ Tính Năng Nổi Bật (Key Features)

### 1. 📂 Google Drive Raw Mirror & Smart Auto-Curator
- Đồng bộ cây thư mục Google Drive theo thời gian thực (background Quartz.NET job).
- **Auto-Suggest Pattern Engine**: Tự động nhận diện cấu trúc thư mục (`Bài 01`, `Lesson 1`, `Choukai`, `Dokkai`, v.v.) bằng Regex và gom nhóm thành bài học hoàn chỉnh chỉ với 1 click.
- Kéo thả tự do tài nguyên (Video, Audio, PDF, Docs) vào từng bài học.

### 2. 🎵 Trình Phát Đa Phương Tiện Thích Ứng (Adaptive Media Streaming)
- **Zero-CORS Audio Streamer**: Backend proxy stream audio trực tiếp từ Google Drive với cơ chế **Thread-Safe Download Lock (`SemaphoreSlim`)** và bộ đệm cache cục bộ thông minh.
- Hỗ trợ đầy đủ tính năng học ngoại ngữ chuyên sâu: Tua lại 5s/10s, A-B Repeat (lặp đoạn), điều chỉnh tốc độ $(0.5\times - 2\times)$, Text-to-Speech (TTS) tiếng Nhật tự nhiên, và Iframe Preview Fallback.
- Tự động lưu tiến độ video/audio đến từng giây.

### 3. 🧠 Thẻ Ghi Nhớ & Thuật Toán Lặp Lại Ngắt Quãng (SM-2 Spaced Repetition)
- Thuật toán **SuperMemo SM-2** tính toán thời điểm ôn tập tối ưu cho từng từ vựng dựa trên độ nhớ (*Again, Hard, Good, Easy*).
- Quản lý bộ thẻ theo cấp độ JLPT (N5 $\rightarrow$ N1) và thư mục chuyên đề tùy chỉnh.
- Thống kê chuỗi ngày học liên tục (*Study Streak*), số thẻ cần ôn trong ngày.

### 4. 📝 Hệ Thống Thi Thử JLPT N5–N1 & Bài Tập Đa Dạng
- Hỗ trợ 8 loại câu hỏi tương tác:
  - Trắc nghiệm 4 lựa chọn (Multiple Choice)
  - Điền từ vào chỗ trống (Fill in the Blank)
  - Nghe hiểu tích hợp Audio (Choukai)
  - Sắp xếp trật tự từ / mẫu câu (Token Arrangement)
  - Ghép cặp từ vựng / Kanji (Matching Pairs)
- Chế độ thi thử bấm giờ thực tế (105 phút) với phiếu chấm điểm chi tiết và giải thích đáp án.
- Tự động đánh dấu hoàn thành bài học khi vượt qua Quiz.

### 5. 🀄 Bảng Luyện Viết Kanji Tương Tác (KanjiVG & HanziWriter)
- Nạp động dữ liệu nét chữ chuẩn KanjiVG trên lưới điền tự (田).
- Chế độ xem hoạt họa từng nét chữ theo thứ tự chuẩn.
- Chế độ **Tập Viết & Chấm Điểm (Quiz Mode)**: Nhận diện cử chỉ chuột hoặc cảm ứng (Touch), phát hiện nét sai và chúc mừng khi hoàn thành.

### 6. 🌐 Giao Diện Song Ngữ & Tối Ưu Hiệu Năng
- Song ngữ Việt - Nhật - Anh với Dark/Light Mode.
- Dynamic Import (`next/dynamic`) phân rã bundle, tốc độ tải trang cực nhanh.

---

## 🏛 Kiến Trúc Hệ Thống (Clean Architecture)

```
DriveLearn_v1.0/
├── src/
│   ├── NihongoLms.Domain/           # Entities (Course, Lesson, Quiz, Vocabulary, DriveNode)
│   ├── NihongoLms.Application/      # DTOs, Interfaces (ICuratorService, ISrsService, IProgressService)
│   ├── NihongoLms.Infrastructure/   # EF Core DbContext, PostgreSQL, Services, SM-2 Engine, Quartz Sync
│   └── NihongoLms.Api/              # ASP.NET Core Web API Controllers, DI Registration, CORS
└── frontend/                        # Next.js 16 (App Router), Tailwind CSS, TypeScript
    ├── src/app/                     # Pages: / (LMS), /admin/builder, /admin/quizzes, /kanji, /quiz/mock
    ├── src/components/              # Reusable UI, KanjiCanvas, AudioPlayer, Modals
    └── src/lib/                     # API Client, SRS, TTS, i18n, Favorites
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án (Quick Start)

### Yêu Cầu Môi Trường
- **.NET 10 SDK** (hoặc .NET 9 trở lên)
- **Node.js 18+** & **npm**
- **Docker Desktop** (cho PostgreSQL)

---

### Bước 1: Khởi Động Cơ Sở Dữ Liệu PostgreSQL

Khởi chạy container PostgreSQL với Docker:

```bash
docker run --name nihongo-postgres -e POSTGRES_DB=nihongo_lms -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres:16-alpine
```

---

### Bước 2: Cấu Hình & Chạy Backend (.NET 10)

1. Mở file `src/NihongoLms.Api/appsettings.json` và kiểm tra chuỗi kết nối:
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=localhost;Port=5433;Database=nihongo_lms;Username=postgres;Password=postgres"
     }
   }
   ```

2. Áp dụng Migration cơ sở dữ liệu:
   ```bash
   dotnet ef database update --project src/NihongoLms.Infrastructure --startup-project src/NihongoLms.Api
   ```

3. Khởi chạy Backend API:
   ```bash
   cd src/NihongoLms.Api
   dotnet run
   ```
   * Swagger UI khả dụng tại: `https://localhost:7000/swagger` hoặc `http://localhost:5000/swagger`.

---

### Bước 3: Cài Đặt & Chạy Frontend (Next.js 16)

1. Mở terminal mới, di chuyển vào thư mục `frontend`:
   ```bash
   cd frontend
   npm install
   ```

2. Tạo file cấu hình môi trường `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```

3. Khởi chạy máy chủ phát triển:
   ```bash
   npm run dev
   ```
   * Truy cập ứng dụng tại: `http://localhost:3000`

---

## 🔑 Cấu Hình Google Drive API

Để đồng bộ học liệu trực tiếp từ Google Drive của bạn:

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/) và tạo một Project mới.
2. Bật **Google Drive API**.
3. Tạo **Service Account** hoặc **OAuth 2.0 Client ID**, tải file credentials JSON về máy.
4. Chia sẻ thư mục Google Drive chứa tài liệu cho email của Service Account (quyền *Viewer* hoặc *Editor*).
5. Lấy **Folder ID** từ URL Google Drive (ví dụ: `drive.google.com/drive/folders/xxx` $\rightarrow$ ID là `xxx`).
6. Nhập Folder ID vào giao diện **Course Builder (`/admin/builder`)** và nhấn **"Đồng Bộ Google Drive"**.

---

## 📡 Danh Sách API Chính (API Reference)

| Phương Thức | Tuyến Đường (Route) | Mô Tả |
|:---|:---|:---|
| `GET` | `/api/course` | Lấy danh sách toàn bộ khóa học và cây bài học |
| `GET` | `/api/course/{id}` | Lấy chi tiết khóa học theo ID |
| `POST` | `/api/sync/drive` | Kích hoạt quét và đồng bộ cấu trúc Google Drive |
| `GET` | `/api/sync/nodes` | Lấy danh sách tệp/thư mục đã đồng bộ từ Drive |
| `GET` | `/api/audio/stream/{driveFileId}` | Proxy stream âm thanh trực tiếp chống CORS |
| `GET` | `/api/srs/due` | Lấy danh sách từ vựng đến hạn ôn tập hôm nay |
| `POST` | `/api/srs/review` | Gửi đánh giá thẻ SRS (Cập nhật khoảng cách SM-2) |
| `GET` | `/api/srs/stats` | Thống kê số thẻ, chuỗi ngày học liên tục |
| `GET` | `/api/quiz/{id}` | Lấy đề thi dành cho học viên |
| `POST` | `/api/quiz/{id}/submit` | Nộp bài và chấm điểm tự động |
| `GET` | `/api/vocabulary` | Tra cứu danh sách từ vựng theo cấp độ JLPT / bài học |
| `GET` | `/api/progress/{lessonId}` | Lấy tiến độ học và vị trí phát media của bài học |
| `POST` | `/api/progress/playback` | Lưu vị trí phát video/audio theo thời gian thực |

---

## 🧪 Kiểm Thử & Đóng Gói (Build & Verification)

- **Kiểm tra Backend:**
  ```bash
  dotnet build
  ```
- **Kiểm tra Frontend:**
  ```bash
  cd frontend && npm run build
  ```

---

## 📄 Bản Quyền & Giấy Phép (License)

Phát hành theo giấy phép mã nguồn mở **MIT License**. Mọi cá nhân, tổ chức đều có quyền sử dụng, sửa đổi và triển khai cho mục đích giáo dục hoặc thương mại.

---

<div align="center">
  <sub>Được phát triển với ❤️ cho cộng đồng người học và giáo viên tiếng Nhật.</sub>
</div>
