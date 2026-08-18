# ❓ Câu Hỏi Thường Gặp (FAQ)

## 🎯 General Questions

### Q1: Nihongo Drive Learn là gì?
**A:** Nihongo Drive Learn là hệ thống quản lý học tập (LMS) chuyên biệt cho tiếng Nhật (JLPT N5-N1), tích hợp với Google Drive để quản lý video, audio, PDF bài giảng một cách linh hoạt.

### Q2: Tại sao lại dùng Google Drive thay vì upload trực tiếp?
**A:** 
- ✅ **Tiết kiệm chi phí hosting**: Google Drive miễn phí 15GB, không tốn server storage
- ✅ **Bandwidth unlimited**: Google CDN phục vụ video nhanh, không tốn bandwidth của bạn
- ✅ **Dễ quản lý**: Giáo viên có thể tự upload/sửa file trên Drive, không cần qua admin
- ✅ **Collaboration**: Nhiều người cùng quản lý thư mục Drive

### Q3: Hệ thống có miễn phí không?
**A:** Hiện tại Nihongo Drive Learn là **open-source** (MIT License). Bạn có thể:
- ✅ Tự host miễn phí (cần có server)
- ✅ Chỉnh sửa code theo nhu cầu
- ⚠️ Chi phí phát sinh: Google OAuth setup (miễn phí nhưng cần verify domain nếu production)

---

## 🔧 Setup & Configuration

### Q4: Làm sao để lấy Google Drive Folder ID?
**A:**
1. Mở thư mục trên Google Drive
2. Nhìn vào URL: `https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J`
3. Copy phần sau `/folders/` → `1A2B3C4D5E6F7G8H9I0J`

### Q5: Khi Sync Drive báo lỗi "401 Unauthorized" thì làm sao?
**A:**
1. Click nút **"Kết Nối Google OAuth"** ở góc trên phải
2. Đăng nhập Google và cấp quyền "See & download all your Drive files"
3. Sau khi thấy badge "Drive OAuth Connected", thử Sync lại

### Q6: Tôi đã Sync Drive nhưng không thấy file nào?
**A:** Kiểm tra:
- ✅ **Root Folder ID có đúng không?**
- ✅ **Tài khoản Google đã login có quyền xem folder đó không?**
- ✅ Backend console có log lỗi gì không? (Xem terminal đang chạy `dotnet run`)
- ✅ Thử refresh lại trang Builder (`Ctrl + F5`)

### Q7: PostgreSQL connection failed - "password authentication failed"
**A:** 
1. Kiểm tra `appsettings.json` → `ConnectionStrings:DefaultConnection`
2. Đảm bảo username/password đúng
3. Test connection:
```bash
psql -h localhost -U postgres -d nihongo_lms
# Nhập password → Nếu vào được thì connection string đúng
```

---

## 📚 Course Builder (Admin)

### Q8: Bài 2 trở lên không nhìn thấy / không click được?
**A:** ✅ **ĐÃ FIX** trong version hiện tại!
- Root cause: Nested overflow issue
- Giải pháp: Đã thêm `max-h-[600px]` và `overflow-y-auto` cho lessons container
- Verify: Scroll trong Section phải hoạt động, click vào bất kỳ lesson nào cũng expand được

📄 Chi tiết: Xem [`FIXED_ISSUES_SUMMARY.md`](./FIXED_ISSUES_SUMMARY.md) - Issue #1

### Q9: Tính năng Auto-Assign ở đâu? Tôi không thấy nút!
**A:**
1. **Điều kiện**: Phải hover vào **folder** (📁 icon), không phải file
2. **Vị trí**: Cột bên trái "Raw Drive Tree" → Hover vào folder → Nút **✨ "Auto Suggest"** xuất hiện bên phải tên folder
3. **Nếu vẫn không thấy**: 
   - Đảm bảo đã Sync Drive thành công
   - Refresh trang (`Ctrl + F5`)
   - Kiểm tra console browser có lỗi JavaScript không

📘 Hướng dẫn chi tiết: [`HUONG_DAN_AUTO_ASSIGN.md`](./HUONG_DAN_AUTO_ASSIGN.md)

### Q10: Auto-Assign Analyze không tìm thấy bài học nào?
**A:** **Pattern Regex không khớp** với tên thư mục con. Debug steps:
1. Xem lại tên thư mục trong Drive Tree (cột trái)
2. Ví dụ: Tên là "Bài 01", "Bài 02" → Pattern: `^Bài \d+` ✅
3. Ví dụ: Tên là "Lesson 01" → Pattern: `^Lesson \d+` ✅
4. Test pattern tại https://regex101.com/

