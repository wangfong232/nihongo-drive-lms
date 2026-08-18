# 📘 Hướng Dẫn Sử Dụng Tính Năng Auto-Assign (Gán Tự Động Bài Học)

## 🎯 Mục đích
Tính năng **Auto-Assign** giúp bạn tự động tạo và gán hàng loạt bài học (Lessons) từ cấu trúc thư mục Google Drive vào một chương (Section) trong khóa học, thay vì phải tạo và kéo thả từng file một cách thủ công.

---

## 📋 Điều kiện để sử dụng

### 1. Cấu trúc thư mục Google Drive phải có định dạng nhất quán:
```
📁 Thư mục gốc khóa học N5
  ├─ 📁 Bài 01 - Giới thiệu
  │   ├─ 🎬 01 Video ngữ pháp.mp4
  │   ├─ 🎵 01 Luyện nghe.mp3
  │   └─ 📄 01 Bài tập.pdf
  ├─ 📁 Bài 02 - Chỉ thị từ
  │   ├─ 🎬 02 Video ngữ pháp.mp4
  │   └─ 🎵 02 Luyện nghe.mp3
  └─ 📁 Bài 03 - Thời gian
      └─ 🎬 03 Video ngữ pháp.mp4
```

### 2. Tên thư mục và file phải theo pattern (quy tắc đặt tên):
- **Tên thư mục bài học**: Phải có số thứ tự, ví dụ:
  - ✅ `Bài 01 - Giới thiệu`
  - ✅ `01_Introduction`
  - ✅ `Lesson 01 Grammar`
  - ❌ `Introduction` (thiếu số)

- **Tên file tài nguyên**: Nên chứa số hoặc loại tài nguyên, ví dụ:
  - ✅ `01 Video.mp4`, `Bài 01 Ngữ pháp.mp4`
  - ✅ `01 Audio.mp3`, `Listening 01.mp3`
  - ✅ `01 Exercise.pdf`

---

## 🚀 Các bước sử dụng

### Bước 1: Đồng bộ Google Drive
1. Truy cập trang **Admin → Builder CMS**
2. Tại thanh toolbar phía trên, nhập **Root Folder ID** của thư mục gốc chứa khóa học trên Google Drive
   - Cách lấy Folder ID: Mở thư mục trên Google Drive, copy phần ID trong URL
   - Ví dụ: `https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J` → ID là `1A2B3C4D5E6F7G8H9I0J`
3. Nhấn nút **"Sync Drive"** và chờ hệ thống đồng bộ cây thư mục

### Bước 2: Tạo khóa học và chương (nếu chưa có)
1. Ở cột bên phải **"Curated Courses"**, nhấn **"+ Thêm Khóa Học"**
2. Nhập tên khóa học (ví dụ: "Tiếng Nhật N5") và chọn level (N5, N4, v.v.)
3. Sau khi tạo khóa học, nhấn **"+ Thêm Chặng / Section"** bên trong khóa học đó
4. Nhập tên chương (ví dụ: "Chặng 1: Nhập môn (Bài 01-05)")

### Bước 3: Kích hoạt Auto-Suggest
1. Ở cột bên trái **"Raw Drive Tree"**, tìm thư mục cha chứa các thư mục bài học con (ví dụ: `N5_Bài_Giảng`)
2. Di chuột vào thư mục đó, nhấn vào icon **✨ "Auto Suggest"** (icon phép thuật màu tím)
3. Một modal sẽ hiện ra với:
   - **Thư mục đã chọn**: Hiển thị tên thư mục bạn vừa chọn
   - **Pattern Regex**: Quy tắc tìm kiếm (mặc định: `^Bài \d+` — tìm thư mục bắt đầu bằng "Bài" + số)
   - **Target Section**: Chọn chương đích để gán vào

### Bước 4: Cấu hình Pattern Regex (tùy chọn)
- **Mặc định**: `^Bài \d+` — Tìm thư mục bắt đầu bằng "Bài" + số (ví dụ: Bài 01, Bài 02)
- **Tùy chỉnh**:
  - `^Lesson \d+`: Tìm "Lesson 01", "Lesson 02"
  - `^\d+_`: Tìm "01_Intro", "02_Grammar"
  - `^L\d+`: Tìm "L01", "L02", "L03"

**Lưu ý**: Regex phải match với **TÊN THƯ MỤC CON** bên trong thư mục cha bạn đã chọn.

### Bước 5: Phân tích (Analyze)
1. Sau khi chọn pattern và target section, nhấn **"🔍 Analyze Pattern"**
2. Hệ thống sẽ quét tất cả thư mục con, tìm những thư mục khớp với pattern
3. Kết quả hiển thị danh sách **Suggested Lessons** với:
   - Tên bài học tự động trích xuất từ tên thư mục
   - Số thứ tự bài học
   - Danh sách tài nguyên (video, audio, PDF) bên trong mỗi thư mục

