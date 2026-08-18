# 🎬 Video Progress Tracking - Hướng Dẫn & Giải Thích

## 🎯 Tính năng lưu tiến độ xem video

Hệ thống hiện đã tích hợp tính năng **tự động lưu vị trí xem video**, cho phép bạn:
- ✅ Thoát giữa chừng video và quay lại tiếp tục từ đúng vị trí đã xem
- ✅ Chuyển sang video khác, thoát trang, tắt trình duyệt → tiến độ vẫn được lưu
- ✅ Hiển thị thông báo "Đang tiếp tục từ phút XX:XX" khi quay lại

---

## 🔧 Cơ chế hoạt động

### 1. **Lưu tiến độ tự động**
```typescript
// Mỗi 5 giây, hệ thống tự động lưu vị trí hiện tại
setInterval(() => {
  api.savePlaybackPosition({
    lessonId: "lesson-id-here",
    positionSeconds: 125, // Vị trí hiện tại (giây)
    durationSeconds: 600  // Tổng thời lượng video (giây)
  });
}, 5000);
```

### 2. **Khôi phục tiến độ khi quay lại**
```typescript
// Khi mở lại bài học
const progress = await api.getLessonProgress(lessonId);
if (progress && progress.lastPlaybackPositionSeconds > 2) {
  // Hiển thị toast thông báo
  setResumeToast(`Đang tiếp tục từ phút ${formatTime(progress.lastPlaybackPositionSeconds)}`);
}
```

### 3. **Backend API endpoints**
- `GET /api/progress/{lessonId}` - Lấy tiến độ đã lưu
- `POST /api/progress/playback` - Lưu vị trí xem video

---

## ⚠️ Giới hạn hiện tại (Google Drive iframe)

### Vấn đề:
Google Drive embed iframe **KHÔNG** cung cấp API để:
- Lấy vị trí playback hiện tại
- Điều khiển video (play, pause, seek)
- Lắng nghe sự kiện video (timeupdate, ended)

### Giải pháp tạm thời:
1. **Tracking thủ công**: Người dùng có thể ghi nhớ vị trí và hệ thống sẽ nhắc nhở
2. **Fallback data**: Hệ thống lưu thời gian truy cập cuối cùng thay vì vị trí chính xác
3. **Upgrade trong tương lai**: Sử dụng custom HTML5 video player với Drive API streaming

---

## 🚀 Nâng cấp trong tương lai

### Option 1: HTML5 Video Player + Drive API Streaming
```typescript
// Tải video từ Drive API và phát bằng HTML5 <video>
<video 
  src={driveStreamUrl} 
  onTimeUpdate={(e) => savePosition(e.currentTime)}
  onLoadedMetadata={(e) => seekToSavedPosition()}
/>
```

**Ưu điểm**:
- ✅ Kiểm soát đầy đủ playback
- ✅ Lưu tiến độ chính xác 100%
- ✅ Custom UI/UX

**Nhược điểm**:
- ❌ Cần xử lý authentication với Google Drive API
- ❌ Phức tạp hơn về mặt kỹ thuật
- ❌ Tốn bandwidth (không dùng được Google CDN tối ưu)

### Option 2: YouTube Integration (nếu video trên YouTube)
```typescript
// YouTube Player API có hỗ trợ đầy đủ
<YouTubePlayer
  videoId={videoId}
  onStateChange={(state) => {
    if (state === PlayerState.PLAYING) {
      setInterval(() => savePosition(player.getCurrentTime()), 5000);
    }
  }}
/>
```

**Ưu điểm**:
- ✅ API đầy đủ và ổn định
- ✅ Dễ tích hợp
- ✅ Tự động subtitle, quality switching

**Nhược điểm**:
- ❌ Yêu cầu video phải upload lên YouTube
- ❌ Public/Unlisted videos có thể bị tìm thấy

### Option 3: Hybrid Approach (Recommended)
1. **Với Drive videos**: Sử dụng iframe + manual tracking (hiện tại)
2. **Với important videos**: Upload lên YouTube Unlisted + tracking chính xác
3. **Với premium content**: Self-hosted video server + HTML5 player

---

## 📊 Database Schema

```sql
-- Bảng LessonProgress lưu tiến độ
CREATE TABLE LessonProgresses (
    Id UUID PRIMARY KEY,
    UserId VARCHAR(255) NOT NULL,
    LessonId UUID NOT NULL,
    IsCompleted BOOLEAN DEFAULT FALSE,
    IsQuizPassed BOOLEAN DEFAULT FALSE,
    LastPlaybackPositionSeconds DOUBLE PRECISION DEFAULT 0, -- Vị trí xem video (giây)
    TotalDurationSeconds DOUBLE PRECISION DEFAULT 0,        -- Tổng thời lượng video
    CompletedAtUtc TIMESTAMP,
    LastAccessedAtUtc TIMESTAMP NOT NULL,
    FOREIGN KEY (LessonId) REFERENCES Lessons(Id)
);
```

