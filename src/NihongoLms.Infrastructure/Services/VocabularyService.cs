using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class VocabularyService : IVocabularyService
{
    private readonly LmsDbContext _dbContext;

    public VocabularyService(LmsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<VocabularyEntryDto>> GetVocabularyAsync(Guid? lessonId, string? jlptLevel, string? search, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.VocabularyEntries
            .AsNoTracking()
            .Include(v => v.Lesson)
            .Include(v => v.AudioDriveNode)
            .Include(v => v.StrokeOrderDriveNode)
            .AsQueryable();

        if (lessonId.HasValue)
        {
            query = query.Where(v => v.LessonId == lessonId.Value);
        }

        if (!string.IsNullOrWhiteSpace(jlptLevel))
        {
            query = query.Where(v => v.JlptLevel == jlptLevel);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(v => v.Word.Contains(search) || v.Reading.Contains(search) || v.Meaning.Contains(search));
        }

        var list = await query.OrderBy(v => v.Word).ToListAsync(cancellationToken);
        return list.Select(MapToDto).ToList();
    }

    public async Task<LessonVocabulariesResponseDto> GetVocabulariesByLessonAsync(Guid lessonId, CancellationToken cancellationToken = default)
    {
        // Bước 1: Kiểm tra xem bài học có từ vựng được gán trực tiếp hay không
        var directVocabs = await _dbContext.VocabularyEntries
            .AsNoTracking()
            .Include(v => v.Lesson)
            .Include(v => v.AudioDriveNode)
            .Include(v => v.StrokeOrderDriveNode)
            .Where(v => v.LessonId == lessonId)
            .OrderBy(v => v.Word)
            .ToListAsync(cancellationToken);

        if (directVocabs.Count > 0)
        {
            var level = directVocabs[0].JlptLevel ?? "N5";
            return new LessonVocabulariesResponseDto
            {
                LessonId = lessonId,
                CourseLevel = level,
                IsFallback = false,
                Items = directVocabs.Select(v => {
                    var dto = MapToDto(v);
                    dto.IsFallback = false;
                    return dto;
                }).ToList()
            };
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

        // Bước 3: Query ngẫu nhiên 10 mục từ kho tổng theo JlptLevel
        var poolItems = await _dbContext.VocabularyEntries
            .AsNoTracking()
            .Include(v => v.AudioDriveNode)
            .Include(v => v.StrokeOrderDriveNode)
            .Where(v => v.JlptLevel.ToUpper() == courseLevel)
            .OrderBy(r => EF.Functions.Random())
            .Take(10)
            .ToListAsync(cancellationToken);

        var resultItems = poolItems.Select(v => {
            var dto = MapToDto(v);
            dto.IsFallback = true;
            return dto;
        }).ToList();

        // Nếu DB chưa có đủ 10 từ của Level này, bổ sung từ kho mẫu chất lượng cao
        if (resultItems.Count < 10)
        {
            var fallbackPool = GetDefaultJlptVocabPool(courseLevel);
            var random = new Random();
            var needed = 10 - resultItems.Count;
            var existingWords = new HashSet<string>(resultItems.Select(x => x.Word));

            var shuffledFallback = fallbackPool
                .Where(x => !existingWords.Contains(x.Word))
                .OrderBy(_ => random.Next())
                .Take(needed)
                .ToList();

            resultItems.AddRange(shuffledFallback);
        }

        return new LessonVocabulariesResponseDto
        {
            LessonId = lessonId,
            CourseLevel = courseLevel,
            IsFallback = true,
            Items = resultItems
        };
    }

    public async Task<VocabularyEntryDto?> GetVocabularyByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await _dbContext.VocabularyEntries
            .AsNoTracking()
            .Include(v => v.Lesson)
            .Include(v => v.AudioDriveNode)
            .Include(v => v.StrokeOrderDriveNode)
            .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);

        return entity != null ? MapToDto(entity) : null;
    }

    public async Task<VocabularyEntryDto> CreateVocabularyAsync(CreateVocabularyEntryDto dto, CancellationToken cancellationToken = default)
    {
        var entity = new VocabularyEntry
        {
            LessonId = dto.LessonId,
            Word = dto.Word,
            Reading = dto.Reading,
            Meaning = dto.Meaning,
            ExampleSentence = dto.ExampleSentence,
            ExampleSentenceTranslation = dto.ExampleSentenceTranslation,
            PartOfSpeech = dto.PartOfSpeech,
            JlptLevel = dto.JlptLevel,
            AudioDriveNodeId = dto.AudioDriveNodeId,
            StrokeOrderDriveNodeId = dto.StrokeOrderDriveNodeId,
            TagsJson = dto.TagsJson,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.VocabularyEntries.Add(entity);

        // Auto-create initial ReviewSchedule entry for single-user SRS pool
        var reviewSchedule = new ReviewSchedule
        {
            UserId = "default-user",
            VocabularyEntry = entity,
            RepetitionCount = 0,
            IntervalDays = 0,
            EaseFactor = 2.5,
            NextReviewDateUtc = DateTime.UtcNow,
            State = Domain.Enums.SrsState.New,
            CreatedAtUtc = DateTime.UtcNow
        };
        _dbContext.ReviewSchedules.Add(reviewSchedule);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(entity);
    }

    public async Task<VocabularyEntryDto> UpdateVocabularyAsync(Guid id, CreateVocabularyEntryDto dto, CancellationToken cancellationToken = default)
    {
        var entity = await _dbContext.VocabularyEntries.FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
        if (entity == null) throw new KeyNotFoundException($"VocabularyEntry {id} not found.");

        entity.LessonId = dto.LessonId;
        entity.Word = dto.Word;
        entity.Reading = dto.Reading;
        entity.Meaning = dto.Meaning;
        entity.ExampleSentence = dto.ExampleSentence;
        entity.ExampleSentenceTranslation = dto.ExampleSentenceTranslation;
        entity.PartOfSpeech = dto.PartOfSpeech;
        entity.JlptLevel = dto.JlptLevel;
        entity.AudioDriveNodeId = dto.AudioDriveNodeId;
        entity.StrokeOrderDriveNodeId = dto.StrokeOrderDriveNodeId;
        entity.TagsJson = dto.TagsJson;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapToDto(entity);
    }

    public async Task DeleteVocabularyAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await _dbContext.VocabularyEntries.FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
        if (entity != null)
        {
            _dbContext.VocabularyEntries.Remove(entity);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private static VocabularyEntryDto MapToDto(VocabularyEntry v)
    {
        return new VocabularyEntryDto
        {
            Id = v.Id,
            LessonId = v.LessonId,
            LessonTitle = v.Lesson?.Title,
            Word = v.Word,
            Reading = v.Reading,
            Meaning = v.Meaning,
            ExampleSentence = v.ExampleSentence,
            ExampleSentenceTranslation = v.ExampleSentenceTranslation,
            PartOfSpeech = v.PartOfSpeech,
            JlptLevel = v.JlptLevel,
            AudioDriveNodeId = v.AudioDriveNodeId,
            AudioDriveFileId = v.AudioDriveNode?.DriveFileId,
            StrokeOrderDriveNodeId = v.StrokeOrderDriveNodeId,
            StrokeOrderDriveFileId = v.StrokeOrderDriveNode?.DriveFileId,
            TagsJson = v.TagsJson,
            IsFallback = false,
            CreatedAtUtc = v.CreatedAtUtc
        };
    }

    private static List<VocabularyEntryDto> GetDefaultJlptVocabPool(string jlptLevel)
    {
        var level = (jlptLevel ?? "N3").ToUpperInvariant();
        var now = DateTime.UtcNow;

        return level switch
        {
            "N1" => new List<VocabularyEntryDto>
            {
                new() { Id = Guid.NewGuid(), Word = "圧倒的", Reading = "あっとうてき", Meaning = "Áp đảo, vượt trội", ExampleSentence = "圧倒的な強さで優勝を果たした。", ExampleSentenceTranslation = "Giành chức vô địch với sức mạnh áp đảo.", PartOfSpeech = "Tính từ na", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "緻密", Reading = "ちみつ", Meaning = "Tỉ mỉ, chi tiết, chính xác", ExampleSentence = "緻密な計画を立てる。", ExampleSentenceTranslation = "Lập kế hoạch tỉ mỉ.", PartOfSpeech = "Tính từ na", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "網羅", Reading = "もうら", Meaning = "Bao hàm, bao quát toàn bộ", ExampleSentence = "最新の情報を網羅した辞典。", ExampleSentenceTranslation = "Từ điển bao quát thông tin mới nhất.", PartOfSpeech = "Danh từ", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "懸念", Reading = "けねん", Meaning = "Lo ngại, e ngại", ExampleSentence = "景気の先行きが懸念される。", ExampleSentenceTranslation = "Tình hình kinh tế tương lai gây lo ngại.", PartOfSpeech = "Danh từ", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "促進", Reading = "そくしん", Meaning = "Thúc đẩy, xúc tiến", ExampleSentence = "経済の成長を促進する政策。", ExampleSentenceTranslation = "Chính sách thúc đẩy tăng trưởng kinh tế.", PartOfSpeech = "Danh từ", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "妥協", Reading = "だきょう", Meaning = "Thỏa hiệp", ExampleSentence = "双方が歩み寄って妥協した。", ExampleSentenceTranslation = "Hai bên đã nhượng bộ và thỏa hiệp.", PartOfSpeech = "Danh từ", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "顕著", Reading = "けんちょ", Meaning = "Rõ rệt, nổi bật", ExampleSentence = "回復の兆しが顕著に現れる。", ExampleSentenceTranslation = "Dấu hiệu hồi phục xuất hiện rõ rệt.", PartOfSpeech = "Tính từ na", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "回避", Reading = "かいひ", Meaning = "Tránh né, né tránh", ExampleSentence = "リスクを回避するための措置。", ExampleSentenceTranslation = "Biện pháp để né tránh rủi ro.", PartOfSpeech = "Danh từ", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "把握", Reading = "はあく", Meaning = "Nắm vững, thấu hiểu", ExampleSentence = "現状を正確に把握する。", ExampleSentenceTranslation = "Nắm bắt chính xác hiện trạng.", PartOfSpeech = "Danh từ", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "一環", Reading = "いっかん", Meaning = "Một phần trong chuỗi hoạt động", ExampleSentence = "環境保護活動の一環として行う。", ExampleSentenceTranslation = "Tiến hành như một phần của hoạt động bảo vệ môi trường.", PartOfSpeech = "Danh từ", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "迅速", Reading = "じんそく", Meaning = "Nhanh chóng, mau lẹ", ExampleSentence = "迅速な対応が求められる。", ExampleSentenceTranslation = "Yêu cầu sự phản ứng nhanh chóng.", PartOfSpeech = "Tính từ na", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "契機", Reading = "けいき", Meaning = "Thời cơ, cơ hội, bước ngoặt", ExampleSentence = "留学を契機に日本語を極めた。", ExampleSentenceTranslation = "Lấy việc du học làm cơ hội để tinh thông tiếng Nhật.", PartOfSpeech = "Danh từ", JlptLevel = "N1", IsFallback = true, CreatedAtUtc = now },
            },
            "N2" => new List<VocabularyEntryDto>
            {
                new() { Id = Guid.NewGuid(), Word = "傾向", Reading = "けいこう", Meaning = "Khuynh hướng, xu hướng", ExampleSentence = "最近、若者の読書離れの傾向がある。", ExampleSentenceTranslation = "Gần đây có xu hướng giới trẻ ít đọc sách hơn.", PartOfSpeech = "Danh từ", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "契機", Reading = "けいき", Meaning = "Cơ duyên, bước ngoặt", ExampleSentence = "就職を契機に一人暮らしを始めた。", ExampleSentenceTranslation = "Nhân cơ hội đi làm tôi đã bắt đầu sống một mình.", PartOfSpeech = "Danh từ", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "配慮", Reading = "はいりょ", Meaning = "Quan tâm, xem xét, để ý", ExampleSentence = "周囲への配慮を忘れない。", ExampleSentenceTranslation = "Không quên sự quan tâm đến những người xung quanh.", PartOfSpeech = "Danh từ", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "普及", Reading = "ふきゅう", Meaning = "Phổ biến, thịnh hành", ExampleSentence = "スマートフォンの普及が進む。", ExampleSentenceTranslation = "Điện thoại thông minh ngày càng phổ biến.", PartOfSpeech = "Danh từ", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "維持", Reading = "いじ", Meaning = "Duy trì, giữ gìn", ExampleSentence = "健康を維持するために運動する。", ExampleSentenceTranslation = "Vận động để duy trì sức khỏe.", PartOfSpeech = "Danh từ", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "克服", Reading = "こくふく", Meaning = "Khắc phục, vượt qua", ExampleSentence = "弱点を克服して合格した。", ExampleSentenceTranslation = "Khắc phục điểm yếu và đã đỗ kỳ thi.", PartOfSpeech = "Danh từ", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "柔軟", Reading = "じゅうなん", Meaning = "Mềm dẻo, linh hoạt", ExampleSentence = "柔軟な思考が大切だ。", ExampleSentenceTranslation = "Tư duy linh hoạt rất quan trọng.", PartOfSpeech = "Tính từ na", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "適切", Reading = "てきせつ", Meaning = "Thích hợp, phù hợp", ExampleSentence = "適切なアドバイスをもらった。", ExampleSentenceTranslation = "Tôi đã nhận được lời khuyên thích hợp.", PartOfSpeech = "Tính từ na", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "反映", Reading = "はんえい", Meaning = "Phản ánh", ExampleSentence = "国民の意見を政策に反映させる。", ExampleSentenceTranslation = "Phản ánh ý kiến nhân dân vào chính sách.", PartOfSpeech = "Danh từ", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "充実", Reading = "じゅうじつ", Meaning = "Sung túc, đầy đủ, trọn vẹn", ExampleSentence = "充実した毎日を過ごす。", ExampleSentenceTranslation = "Trải qua những ngày tháng ý nghĩa trọn vẹn.", PartOfSpeech = "Danh từ", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "尊重", Reading = "そんちょう", Meaning = "Tôn trọng", ExampleSentence = "お互いの価値観を尊重する。", ExampleSentenceTranslation = "Tôn trọng thế giới quan của nhau.", PartOfSpeech = "Danh từ", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "把握", Reading = "はあく", Meaning = "Thấu hiểu, nắm bắt", ExampleSentence = "状況を正確に把握する。", ExampleSentenceTranslation = "Nắm bắt chính xác tình hình.", PartOfSpeech = "Danh từ", JlptLevel = "N2", IsFallback = true, CreatedAtUtc = now },
            },
            "N4" => new List<VocabularyEntryDto>
            {
                new() { Id = Guid.NewGuid(), Word = "案内", Reading = "あんない", Meaning = "Hướng dẫn, dẫn đường", ExampleSentence = "町を案内します。", ExampleSentenceTranslation = "Tôi sẽ hướng dẫn quanh thành phố.", PartOfSpeech = "Danh từ", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "遠慮", Reading = "えんりょ", Meaning = "Khách khí, ngại ngần", ExampleSentence = "遠慮しないで食べてください。", ExampleSentenceTranslation = "Đừng ngại, cứ ăn tự nhiên nhé.", PartOfSpeech = "Danh từ", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "都合", Reading = "つごう", Meaning = "Điều kiện, sự thuận tiện thời gian", ExampleSentence = "明日の都合はいかがですか。", ExampleSentenceTranslation = "Ngày mai thời gian của bạn có thuận tiện không?", PartOfSpeech = "Danh từ", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "連絡", Reading = "れんらく", Meaning = "Liên lạc", ExampleSentence = "後で電話で連絡します。", ExampleSentenceTranslation = "Lát nữa tôi sẽ liên lạc qua điện thoại.", PartOfSpeech = "Danh từ", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "約束", Reading = "やくそく", Meaning = "Hẹn ước, lời hứa", ExampleSentence = "友達と映画を見る約束がある。", ExampleSentenceTranslation = "Tôi có hẹn xem phim cùng bạn.", PartOfSpeech = "Danh từ", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "習慣", Reading = "しゅうかん", Meaning = "Tập quán, thói quen", ExampleSentence = "早起きする習慣をつける。", ExampleSentenceTranslation = "Tạo thói quen dậy sớm.", PartOfSpeech = "Danh từ", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "準備", Reading = "じゅんび", Meaning = "Chuẩn bị", ExampleSentence = "旅行の準備をします。", ExampleSentenceTranslation = "Chuẩn bị cho chuyến du lịch.", PartOfSpeech = "Danh từ", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "復習", Reading = "ふくしゅう", Meaning = "Ôn tập bài cũ", ExampleSentence = "今日習った文法を復習する。", ExampleSentenceTranslation = "Ôn tập lại ngữ pháp đã học hôm nay.", PartOfSpeech = "Danh từ", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "複雑", Reading = "ふくざつ", Meaning = "Phức tạp", ExampleSentence = "この機械の使い方は複雑です。", ExampleSentenceTranslation = "Cách dùng máy này khá phức tạp.", PartOfSpeech = "Tính từ na", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "安全", Reading = "あんぜん", Meaning = "An toàn", ExampleSentence = "この道は夜でも安全です。", ExampleSentenceTranslation = "Con đường này an toàn ngay cả vào ban đêm.", PartOfSpeech = "Tính từ na", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "熱心", Reading = "ねっしん", Meaning = "Nhiệt tình, hăng say", ExampleSentence = "熱心に日本語を勉強している。", ExampleSentenceTranslation = "Đang hăng say học tiếng Nhật.", PartOfSpeech = "Tính từ na", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "景色", Reading = "けしき", Meaning = "Phong cảnh, cảnh sắc", ExampleSentence = "山の上からの景色が素晴らしい。", ExampleSentenceTranslation = "Phong cảnh từ đỉnh núi rất tuyệt vời.", PartOfSpeech = "Danh từ", JlptLevel = "N4", IsFallback = true, CreatedAtUtc = now },
            },
            "N5" => new List<VocabularyEntryDto>
            {
                new() { Id = Guid.NewGuid(), Word = "学生", Reading = "がくせい", Meaning = "Học sinh, sinh viên", ExampleSentence = "私はハノイ大学の学生です。", ExampleSentenceTranslation = "Tôi là sinh viên đại học Hà Nội.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "先生", Reading = "せんせい", Meaning = "Thầy cô giáo, giáo viên", ExampleSentence = "山田先生はとても優しいです。", ExampleSentenceTranslation = "Thầy Yamada rất hiền từ.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "日本", Reading = "にほん", Meaning = "Nước Nhật Bản", ExampleSentence = "来年日本へ行きます。", ExampleSentenceTranslation = "Năm sau tôi sẽ đi Nhật Bản.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "友達", Reading = "ともだち", Meaning = "Bạn bè", ExampleSentence = "友達と公園へ行きました。", ExampleSentenceTranslation = "Tôi đã đi công viên cùng bạn.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "家族", Reading = "かぞく", Meaning = "Gia đình", ExampleSentence = "家族は４人います。", ExampleSentenceTranslation = "Gia đình tôi có 4 người.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "勉強", Reading = "べんきょう", Meaning = "Học tập", ExampleSentence = "毎晩日本語を勉強します。", ExampleSentenceTranslation = "Mỗi tối tôi đều học tiếng Nhật.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "時間", Reading = "じかん", Meaning = "Thời gian, tiếng đồng hồ", ExampleSentence = "勉強する時間がありません。", ExampleSentenceTranslation = "Tôi không có thời gian học.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "電話", Reading = "でんわ", Meaning = "Điện thoại", ExampleSentence = "母に電話をかけます。", ExampleSentenceTranslation = "Tôi gọi điện thoại cho mẹ.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "部屋", Reading = "へや", Meaning = "Căn phòng", ExampleSentence = "私の部屋は広いです。", ExampleSentenceTranslation = "Căn phòng của tôi rất rộng.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "写真", Reading = "しゃしん", Meaning = "Bức ảnh", ExampleSentence = "旅行の写真を撮りました。", ExampleSentenceTranslation = "Tôi đã chụp ảnh chuyến du lịch.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "買い物", Reading = "かいもの", Meaning = "Mua sắm", ExampleSentence = "スーパーへ買い物に行きます。", ExampleSentenceTranslation = "Tôi đi siêu thị mua sắm.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "料理", Reading = "りょうり", Meaning = "Món ăn, nấu nướng", ExampleSentence = "日本料理が好きです。", ExampleSentenceTranslation = "Tôi thích món ăn Nhật Bản.", PartOfSpeech = "Danh từ", JlptLevel = "N5", IsFallback = true, CreatedAtUtc = now },
            },
            _ /* N3 Default */ => new List<VocabularyEntryDto>
            {
                new() { Id = Guid.NewGuid(), Word = "経験", Reading = "けいけん", Meaning = "Kinh nghiệm", ExampleSentence = "日本で働いた経験があります。", ExampleSentenceTranslation = "Tôi có kinh nghiệm làm việc ở Nhật Bản.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "機会", Reading = "きかい", Meaning = "Cơ hội, dịp", ExampleSentence = "日本語を使う機会を増やしたい。", ExampleSentenceTranslation = "Tôi muốn tăng cơ hội sử dụng tiếng Nhật.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "環境", Reading = "かんきょう", Meaning = "Môi trường", ExampleSentence = "学習環境を整えることが大切だ。", ExampleSentenceTranslation = "Việc chuẩn bị môi trường học tập là rất quan trọng.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "相談", Reading = "そうだん", Meaning = "Thảo luận, trao đổi, tư vấn", ExampleSentence = "進路について先生に相談する。", ExampleSentenceTranslation = "Trao đổi với thầy cô về định hướng tương lai.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "興味", Reading = "きょうみ", Meaning = "Hứng thú, quan tâm", ExampleSentence = "日本文化に興味を持っています。", ExampleSentenceTranslation = "Tôi có hứng thú với văn hóa Nhật Bản.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "調査", Reading = "ちょうさ", Meaning = "Điều tra, khảo sát", ExampleSentence = "アンケート調査を実施した。", ExampleSentenceTranslation = "Chúng tôi đã thực hiện cuộc khảo sát.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "効果", Reading = "こうか", Meaning = "Hiệu quả, tác dụng", ExampleSentence = "毎日のシャドーイングは効果がある。", ExampleSentenceTranslation = "Shadowing mỗi ngày mang lại hiệu quả cao.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "目標", Reading = "もくひょう", Meaning = "Mục tiêu", ExampleSentence = "今年中にN3に合格することが目標です。", ExampleSentenceTranslation = "Mục tiêu của tôi là đỗ N3 trong năm nay.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "確認", Reading = "かくにん", Meaning = "Xác nhận, kiểm tra lại", ExampleSentence = "メールの内容をもう一度確認してください。", ExampleSentenceTranslation = "Hãy xác nhận lại nội dung email một lần nữa.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "変化", Reading = "へんか", Meaning = "Biến đổi, thay đổi", ExampleSentence = "時代の変化に対応する。", ExampleSentenceTranslation = "Thích ứng với sự thay đổi của thời đại.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "努力", Reading = "どりょく", Meaning = "Nỗ lực, cố gắng", ExampleSentence = "目標に向かって努力を重ねる。", ExampleSentenceTranslation = "Không ngừng nỗ lực hướng tới mục tiêu.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
                new() { Id = Guid.NewGuid(), Word = "理解", Reading = "りかい", Meaning = "Thấu hiểu, lĩnh hội", ExampleSentence = "文法のポイントを正しく理解する。", ExampleSentenceTranslation = "Hiểu đúng các điểm ngữ pháp trọng tâm.", PartOfSpeech = "Danh từ", JlptLevel = "N3", IsFallback = true, CreatedAtUtc = now },
            }
        };
    }
}