### Bước 6: Xem trước và chọn bài học muốn tạo
1. Xem qua danh sách bài học được gợi ý
2. Bỏ chọn (uncheck) những bài học bạn KHÔNG muốn tạo
3. Hệ thống tự động nhận diện loại tài nguyên:
   - `.mp4, .avi, .mov` → Video (Resource Type 0)
   - `.mp3, .wav, .m4a` → Audio (Resource Type 1)
   - `.pdf` → PDF (Resource Type 2)

### Bước 7: Apply (Áp dụng)
1. Nhấn nút **"✨ Apply Auto-Assign"**
2. Hệ thống sẽ:
   - Tạo các **Lesson** mới trong Section đã chọn
   - Gán (assign) tất cả tài nguyên (video, audio, PDF) vào từng bài học tương ứng
   - Sắp xếp thứ tự bài học theo số thứ tự đã trích xuất
3. Sau khi hoàn thành, modal sẽ đóng và bạn thấy các bài học mới xuất hiện trong cột **Curated Courses**

---

## 💡 Mẹo và lưu ý

### ✅ Nên làm:
- Đặt tên thư mục và file có quy tắc rõ ràng, nhất quán
- Sử dụng số thứ tự ở đầu tên (01, 02, 03...) để dễ sắp xếp
- Kiểm tra kết quả Analyze trước khi Apply để đảm bảo đúng
- Có thể chạy Auto-Assign nhiều lần cho các Section khác nhau

### ❌ Tránh:
- Đặt tên thư mục không có số hoặc không theo pattern
- Mix nhiều cấu trúc khác nhau trong cùng một thư mục cha
- Quên đồng bộ Drive trước khi sử dụng Auto-Assign (dữ liệu cũ)

---

## 🔧 Khắc phục sự cố

### Vấn đề: Không tìm thấy bài học nào
**Nguyên nhân**: Pattern regex không khớp với tên thư mục con
**Giải pháp**:
1. Kiểm tra lại tên thư mục con trong Drive Tree (cột bên trái)
2. Điều chỉnh Pattern regex cho phù hợp
3. Test pattern tại https://regex101.com/ nếu cần

### Vấn đề: Tài nguyên không được gán đúng loại
**Nguyên nhân**: File extension không được nhận diện
**Giải pháp**:
- Đảm bảo file có đuôi mở rộng rõ ràng (`.mp4`, `.pdf`, `.mp3`)
- Kiểm tra lại trong modal trước khi Apply
- Có thể chỉnh sửa Resource Type sau khi tạo (xóa và kéo thả lại)

### Vấn đề: Auto-Suggest button không hiện
**Nguyên nhân**: Chưa chọn đúng thư mục (phải là folder, không phải file)
**Giải pháp**:
- Đảm bảo node bạn chọn là **Folder** (icon thư mục 📁)
- Chỉ folder mới có nút "✨ Auto Suggest"

---

## 📹 Demo workflow hoàn chỉnh

```
1. [Admin Builder CMS]
   → Nhập Root Folder ID → Sync Drive
   
2. [Cột Phải]
   → + Thêm Khóa Học "N5 Elementary"
   → + Thêm Chặng "Chặng 1: Bài 01-05"
   
3. [Cột Trái - Drive Tree]
   → Mở rộng thư mục "N5_Bài_Giảng"
   → Hover vào thư mục → Click ✨ Auto Suggest
   
4. [Modal Auto-Suggest]
   → Pattern: ^Bài \d+
   → Target: "Chặng 1: Bài 01-05"
   → Click "Analyze"
   
5. [Kết quả]
   → Hiển thị: Bài 01, Bài 02, Bài 03...
   → Mỗi bài có video, audio, PDF
   → Kiểm tra và bỏ chọn bài không cần
   → Click "Apply Auto-Assign"
   
6. [Kết quả cuối cùng]
   → Cột phải xuất hiện 5 bài học mới với tài nguyên đầy đủ
   → Sẵn sàng học trên Learner View
```

---

## 🎓 Kết luận

Tính năng **Auto-Assign** giúp tiết kiệm hàng giờ đồng hồ so với việc tạo và gán từng bài học thủ công. Đặc biệt hữu ích khi bạn có:
- Hàng chục hoặc hàng trăm bài học
- Cấu trúc thư mục Drive đã có sẵn
- Muốn nhanh chóng xây dựng khóa học

**Lần đầu sử dụng**: Hãy thử với 2-3 bài học trước để quen cách hoạt động, sau đó mở rộng quy mô!