**Common patterns:**
```regex
^Bài \d+              # Bài 01, Bài 02...
^Lesson \d+           # Lesson 01, Lesson 02...
^\d+[\._\-\s]         # 01_Intro, 02-Grammar, 03 Speaking...
^L\d+                 # L01, L02, L03...
```

### Q11: Kéo thả file vào lesson không hoạt động?
**A:**
1. **Đảm bảo đã Sync Drive**: File phải có trong Drive Tree (cột trái)
2. **Kéo từ đúng vị trí**: Từ **Drive Tree (trái)** → Lesson trong **Curated Courses (phải)**
3. **Thả vào đúng vị trí**: Thả vào khung lesson (màu nền sẽ đổi sang màu indigo khi drop zone active)
4. **Browser compatibility**: Drag & drop chỉ hoạt động trên desktop, không support mobile

---

## 🎓 Learner Experience

### Q12: Video không phát được - "This video is private"?
**A:** **Lỗi quyền truy cập Google Drive**. Giải pháp:
1. Đảm bảo tài khoản Google trong browser đã **đăng nhập**
2. Tài khoản đó phải có **quyền xem** file video trên Drive
3. Trong Drive, right-click file → **Share** → Set to "Anyone with the link can view"
4. Refresh lại trang học (F5)

### Q13: Video bị giật, lag, load chậm?
**A:**
1. **Kết nối mạng**: Kiểm tra internet speed (cần ≥5 Mbps cho 720p)
2. **Google Drive quota**: Nếu video lượt xem quá nhiều, Drive có thể throttle → Chờ 24h hoặc dùng YouTube
3. **Browser cache**: Clear cache (`Ctrl + Shift + Del`) và thử lại
4. **Quality**: Trong iframe Drive, click ⚙️ → Chọn quality thấp hơn (480p thay vì 1080p)

### Q14: Tôi đã xem video đến phút 10 nhưng quay lại vẫn bắt đầu từ 00:00?
**A:** ✅ **ĐÃ FIX** trong version hiện tại!
- Feature: Auto-save playback position mỗi 5 giây
- Resume: Modal sẽ hỏi "Tiếp tục xem từ phút XX:XX?" khi quay lại
- ⚠️ **Giới hạn**: Do Google Drive iframe không cung cấp API, bạn cần **tự kéo timeline** đến vị trí đã lưu

📹 Chi tiết: [`VIDEO_PROGRESS_TRACKING.md`](./VIDEO_PROGRESS_TRACKING.md)

### Q15: Modal "Tiếp tục xem" không xuất hiện?
**A:** Debug:
1. **Xem đủ lâu chưa?** Cần xem ít nhất **5-10 giây** (hệ thống mới lưu)
2. **Backend có running không?** Check terminal `dotnet run` có lỗi không
3. **Browser console** (F12) → Tab Console → Có lỗi `POST /api/progress/playback` không?
4. **Database**: 
```sql
SELECT * FROM "LessonProgresses" WHERE "LessonId" = 'YOUR-LESSON-ID';
-- Phải có row với LastPlaybackPositionSeconds > 0
```

### Q16: Kanji Canvas không hiển thị stroke order?
**A:**
1. **CDN down**: KanjiCanvas dùng CDN `kanjivg.tagaini.net` → Nếu CDN chết, stroke không load được
2. **Kanji không có data**: Một số Kanji hiếm không có trong KanjiVG database
3. **Fallback**: Hệ thống sẽ hiển thị chữ Kanji tĩnh thay vì animation

---

## 🎯 SRS Flashcard System

### Q17: SRS là gì? Hoạt động thế nào?
**A:** **SRS = Spaced Repetition System** (Ôn tập ngắt quãng)
- Thuật toán: **SM-2 (SuperMemo 2)**
- Cơ chế: Từ vựng bạn nhớ tốt → Xuất hiện ít hơn (interval tăng)
- Từ vựng bạn quên → Xuất hiện thường xuyên hơn (interval giảm)

**Review intervals:**
```
Again:  1 day  → 1 day  → 1 day ...   (reset)
Hard:   1 day  → 2 days → 4 days ...  (slow growth)
Good:   1 day  → 3 days → 7 days ...  (normal)
Easy:   1 day  → 4 days → 14 days ... (fast growth)
```

### Q18: Tôi click "+" để add từ vào SRS nhưng không có phản hồi?
**A:**
1. **Đợi 1-2 giây**: Icon sẽ đổi từ "+" → loading spinner → "✓"
2. **Nếu vẫn stuck ở loading**: Backend có thể lỗi → Check console
3. **Verify**: Vào trang `/srs` → Từ vừa add phải xuất hiện trong "Due Today"

