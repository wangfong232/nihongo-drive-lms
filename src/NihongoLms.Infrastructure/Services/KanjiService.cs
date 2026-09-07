using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class KanjiService : IKanjiService
{
    private readonly LmsDbContext _dbContext;

    public KanjiService(LmsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<List<KanjiItemDto>> GetAllKanjisAsync(string? jlptLevel, string? search, string? radical, CancellationToken cancellationToken = default)
    {
        var list = MasterKanjiDataset.AllKanjis.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(jlptLevel))
        {
            var level = jlptLevel.Trim().ToUpperInvariant();
            list = list.Where(k => k.Jlpt.ToUpperInvariant() == level);
        }

        if (!string.IsNullOrWhiteSpace(radical))
        {
            list = list.Where(k => k.Radical == radical || k.RadicalName.Contains(radical, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            list = list.Where(k =>
                k.Character.Contains(s) ||
                k.HanViet.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                k.Meaning.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                k.Onyomi.Any(o => o.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                k.Kunyomi.Any(u => u.Contains(s, StringComparison.OrdinalIgnoreCase)));
        }

        return Task.FromResult(list.ToList());
    }

    public async Task<LessonKanjisResponseDto> GetKanjisByLessonAsync(Guid lessonId, CancellationToken cancellationToken = default)
    {
        // Bước 1: Kiểm tra xem bài học có từ vựng / kanji được gán trực tiếp hay không
        var directVocabs = await _dbContext.VocabularyEntries
            .AsNoTracking()
            .Where(v => v.LessonId == lessonId)
            .ToListAsync(cancellationToken);

        if (directVocabs.Count > 0)
        {
            var kanjiRegex = new Regex(@"[\u4e00-\u9faf\u3400-\u4dbf]");
            var foundChars = new HashSet<string>();
            foreach (var v in directVocabs)
            {
                var matches = kanjiRegex.Matches(v.Word);
                foreach (Match m in matches)
                {
                    foundChars.Add(m.Value);
                }
            }

            if (foundChars.Count > 0)
            {
                var matchedKanjis = MasterKanjiDataset.AllKanjis
                    .Where(k => foundChars.Contains(k.Character))
                    .Select(k => new KanjiItemDto
                    {
                        Id = k.Id,
                        Character = k.Character,
                        HanViet = k.HanViet,
                        Meaning = k.Meaning,
                        Onyomi = k.Onyomi,
                        Kunyomi = k.Kunyomi,
                        StrokeCount = k.StrokeCount,
                        Jlpt = k.Jlpt,
                        Radical = k.Radical,
                        RadicalName = k.RadicalName,
                        Examples = k.Examples,
                        IsFallback = false
                    })
                    .ToList();

                if (matchedKanjis.Count > 0)
                {
                    return new LessonKanjisResponseDto
                    {
                        LessonId = lessonId,
                        CourseLevel = matchedKanjis[0].Jlpt,
                        IsFallback = false,
                        Items = matchedKanjis
                    };
                }
            }
        }

        // Bước 2: Nếu không có (count == 0), lấy thông tin JlptLevel của Course cha
        var lessonInfo = await _dbContext.Lessons
            .AsNoTracking()
            .Include(l => l.Section)
            .ThenInclude(s => s.Course)
            .FirstOrDefaultAsync(l => l.Id == lessonId, cancellationToken);

        var courseLevel = (lessonInfo?.Section?.Course?.JlptLevel ?? "N3").Trim().ToUpperInvariant();
        if (!courseLevel.StartsWith("N") || courseLevel.Length < 2)
        {
            courseLevel = "N3";
        }

        // Bước 3: Bốc ngẫu nhiên 10 mục Kanji từ kho tổng theo JlptLevel của Course
        var pool = MasterKanjiDataset.AllKanjis
            .Where(k => k.Jlpt.ToUpperInvariant() == courseLevel)
            .ToList();

        if (pool.Count == 0)
        {
            pool = MasterKanjiDataset.AllKanjis.ToList();
        }

        var random = new Random();
        var random10 = pool
            .OrderBy(_ => random.Next())
            .Take(10)
            .Select(k => new KanjiItemDto
            {
                Id = k.Id,
                Character = k.Character,
                HanViet = k.HanViet,
                Meaning = k.Meaning,
                Onyomi = k.Onyomi,
                Kunyomi = k.Kunyomi,
                StrokeCount = k.StrokeCount,
                Jlpt = k.Jlpt,
                Radical = k.Radical,
                RadicalName = k.RadicalName,
                Examples = k.Examples,
                IsFallback = true
            })
            .ToList();

        return new LessonKanjisResponseDto
        {
            LessonId = lessonId,
            CourseLevel = courseLevel,
            IsFallback = true,
            Items = random10
        };
    }
}

public static class MasterKanjiDataset
{
    public static readonly List<KanjiItemDto> AllKanjis = new()
    {
        // ─── JLPT N5 ──────────────────────────────────────────
        new() { Id = "n5-nichi", Character = "日", HanViet = "NHẬT", Meaning = "Mặt trời, ngày, Nhật Bản", Onyomi = new() { "ニチ", "ジツ" }, Kunyomi = new() { "ひ", "-び", "-か" }, StrokeCount = 4, Jlpt = "N5", Radical = "日", RadicalName = "Bộ Nhật", Examples = new() { new() { Word = "日本", Reading = "にほん", Meaning = "Nước Nhật Bản" }, new() { Word = "日曜日", Reading = "にちようび", Meaning = "Chủ nhật" } } },
        new() { Id = "n5-hon", Character = "本", HanViet = "BẢN / BỔN", Meaning = "Sách, gốc rễ, nguồn gốc", Onyomi = new() { "ホン" }, Kunyomi = new() { "もと" }, StrokeCount = 5, Jlpt = "N5", Radical = "木", RadicalName = "Bộ Mộc", Examples = new() { new() { Word = "本", Reading = "ほん", Meaning = "Quyển sách" }, new() { Word = "本当", Reading = "ほんとう", Meaning = "Sự thật" } } },
        new() { Id = "n5-jin", Character = "人", HanViet = "NHÂN", Meaning = "Người, nhân loại", Onyomi = new() { "ジン", "ニン" }, Kunyomi = new() { "ひと" }, StrokeCount = 2, Jlpt = "N5", Radical = "人", RadicalName = "Bộ Nhân", Examples = new() { new() { Word = "日本人", Reading = "にほんじん", Meaning = "Người Nhật" }, new() { Word = "三人", Reading = "さんにん", Meaning = "Ba người" } } },
        new() { Id = "n5-tsuki", Character = "月", HanViet = "NGUYỆT", Meaning = "Mặt trăng, tháng", Onyomi = new() { "ゲツ", "ガツ" }, Kunyomi = new() { "つき" }, StrokeCount = 4, Jlpt = "N5", Radical = "月", RadicalName = "Bộ Nguyệt", Examples = new() { new() { Word = "月曜日", Reading = "げつようび", Meaning = "Thứ hai" }, new() { Word = "今月", Reading = "こんげつ", Meaning = "Tháng này" } } },
        new() { Id = "n5-hi", Character = "火", HanViet = "HỎA", Meaning = "Lửa, hỏa", Onyomi = new() { "カ" }, Kunyomi = new() { "ひ" }, StrokeCount = 4, Jlpt = "N5", Radical = "火", RadicalName = "Bộ Hỏa", Examples = new() { new() { Word = "火曜日", Reading = "かようび", Meaning = "Thứ ba" }, new() { Word = "花火", Reading = "はなび", Meaning = "Pháo hoa" } } },
        new() { Id = "n5-mizu", Character = "水", HanViet = "THỦY", Meaning = "Nước", Onyomi = new() { "スイ" }, Kunyomi = new() { "みず" }, StrokeCount = 4, Jlpt = "N5", Radical = "水", RadicalName = "Bộ Thủy", Examples = new() { new() { Word = "水曜日", Reading = "すいようび", Meaning = "Thứ tư" }, new() { Word = "水着", Reading = "みずぎ", Meaning = "Đồ bơi" } } },
        new() { Id = "n5-ki", Character = "木", HanViet = "MỘC", Meaning = "Cây cối, gỗ", Onyomi = new() { "モク", "ボク" }, Kunyomi = new() { "き", "こ-" }, StrokeCount = 4, Jlpt = "N5", Radical = "木", RadicalName = "Bộ Mộc", Examples = new() { new() { Word = "木曜日", Reading = "もくようび", Meaning = "Thứ năm" }, new() { Word = "木村", Reading = "きむら", Meaning = "Họ Kimura" } } },
        new() { Id = "n5-kin", Character = "金", HanViet = "KIM", Meaning = "Vàng, tiền bạc, kim loại", Onyomi = new() { "キン", "コン" }, Kunyomi = new() { "かね" }, StrokeCount = 8, Jlpt = "N5", Radical = "金", RadicalName = "Bộ Kim", Examples = new() { new() { Word = "お金", Reading = "おかね", Meaning = "Tiền bạc" }, new() { Word = "金曜日", Reading = "きんようび", Meaning = "Thứ sáu" } } },
        new() { Id = "n5-tsuchi", Character = "土", HanViet = "THỔ", Meaning = "Đất đai, thổ nhưỡng", Onyomi = new() { "ド", "ト" }, Kunyomi = new() { "つち" }, StrokeCount = 3, Jlpt = "N5", Radical = "土", RadicalName = "Bộ Thổ", Examples = new() { new() { Word = "土曜日", Reading = "どようび", Meaning = "Thứ bảy" }, new() { Word = "土地", Reading = "とち", Meaning = "Đất đai" } } },
        new() { Id = "n5-gaku", Character = "学", HanViet = "HỌC", Meaning = "Học tập, trường học", Onyomi = new() { "ガク" }, Kunyomi = new() { "まな・ぶ" }, StrokeCount = 8, Jlpt = "N5", Radical = "子", RadicalName = "Bộ Tử", Examples = new() { new() { Word = "学生", Reading = "がくせい", Meaning = "Học sinh, sinh viên" }, new() { Word = "大学", Reading = "だいがく", Meaning = "Trường đại học" } } },
        new() { Id = "n5-sei", Character = "生", HanViet = "SINH", Meaning = "Sinh sống, sinh ra, sống", Onyomi = new() { "セイ", "ショウ" }, Kunyomi = new() { "い・きる", "う・まれる", "なま" }, StrokeCount = 5, Jlpt = "N5", Radical = "生", RadicalName = "Bộ Sinh", Examples = new() { new() { Word = "先生", Reading = "せんせい", Meaning = "Thầy cô giáo" }, new() { Word = "生活", Reading = "せいかつ", Meaning = "Sinh hoạt, cuộc sống" } } },
        new() { Id = "n5-sen", Character = "先", HanViet = "TIÊN", Meaning = "Trước, đi trước, tương lai", Onyomi = new() { "セン" }, Kunyomi = new() { "さき" }, StrokeCount = 6, Jlpt = "N5", Radical = "儿", RadicalName = "Bộ Nhân đi", Examples = new() { new() { Word = "先生", Reading = "せんせい", Meaning = "Thầy cô giáo" }, new() { Word = "先週", Reading = "せんしゅう", Meaning = "Tuần trước" } } },
        new() { Id = "n5-sen-watashi", Character = "私", HanViet = "TƯ", Meaning = "Tôi, riêng tư, cá nhân", Onyomi = new() { "シ" }, Kunyomi = new() { "わたし", "わたくし" }, StrokeCount = 7, Jlpt = "N5", Radical = "禾", RadicalName = "Bộ Hòa", Examples = new() { new() { Word = "私", Reading = "わたし", Meaning = "Tôi" }, new() { Word = "私立", Reading = "しりつ", Meaning = "Tư lập" } } },

        // ─── JLPT N4 ──────────────────────────────────────────
        new() { Id = "n4-ryo", Character = "旅", HanViet = "LỮ", Meaning = "Du lịch, lữ hành", Onyomi = new() { "リョ" }, Kunyomi = new() { "たび" }, StrokeCount = 10, Jlpt = "N4", Radical = "方", RadicalName = "Bộ Phương", Examples = new() { new() { Word = "旅行", Reading = "りょこう", Meaning = "Du lịch" }, new() { Word = "一人旅", Reading = "ひとりたび", Meaning = "Du lịch một mình" } } },
        new() { Id = "n4-kan", Character = "館", HanViet = "QUÁN", Meaning = "Tòa nhà công cộng, bảo tàng", Onyomi = new() { "カン" }, Kunyomi = new() { "やかた" }, StrokeCount = 16, Jlpt = "N4", Radical = "食", RadicalName = "Bộ Thực", Examples = new() { new() { Word = "図書館", Reading = "としょかん", Meaning = "Thư viện" }, new() { Word = "映画館", Reading = "えいがかん", Meaning = "Rạp chiếu phim" } } },
        new() { Id = "n4-shitsu", Character = "質", HanViet = "CHẤT", Meaning = "Chất lượng, phẩm chất, hỏi", Onyomi = new() { "シツ", "シチ" }, Kunyomi = new() { "たち", "ただ・す" }, StrokeCount = 15, Jlpt = "N4", Radical = "貝", RadicalName = "Bộ Bối", Examples = new() { new() { Word = "質問", Reading = "しつもん", Meaning = "Câu hỏi" }, new() { Word = "品質", Reading = "ひんしつ", Meaning = "Chất lượng sản phẩm" } } },
        new() { Id = "n4-mon", Character = "問", HanViet = "VẤN", Meaning = "Hỏi, vấn đề", Onyomi = new() { "モン" }, Kunyomi = new() { "と・う", "と・い" }, StrokeCount = 11, Jlpt = "N4", Radical = "口", RadicalName = "Bộ Khẩu", Examples = new() { new() { Word = "問題", Reading = "もんだい", Meaning = "Vấn đề, bài tập" }, new() { Word = "質問", Reading = "しつもん", Meaning = "Câu hỏi" } } },
        new() { Id = "n4-shuku", Character = "宿", HanViet = "TÚC", Meaning = "Trọ, ở lại, bài tập về nhà", Onyomi = new() { "シュク" }, Kunyomi = new() { "やど", "やど・る" }, StrokeCount = 11, Jlpt = "N4", Radical = "宀", RadicalName = "Bộ Miên", Examples = new() { new() { Word = "宿題", Reading = "しゅくだい", Meaning = "Bài tập về nhà" }, new() { Word = "宿泊", Reading = "しゅくはく", Meaning = "Trọ lại" } } },
        new() { Id = "n4-dai", Character = "題", HanViet = "ĐỀ", Meaning = "Đề mục, chủ đề", Onyomi = new() { "ダイ" }, Kunyomi = new() { }, StrokeCount = 18, Jlpt = "N4", Radical = "頁", RadicalName = "Bộ Hiệt", Examples = new() { new() { Word = "問題", Reading = "もんだい", Meaning = "Vấn đề" }, new() { Word = "話題", Reading = "わだい", Meaning = "Chủ đề câu chuyện" } } },
        new() { Id = "n4-fuku", Character = "復", HanViet = "PHỤC", Meaning = "Lặp lại, phục hồi, ôn tập", Onyomi = new() { "フク" }, Kunyomi = new() { }, StrokeCount = 12, Jlpt = "N4", Radical = "彳", RadicalName = "Bộ Xích", Examples = new() { new() { Word = "復習", Reading = "ふくしゅう", Meaning = "Ôn tập bài cũ" }, new() { Word = "回復", Reading = "かいふく", Meaning = "Hồi phục sức khỏe" } } },
        new() { Id = "n4-shu", Character = "習", HanViet = "TẬP", Meaning = "Luyện tập, học tập", Onyomi = new() { "シュウ" }, Kunyomi = new() { "なら・う" }, StrokeCount = 11, Jlpt = "N4", Radical = "羽", RadicalName = "Bộ Vũ", Examples = new() { new() { Word = "練習", Reading = "れんしゅう", Meaning = "Luyện tập" }, new() { Word = "習字", Reading = "しゅうじ", Meaning = "Luyện viết chữ đẹp" } } },
        new() { Id = "n4-ren", Character = "練", HanViet = "LUYỆN", Meaning = "Rèn luyện, trau dồi", Onyomi = new() { "レン" }, Kunyomi = new() { "ね・る" }, StrokeCount = 14, Jlpt = "N4", Radical = "糸", RadicalName = "Bộ Mịch", Examples = new() { new() { Word = "練習", Reading = "れんしゅう", Meaning = "Luyện tập" }, new() { Word = "訓練", Reading = "くんれん", Meaning = "Huấn luyện" } } },
        new() { Id = "n4-shin", Character = "親", HanViet = "THÂN", Meaning = "Cha mẹ, thân thiết, gần gũi", Onyomi = new() { "シン" }, Kunyomi = new() { "おや", "した・しい" }, StrokeCount = 16, Jlpt = "N4", Radical = "見", RadicalName = "Bộ Kiến", Examples = new() { new() { Word = "両親", Reading = "りょうしん", Meaning = "Bố mẹ" }, new() { Word = "親切", Reading = "しんせつ", Meaning = "Thân thiện, tốt bụng" } } },
        new() { Id = "n4-setsu", Character = "切", HanViet = "THIẾT", Meaning = "Cắt, khẩn cấp, thân thiết", Onyomi = new() { "セツ", "サイ" }, Kunyomi = new() { "き・る" }, StrokeCount = 4, Jlpt = "N4", Radical = "刀", RadicalName = "Bộ Đao", Examples = new() { new() { Word = "親切", Reading = "しんせつ", Meaning = "Tốt bụng" }, new() { Word = "大切", Reading = "たいせつ", Meaning = "Quan trọng" } } },
        new() { Id = "n4-bin", Character = "便", HanViet = "TIỆN", Meaning = "Thuận tiện, thư tín, chuyến bay", Onyomi = new() { "ベン", "ビン" }, Kunyomi = new() { "たよ・り" }, StrokeCount = 9, Jlpt = "N4", Radical = "人", RadicalName = "Bộ Nhân", Examples = new() { new() { Word = "便利", Reading = "べんり", Meaning = "Tiện lợi" }, new() { Word = "航空便", Reading = "こうくうびん", Meaning = "Thư gửi đường hàng không" } } },

        // ─── JLPT N3 ──────────────────────────────────────────
        new() { Id = "n3-kei", Character = "経", HanViet = "KINH", Meaning = "Trải qua, kinh tế, kinh nghiệm", Onyomi = new() { "ケイ", "キョウ" }, Kunyomi = new() { "へ・る" }, StrokeCount = 11, Jlpt = "N3", Radical = "糸", RadicalName = "Bộ Mịch", Examples = new() { new() { Word = "経験", Reading = "けいけん", Meaning = "Kinh nghiệm" }, new() { Word = "経済", Reading = "けいざい", Meaning = "Kinh tế" } } },
        new() { Id = "n3-ken", Character = "験", HanViet = "NGHIỆM", Meaning = "Thí nghiệm, kiểm nghiệm, thi cử", Onyomi = new() { "ケン", "ゲン" }, Kunyomi = new() { "ため・す" }, StrokeCount = 18, Jlpt = "N3", Radical = "馬", RadicalName = "Bộ Mã", Examples = new() { new() { Word = "試験", Reading = "しけん", Meaning = "Kỳ thi" }, new() { Word = "実験", Reading = "じっけん", Meaning = "Thực nghiệm" } } },
        new() { Id = "n3-ki", Character = "機", HanViet = "CƠ", Meaning = "Máy móc, cơ hội, thời cơ", Onyomi = new() { "キ" }, Kunyomi = new() { "はた" }, StrokeCount = 16, Jlpt = "N3", Radical = "木", RadicalName = "Bộ Mộc", Examples = new() { new() { Word = "機会", Reading = "きかい", Meaning = "Cơ hội" }, new() { Word = "飛行機", Reading = "ひこうき", Meaning = "Máy bay" } } },
        new() { Id = "n3-kan", Character = "環", HanViet = "HOÀN", Meaning = "Vòng quanh, môi trường, tuần hoàn", Onyomi = new() { "カン" }, Kunyomi = new() { "わ" }, StrokeCount = 17, Jlpt = "N3", Radical = "玉", RadicalName = "Bộ Ngọc", Examples = new() { new() { Word = "環境", Reading = "かんきょう", Meaning = "Môi trường" }, new() { Word = "循環", Reading = "じゅんかん", Meaning = "Tuần hoàn" } } },
        new() { Id = "n3-kyo", Character = "境", HanViet = "CẢNH", Meaning = "Ranh giới, hoàn cảnh, cảnh giới", Onyomi = new() { "キョウ", "ケイ" }, Kunyomi = new() { "さかい" }, StrokeCount = 14, Jlpt = "N3", Radical = "土", RadicalName = "Bộ Thổ", Examples = new() { new() { Word = "国境", Reading = "こっきょう", Meaning = "Biên giới quốc gia" }, new() { Word = "境目", Reading = "さかいめ", Meaning = "Ranh giới" } } },
        new() { Id = "n3-sou", Character = "想", HanViet = "TƯỞNG", Meaning = "Tưởng tượng, tư tưởng, ý tưởng", Onyomi = new() { "ソウ", "ソ" }, Kunyomi = new() { "おも・う" }, StrokeCount = 13, Jlpt = "N3", Radical = "心", RadicalName = "Bộ Tâm", Examples = new() { new() { Word = "想像", Reading = "そうぞう", Meaning = "Tưởng tượng" }, new() { Word = "感想", Reading = "かんそう", Meaning = "Cảm tưởng" } } },
        new() { Id = "n3-zo", Character = "像", HanViet = "TƯỢNG", Meaning = "Hình tượng, bức tượng, hình ảnh", Onyomi = new() { "ゾウ" }, Kunyomi = new() { }, StrokeCount = 14, Jlpt = "N3", Radical = "人", RadicalName = "Bộ Nhân", Examples = new() { new() { Word = "映像", Reading = "えいぞう", Meaning = "Hình ảnh video" }, new() { Word = "仏像", Reading = "ぶつぞう", Meaning = "Tượng Phật" } } },
        new() { Id = "n3-kan-feel", Character = "感", HanViet = "CẢM", Meaning = "Cảm giác, cảm xúc, cảm ơn", Onyomi = new() { "カン" }, Kunyomi = new() { }, StrokeCount = 13, Jlpt = "N3", Radical = "心", RadicalName = "Bộ Tâm", Examples = new() { new() { Word = "感謝", Reading = "かんしゃ", Meaning = "Cảm tạ, biết ơn" }, new() { Word = "感情", Reading = "かんじょう", Meaning = "Cảm xúc" } } },
        new() { Id = "n3-tatsu", Character = "達", HanViet = "ĐẠT", Meaning = "Thành đạt, truyền đạt, số nhiều", Onyomi = new() { "タツ" }, Kunyomi = new() { "-たち" }, StrokeCount = 12, Jlpt = "N3", Radical = "辶", RadicalName = "Bộ Sước", Examples = new() { new() { Word = "友達", Reading = "ともだち", Meaning = "Bạn bè" }, new() { Word = "配達", Reading = "はいたつ", Meaning = "Giao hàng" } } },
        new() { Id = "n3-do", Character = "努", HanViet = "NỖ", Meaning = "Nỗ lực, gắng sức", Onyomi = new() { "ド" }, Kunyomi = new() { "つと・める" }, StrokeCount = 7, Jlpt = "N3", Radical = "力", RadicalName = "Bộ Lực", Examples = new() { new() { Word = "努力", Reading = "どりょく", Meaning = "Nỗ lực" }, new() { Word = "努める", Reading = "つとめる", Meaning = "Cố gắng hết sức" } } },
        new() { Id = "n3-ryoku", Character = "力", HanViet = "LỰC", Meaning = "Sức mạnh, năng lực", Onyomi = new() { "リョク", "リキ" }, Kunyomi = new() { "ちから" }, StrokeCount = 2, Jlpt = "N3", Radical = "力", RadicalName = "Bộ Lực", Examples = new() { new() { Word = "能力", Reading = "のうりょく", Meaning = "Năng lực" }, new() { Word = "体力", Reading = "たいりょく", Meaning = "Thể lực" } } },
        new() { Id = "n3-kyou", Character = "協", HanViet = "HIỆP", Meaning = "Hợp tác, hiệp lực, đồng lòng", Onyomi = new() { "キョウ" }, Kunyomi = new() { }, StrokeCount = 8, Jlpt = "N3", Radical = "十", RadicalName = "Bộ Thập", Examples = new() { new() { Word = "協力", Reading = "きょうりょく", Meaning = "Hợp tác" }, new() { Word = "協会", Reading = "きょうかい", Meaning = "Hiệp hội" } } },

        // ─── JLPT N2 & N1 ─────────────────────────────────────
        new() { Id = "n2-zoku", Character = "属", HanViet = "THUỘC", Meaning = "Thuộc về, trực thuộc", Onyomi = new() { "ゾク" }, Kunyomi = new() { "さかん", "つく" }, StrokeCount = 12, Jlpt = "N2", Radical = "尸", RadicalName = "Bộ Thi", Examples = new() { new() { Word = "所属", Reading = "しょぞく", Meaning = "Trực thuộc" }, new() { Word = "金属", Reading = "きんぞく", Meaning = "Kim loại" } } },
        new() { Id = "n2-kou", Character = "構", HanViet = "CẤU", Meaning = "Cấu tạo, kết cấu, cấu trúc", Onyomi = new() { "コウ" }, Kunyomi = new() { "かま・える", "かま・う" }, StrokeCount = 14, Jlpt = "N2", Radical = "木", RadicalName = "Bộ Mộc", Examples = new() { new() { Word = "構造", Reading = "こうぞう", Meaning = "Cấu trúc" }, new() { Word = "構成", Reading = "こうせい", Meaning = "Cấu thành" } } },
        new() { Id = "n2-zou", Character = "造", HanViet = "TẠO", Meaning = "Chế tạo, sáng tạo, làm ra", Onyomi = new() { "ゾウ" }, Kunyomi = new() { "つく・る" }, StrokeCount = 10, Jlpt = "N2", Radical = "辶", RadicalName = "Bộ Sước", Examples = new() { new() { Word = "製造", Reading = "せいぞう", Meaning = "Chế tạo" }, new() { Word = "造船", Reading = "ぞうせん", Meaning = "Đóng tàu" } } },
        new() { Id = "n1-chou", Character = "緻", HanViet = "TRÍ", Meaning = "Tỉ mỉ, tinh vi, kỹ lưỡng", Onyomi = new() { "チ" }, Kunyomi = new() { }, StrokeCount = 15, Jlpt = "N1", Radical = "糸", RadicalName = "Bộ Mịch", Examples = new() { new() { Word = "緻密", Reading = "ちみつ", Meaning = "Tỉ mỉ, chính xác" }, new() { Word = "精緻", Reading = "せいち", Meaning = "Tinh xảo" } } },
        new() { Id = "n1-mou", Character = "網", HanViet = "VÕNG", Meaning = "Lưới, mạng lưới, bao la", Onyomi = new() { "モウ" }, Kunyomi = new() { "あみ" }, StrokeCount = 14, Jlpt = "N1", Radical = "糸", RadicalName = "Bộ Mịch", Examples = new() { new() { Word = "網羅", Reading = "もうら", Meaning = "Bao quát, thấu triệt" }, new() { Word = "通信網", Reading = "つうしんもう", Meaning = "Mạng lưới truyền thông" } } },
    };
}