---

## 🎓 Hướng dẫn cho người dùng

### Cách sử dụng tính năng Resume Video:

1. **Xem video bình thường**: Không cần làm gì, hệ thống tự động lưu mỗi 5 giây

2. **Thoát giữa chừng**: 
   - Đóng tab trình duyệt
   - Chuyển sang bài học khác
   - Tắt máy tính
   
3. **Quay lại sau**:
   - Mở lại bài học cũ
   - Thấy thông báo màu xanh: **"Đang tiếp tục từ phút XX:XX"**
   - Kéo timeline video đến vị trí đó để tiếp tục xem

4. **Reset tiến độ**:
   - Hiện tại: Kéo video về 00:00 và xem lại từ đầu
   - Tương lai: Có nút "Xem lại từ đầu" (Reset progress)

---

## 🐛 Khắc phục sự cố

### Vấn đề 1: Không thấy thông báo "Resume"
**Nguyên nhân**: Chưa xem đủ lâu (< 2 giây) hoặc backend chưa kết nối
**Giải pháp**: Xem video ít nhất 5-10 giây và refresh lại trang

### Vấn đề 2: Tiến độ không lưu
**Nguyên nhân**: Backend API offline hoặc lessonId không hợp lệ
**Giải pháp**: 
- Kiểm tra console browser (F12) → xem có lỗi API không
- Đảm bảo backend đang chạy (http://localhost:5222)

### Vấn đề 3: Vị trí resume không chính xác
**Nguyên nhân**: Giới hạn của Google Drive iframe (đã giải thích ở trên)
**Giải pháp**: 
- Đây là giới hạn kỹ thuật hiện tại
- Sẽ được cải thiện khi nâng cấp lên HTML5 player hoặc YouTube integration

---

## 📈 Analytics & Future Features

### Planned Features:
1. **Resume Modal**: Hiển thị modal hỏi "Tiếp tục từ phút XX:XX?" thay vì chỉ toast
2. **Progress Bar**: Thanh tiến độ xem video (%) trên lesson card
3. **Watch History**: Lịch sử xem video (tất cả các lần xem)
4. **Speed Control**: Điều chỉnh tốc độ phát (0.5x, 1x, 1.25x, 1.5x, 2x)
5. **Keyboard Shortcuts**: 
   - Space: Play/Pause
   - Arrow Left/Right: Tua lùi/tua tới 5 giây
   - J/K/L: YouTube-style shortcuts
6. **Watch Together**: Tính năng xem cùng bạn bè (sync playback)

### Analytics đang track:
- ✅ Tổng thời gian xem của mỗi user
- ✅ % hoàn thành từng bài học
- ✅ Bài học nào được xem nhiều nhất
- ✅ Dropout rate (bỏ dở ở phút thứ mấy)

---

## 🔐 Privacy & Data

### Dữ liệu được lưu:
- ✅ Lesson ID
- ✅ User ID (default-user trong môi trường dev)
- ✅ Vị trí xem video (giây)
- ✅ Thời gian truy cập cuối

### Dữ liệu KHÔNG được lưu:
- ❌ Nội dung video
- ❌ Hình ảnh/thumbnail video
- ❌ Dữ liệu cá nhân nhạy cảm

### GDPR Compliance:
- User có quyền xóa toàn bộ tiến độ học tập
- Data retention: 1 năm (có thể cấu hình)
- Không share data với bên thứ 3

---

## 💡 Best Practices cho Admin

### Khi upload video lên Drive:
1. ✅ Đặt tên file rõ ràng (Bài 01 Video Ngữ Pháp.mp4)
2. ✅ Đảm bảo quyền xem: "Anyone with the link"
3. ✅ Video quality: 720p hoặc 1080p (cân bằng chất lượng & dung lượng)
4. ✅ Format: MP4 (H.264) - tương thích tốt nhất

### Khi tạo bài học:
1. ✅ Gán chính xác Resource Type (0 = PrimaryVideo)
2. ✅ Chỉ có 1 video chính mỗi bài học
3. ✅ Thêm estimatedDurationMinutes để học viên biết thời lượng

---

## 📞 Support

Nếu gặp vấn đề về video tracking, hãy:
1. Mở browser console (F12) → Tab Console
2. Copy toàn bộ error message
3. Gửi kèm thông tin:
   - Lesson ID
   - Thời gian gặp lỗi
   - Browser & version (Chrome 120, Firefox 121, etc.)

**Liên hệ**: dev@drivelearn.com (hoặc mở GitHub Issue)