### Q19: Làm sao để xóa từ khỏi SRS deck?
**A:** Hiện tại **chưa có UI** để xóa (roadmap Q1 2027). Workaround:
1. Truy cập database:
```sql
DELETE FROM "ReviewSchedules" 
WHERE "VocabularyEntryId" = 'YOUR-VOCAB-ID';
```
2. Hoặc đợi update có nút "Remove from SRS"

---

## 🛠️ Technical Issues

### Q20: Làm sao để chạy project ở chế độ production?
**A:**
```bash
# Backend
cd src/NihongoLms.Api
dotnet publish -c Release -o ./publish
cd publish
dotnet NihongoLms.Api.dll

# Frontend
cd frontend
npm run build
npm start  # hoặc serve với nginx/IIS
```

### Q21: Dark mode không hoạt động?
**A:**
1. **Kiểm tra theme provider**: `src/lib/theme.tsx` có được import vào `layout.tsx` không?
2. **Toggle**: Hiện tại có thể toggle qua browser DevTools hoặc OS settings
3. **Manual**: Thêm class `dark` vào `<html>` element

### Q22: Tailwind CSS không work - class không có style?
**A:**
1. **Check `tailwind.config.ts`**: 
```typescript
content: [
  "./src/**/*.{js,ts,jsx,tsx,mdx}",
],
```
2. **Restart dev server**: `npm run dev` lại
3. **Clear .next cache**: `rm -rf .next` (Windows: `rmdir /s .next`)

### Q23: API call bị CORS error?
**A:** Backend phải enable CORS. Trong `Program.cs`:
```csharp
builder.Services.AddCors(options => {
  options.AddPolicy("AllowFrontend", policy => {
    policy.WithOrigins("http://localhost:3000")
          .AllowAnyMethod()
          .AllowAnyHeader();
  });
});

// ...

app.UseCors("AllowFrontend");
```

---

## 📱 Mobile & Responsive

### Q24: UI bị vỡ layout trên mobile?
**A:**
1. **Drag & Drop**: Không support mobile → Dùng click-to-assign thay vì kéo thả
2. **Long lesson titles**: Truncate bằng CSS `truncate` class
3. **Theater Mode**: Khuyên dùng landscape mode (xoay ngang) để xem video

### Q25: Touch gestures không hoạt động?
**A:** Drag & Drop sử dụng mouse events, không support touch. Roadmap:
- Q2 2027: Touch gestures cho mobile
- Hiện tại: Dùng desktop để quản lý admin panel

---

## 🚀 Performance

### Q26: Builder CMS load rất chậm (>10 giây)?
**A:**
1. **Quá nhiều nodes**: Drive Tree có 1000+ files → Filter hoặc chia nhỏ folder
2. **Backend slow**: PostgreSQL index missing → Chạy:
```sql
CREATE INDEX idx_lessons_sectionid ON "Lessons"("SectionId");
CREATE INDEX idx_resources_lessonid ON "Resources"("LessonId");
```
3. **Frontend bundle size**: Kiểm tra `npm run build` output → Bundle > 1MB?

### Q27: Database quá lớn, làm sao optimize?
**A:**
1. **Vacuum**: 
```sql
VACUUM ANALYZE;
```
2. **Archive old progress**:
```sql
-- Move data > 1 year old to archive table
CREATE TABLE "LessonProgresses_Archive" AS 
SELECT * FROM "LessonProgresses" 
WHERE "LastAccessedAtUtc" < NOW() - INTERVAL '1 year';

DELETE FROM "LessonProgresses" 
WHERE "LastAccessedAtUtc" < NOW() - INTERVAL '1 year';
```
3. **Partitioning**: Split table by year (advanced)

---

## 📊 Analytics & Reporting

### Q28: Làm sao để xem thống kê học viên?
**A:** Hiện tại **chưa có UI dashboard**. Query SQL:
```sql
-- Top 10 học viên active nhất
SELECT "UserId", COUNT(*) as lessons_completed
FROM "LessonProgresses"
WHERE "IsCompleted" = true
GROUP BY "UserId"
ORDER BY lessons_completed DESC
LIMIT 10;

-- Lesson nào khó nhất (drop-off rate cao)
SELECT l."Title", 
       COUNT(DISTINCT lp."UserId") as started,
       COUNT(DISTINCT CASE WHEN lp."IsCompleted" THEN lp."UserId" END) as completed,
       (1.0 - COUNT(DISTINCT CASE WHEN lp."IsCompleted" THEN lp."UserId" END)::float / COUNT(DISTINCT lp."UserId")) * 100 as drop_rate
FROM "Lessons" l
LEFT JOIN "LessonProgresses" lp ON l."Id" = lp."LessonId"
GROUP BY l."Id", l."Title"
ORDER BY drop_rate DESC
LIMIT 10;
```

### Q29: Export dữ liệu học viên ra Excel?
**A:** Sử dụng `pg_dump` hoặc query → CSV:
```bash
psql -h localhost -U postgres -d nihongo_lms -c "
  COPY (SELECT * FROM \"LessonProgresses\") 
  TO '/tmp/progress.csv' 
  WITH CSV HEADER;
"
```

---

## 🔐 Security

### Q30: Làm sao để secure production deployment?
**A:**
1. **HTTPS**: Bắt buộc phải dùng SSL certificate (Let's Encrypt miễn phí)
2. **Environment variables**: Không hardcode secrets trong code
3. **Database**: Không expose PostgreSQL port ra internet (chỉ localhost)
4. **OAuth**: Google OAuth redirect URI phải match chính xác
5. **Rate limiting**: Thêm middleware chống spam API

### Q31: User authentication ở đâu?
**A:** Hiện tại hệ thống dùng **hardcoded user** (`default-user`). Roadmap:
- Q2 2027: Full auth system (JWT tokens, roles, permissions)
- Hiện tại: Dùng Google OAuth chỉ để access Drive, không phải user management

---

## 🆘 Emergency Troubleshooting

### Q32: Hệ thống bị crash hoàn toàn, làm sao?
**A:**
1. **Backend crash**: 
   - Check logs: `logs/app.log` hoặc terminal output
   - Restart: `dotnet run`
2. **Frontend crash**:
   - Clear cache: `rm -rf .next`
   - Reinstall: `rm -rf node_modules && npm install`
   - Restart: `npm run dev`
3. **Database corrupt**:
   - Backup: `pg_dump nihongo_lms > backup.sql`
   - Drop & recreate: `dropdb nihongo_lms && createdb nihongo_lms`
   - Restore: `psql nihongo_lms < backup.sql`

### Q33: Tất cả bài học bị mất sau khi Sync Drive?
**A:** **KHÔNG tự động xóa**. Nếu mất:
1. **Rollback database**: Restore từ backup gần nhất
2. **Check soft delete**: 
```sql
SELECT * FROM "Lessons" WHERE "IsDeleted" = true;  -- Nếu có soft delete
```
3. **Contact support**: Báo bug ngay lập tức

---

## 📞 Support & Community

### Q34: Tôi gặp bug chưa có trong FAQ, làm sao?
**A:**
1. **GitHub Issues**: https://github.com/nihongo-drive-lms/issues
2. **Email**: tranquangphong232@gmail.com
3. **Discord**: https://discord.gg/84FUJWUR6s

**Khi báo bug, gửi kèm:**
- Browser & version (Chrome 120, Firefox 121...)
- Steps to reproduce (các bước gây ra lỗi)
- Screenshot / video
- Console errors (F12 → Console tab)

### Q35: Tôi muốn đóng góp code, làm sao?
**A:**
1. Fork repository: https://github.com/nihongo-drive-lms
2. Clone về local: `git clone https://github.com/YOUR-USERNAME/nihongo-drive-lms`
3. Create branch: `git checkout -b feature/AmazingFeature`
4. Code & commit: `git commit -m 'Add AmazingFeature'`
5. Push: `git push origin feature/AmazingFeature`
6. Open Pull Request trên GitHub

**Contribution guidelines**: Xem file `CONTRIBUTING.md` (nếu có)

---

## 🎉 Bonus Tips

### Tip #1: Keyboard Shortcuts (Planned Q2 2027)
```
Space       - Play/Pause video
Arrow Left  - Rewind 5s
Arrow Right - Forward 5s
F           - Fullscreen
M           - Mute
```

### Tip #2: Optimize Drive Storage
- Nén video trước khi upload: 720p H.264 = chất lượng tốt + kích thước nhỏ
- Dùng Handbrake (miễn phí) để nén: https://handbrake.fr/

### Tip #3: Batch Upload
- Thay vì upload từng file, upload cả folder vào Drive
- Sync 1 lần → Auto-Assign → Tiết kiệm thời gian

---

**🙋 Vẫn còn thắc mắc? Hỏi trực tiếp trên Discord hoặc GitHub Issues!**

📚 **Tài liệu liên quan:**
- [`README_VI.md`](./README_VI.md) - Overview & setup guide
- [`HUONG_DAN_AUTO_ASSIGN.md`](./HUONG_DAN_AUTO_ASSIGN.md) - Auto-assign tutorial
- [`VIDEO_PROGRESS_TRACKING.md`](./VIDEO_PROGRESS_TRACKING.md) - Playback tracking details
- [`FIXED_ISSUES_SUMMARY.md`](./FIXED_ISSUES_SUMMARY.md) - Recent bug fixes
- [`TESTING_CHECKLIST.md`](./TESTING_CHECKLIST.md) - QA checklist

**Happy learning! がんばって！🎌**
