using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class CuratorService : ICuratorService
{
    private readonly LmsDbContext _dbContext;
    private readonly ISyllabusParserService? _syllabusParserService;

    public CuratorService(LmsDbContext dbContext, ISyllabusParserService? syllabusParserService = null)
    {
        _dbContext = dbContext;
        _syllabusParserService = syllabusParserService;
    }

    public async Task<List<CourseDto>> GetAllCoursesAsync(CancellationToken cancellationToken = default)
    {
        var courses = await _dbContext.Courses
            .AsNoTracking()
            .Include(c => c.Sections.OrderBy(s => s.DisplayOrder))
                .ThenInclude(s => s.Lessons.OrderBy(l => l.DisplayOrder))
                    .ThenInclude(l => l.Resources.OrderBy(r => r.DisplayOrder))
                        .ThenInclude(r => r.DriveNode)
            .Include(c => c.Sections)
                .ThenInclude(s => s.Lessons)
                    .ThenInclude(l => l.Quizzes)
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync(cancellationToken);

        return courses.Select(MapToCourseDto).ToList();
    }

    public async Task<CourseDto?> GetCourseByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var course = await _dbContext.Courses
            .AsNoTracking()
            .Include(c => c.Sections.OrderBy(s => s.DisplayOrder))
                .ThenInclude(s => s.Lessons.OrderBy(l => l.DisplayOrder))
                    .ThenInclude(l => l.Resources.OrderBy(r => r.DisplayOrder))
                        .ThenInclude(r => r.DriveNode)
            .Include(c => c.Sections)
                .ThenInclude(s => s.Lessons)
                    .ThenInclude(l => l.Quizzes)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        return course != null ? MapToCourseDto(course) : null;
    }

    public async Task<CourseDto> CreateCourseAsync(CreateCourseDto dto, CancellationToken cancellationToken = default)
    {
        var course = new Course
        {
            Title = dto.Title,
            Slug = string.IsNullOrWhiteSpace(dto.Slug) ? dto.Title.ToLowerInvariant().Replace(" ", "-") : dto.Slug,
            Description = dto.Description,
            JlptLevel = dto.JlptLevel,
            DisplayOrder = dto.DisplayOrder,
            IsPublished = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Courses.Add(course);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToCourseDto(course);
    }

    public async Task<CourseDto> UpdateCourseAsync(Guid id, CreateCourseDto dto, CancellationToken cancellationToken = default)
    {
        var course = await _dbContext.Courses.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (course == null) throw new KeyNotFoundException($"Course {id} not found.");

        course.Title = dto.Title;
        course.Slug = dto.Slug;
        course.Description = dto.Description;
        course.JlptLevel = dto.JlptLevel;
        course.DisplayOrder = dto.DisplayOrder;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapToCourseDto(course);
    }

    public async Task DeleteCourseAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var course = await _dbContext.Courses.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (course != null)
        {
            _dbContext.Courses.Remove(course);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<SectionDto> CreateSectionAsync(CreateSectionDto dto, CancellationToken cancellationToken = default)
    {
        int order = dto.DisplayOrder;
        if (order <= 0)
        {
            var maxOrder = await _dbContext.Sections.Where(s => s.CourseId == dto.CourseId).Select(s => (int?)s.DisplayOrder).MaxAsync(cancellationToken) ?? 0;
            order = maxOrder + 1;
        }

        var section = new Section
        {
            CourseId = dto.CourseId,
            Title = dto.Title,
            Description = dto.Description,
            DisplayOrder = order,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Sections.Add(section);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new SectionDto
        {
            Id = section.Id,
            CourseId = section.CourseId,
            Title = section.Title,
            Description = section.Description,
            DisplayOrder = section.DisplayOrder,
            Lessons = new List<LessonDto>()
        };
    }

    public async Task<SectionDto> UpdateSectionAsync(Guid id, CreateSectionDto dto, CancellationToken cancellationToken = default)
    {
        var section = await _dbContext.Sections.Include(s => s.Lessons).FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (section == null) throw new KeyNotFoundException($"Section {id} not found.");

        section.Title = dto.Title;
        section.Description = dto.Description;
        section.DisplayOrder = dto.DisplayOrder;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new SectionDto
        {
            Id = section.Id,
            CourseId = section.CourseId,
            Title = section.Title,
            Description = section.Description,
            DisplayOrder = section.DisplayOrder,
            Lessons = new List<LessonDto>()
        };
    }

    public async Task DeleteSectionAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var section = await _dbContext.Sections.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (section != null)
        {
            _dbContext.Sections.Remove(section);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<LessonDto> CreateLessonAsync(CreateLessonDto dto, CancellationToken cancellationToken = default)
    {
        int order = dto.DisplayOrder;
        if (order <= 0)
        {
            var maxOrder = await _dbContext.Lessons.Where(l => l.SectionId == dto.SectionId).Select(l => (int?)l.DisplayOrder).MaxAsync(cancellationToken) ?? 0;
            order = maxOrder + 1;
        }

        var lesson = new Lesson
        {
            SectionId = dto.SectionId,
            Title = dto.Title,
            Description = dto.Description,
            DisplayOrder = order,
            IsPublished = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Lessons.Add(lesson);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new LessonDto
        {
            Id = lesson.Id,
            SectionId = lesson.SectionId,
            Title = lesson.Title,
            Description = lesson.Description,
            DisplayOrder = lesson.DisplayOrder,
            Resources = new List<ResourceDto>()
        };
    }

    public async Task<LessonDto> UpdateLessonAsync(Guid id, CreateLessonDto dto, CancellationToken cancellationToken = default)
    {
        var lesson = await _dbContext.Lessons.Include(l => l.Resources).FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (lesson == null) throw new KeyNotFoundException($"Lesson {id} not found.");

        lesson.Title = dto.Title;
        lesson.Description = dto.Description;
        lesson.DisplayOrder = dto.DisplayOrder;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new LessonDto
        {
            Id = lesson.Id,
            SectionId = lesson.SectionId,
            Title = lesson.Title,
            Description = lesson.Description,
            DisplayOrder = lesson.DisplayOrder,
            Resources = new List<ResourceDto>()
        };
    }

    public async Task DeleteLessonAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var lesson = await _dbContext.Lessons.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (lesson != null)
        {
            _dbContext.Lessons.Remove(lesson);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<ResourceDto> AssignDriveNodeAsync(AssignDriveNodeRequestDto dto, CancellationToken cancellationToken = default)
    {
        var driveNode = await _dbContext.DriveNodes.FirstOrDefaultAsync(n => n.Id == dto.DriveNodeId, cancellationToken);
        if (driveNode == null) throw new KeyNotFoundException($"DriveNode {dto.DriveNodeId} not found.");

        var resource = new Resource
        {
            LessonId = dto.LessonId,
            Title = string.IsNullOrWhiteSpace(dto.Title) ? driveNode.Name : dto.Title,
            ResourceType = dto.ResourceType,
            DriveNodeId = dto.DriveNodeId,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Resources.Add(resource);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new ResourceDto
        {
            Id = resource.Id,
            LessonId = resource.LessonId,
            Title = resource.Title,
            ResourceType = resource.ResourceType,
            DriveNodeId = resource.DriveNodeId,
            DriveFileId = driveNode.DriveFileId,
            WebViewLink = driveNode.WebViewLink
        };
    }

    public async Task RemoveResourceAsync(Guid resourceId, CancellationToken cancellationToken = default)
    {
        var res = await _dbContext.Resources.FirstOrDefaultAsync(r => r.Id == resourceId, cancellationToken);
        if (res != null)
        {
            _dbContext.Resources.Remove(res);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<int> ApplyAutoSuggestAsync(ApplyAutoSuggestRequestDto dto, CancellationToken cancellationToken = default)
    {
        var section = await _dbContext.Sections.FirstOrDefaultAsync(s => s.Id == dto.TargetSectionId, cancellationToken);
        if (section == null) throw new KeyNotFoundException($"Target Section {dto.TargetSectionId} not found.");

        int createdCount = 0;
        int maxOrder = await _dbContext.Lessons.Where(l => l.SectionId == dto.TargetSectionId).Select(l => (int?)l.DisplayOrder).MaxAsync(cancellationToken) ?? 0;

        foreach (var suggestedLesson in dto.SelectedLessons)
        {
            maxOrder++;
            var lesson = new Lesson
            {
                SectionId = dto.TargetSectionId,
                Title = suggestedLesson.LessonTitle,
                DisplayOrder = maxOrder,
                IsPublished = true,
                CreatedAtUtc = DateTime.UtcNow
            };

            _dbContext.Lessons.Add(lesson);

            int resOrder = 0;
            foreach (var res in suggestedLesson.Resources)
            {
                resOrder++;
                var resource = new Resource
                {
                    Lesson = lesson,
                    Title = res.ResourceTitle,
                    ResourceType = res.ResourceType,
                    DriveNodeId = res.DriveNodeId,
                    DisplayOrder = resOrder,
                    CreatedAtUtc = DateTime.UtcNow
                };
                _dbContext.Resources.Add(resource);
            }

            createdCount++;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return createdCount;
    }

    public async Task ReorderLessonsAsync(ReorderLessonsDto dto, CancellationToken cancellationToken = default)
    {
        var lessons = await _dbContext.Lessons.Where(l => l.SectionId == dto.SectionId).ToListAsync(cancellationToken);
        for (int i = 0; i < dto.LessonIds.Count; i++)
        {
            var id = dto.LessonIds[i];
            var lesson = lessons.FirstOrDefault(l => l.Id == id);
            if (lesson != null)
            {
                lesson.DisplayOrder = i + 1;
            }
        }
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task ReorderSectionsAsync(ReorderSectionsDto dto, CancellationToken cancellationToken = default)
    {
        var sections = await _dbContext.Sections.Where(s => s.CourseId == dto.CourseId).ToListAsync(cancellationToken);
        for (int i = 0; i < dto.SectionIds.Count; i++)
        {
            var id = dto.SectionIds[i];
            var section = sections.FirstOrDefault(s => s.Id == id);
            if (section != null)
            {
                section.DisplayOrder = i + 1;
            }
        }
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task AssignQuizToLessonAsync(AssignQuizRequestDto dto, CancellationToken cancellationToken = default)
    {
        var quiz = await _dbContext.Quizzes.FirstOrDefaultAsync(q => q.Id == dto.QuizId, cancellationToken);
        if (quiz == null) throw new KeyNotFoundException($"Quiz {dto.QuizId} not found.");

        quiz.LessonId = dto.LessonId;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    // ═══════════════════════════════════════════════════════════
    //  AI Auto-Course Builder (Multi-Tier Drive Folder to Course)
    // ═══════════════════════════════════════════════════════════

    public async Task<AutoBuildScanResultDto> ScanAndPreviewCourseFromDriveAsync(
        AutoBuildScanRequestDto dto, CancellationToken cancellationToken = default)
    {
        var courseTitle = string.IsNullOrWhiteSpace(dto.CourseTitle) ? $"Khóa học Tiếng Nhật {dto.JlptLevel}" : dto.CourseTitle;
        var jlptLevel = string.IsNullOrWhiteSpace(dto.JlptLevel) ? "N4" : dto.JlptLevel.ToUpperInvariant();

        // 1. Xác định Root Folder filter nếu có
        string? rootFolderPath = null;
        if (dto.RootFolderNodeId.HasValue && dto.RootFolderNodeId.Value != Guid.Empty)
        {
            var rootNode = await _dbContext.DriveNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == dto.RootFolderNodeId.Value, cancellationToken);

            if (rootNode != null)
            {
                var rPath = string.IsNullOrWhiteSpace(rootNode.RawPath) ? rootNode.Name : $"{rootNode.RawPath.TrimEnd('/')}/{rootNode.Name}";
                rootFolderPath = RemoveDiacritics(rPath);
            }
        }

        // 2. Lấy tất cả file media & docs từ DriveNodes
        var allDriveFiles = await _dbContext.DriveNodes
            .AsNoTracking()
            .Where(n => n.NodeType == NodeType.File
                     && !n.IsDeletedInDrive)
            .Select(n => new
            {
                n.Id,
                n.Name,
                n.RawPath,
                n.WebViewLink,
                n.FileExtension,
                n.MimeType
            })
            .ToListAsync(cancellationToken);

        // Pre-compute normalized candidate pool
        var fullCandidatePool = allDriveFiles.Select(f =>
        {
            var raw = f.RawPath ?? string.Empty;
            var fullPath = string.IsNullOrWhiteSpace(raw) ? f.Name : $"{raw.TrimEnd('/')}/{f.Name}";
            var ext = (f.FileExtension ?? Path.GetExtension(f.Name) ?? string.Empty).ToLowerInvariant();
            return new
            {
                f.Id,
                f.Name,
                f.RawPath,
                FullPath = fullPath,
                NormFullPath = RemoveDiacritics(fullPath),
                NormName = RemoveDiacritics(f.Name),
                FileExtension = ext,
                f.MimeType,
                f.WebViewLink
            };
        }).ToList();

        // 3. LỌC NGHIÊM NGẶT THEO JLPT LEVEL (Không để lẫn N1, N2, N3, N5 vào N4)
        List<dynamic> candidatePool;

        if (!string.IsNullOrWhiteSpace(rootFolderPath))
        {
            candidatePool = fullCandidatePool.Where(f => f.NormFullPath.Contains(rootFolderPath)).Cast<dynamic>().ToList();
        }
        else
        {
            var requestedLvl = jlptLevel.ToLowerInvariant(); // "n4"
            var allLevels = new[] { "n1", "n2", "n3", "n4", "n5" };
            var otherLevels = allLevels.Where(l => l != requestedLvl).ToList();

            candidatePool = fullCandidatePool.Where(f =>
            {
                var path = (string)f.NormFullPath;

                // 1. Phải chứa chỉ dẫn rõ ràng của level đang chọn
                bool matchesTarget = path.Contains($"{requestedLvl} dung mori")
                                  || Regex.IsMatch(path, $@"[\\/_\s\-]{requestedLvl}(?:[\\/_\s\.\-]|$)", RegexOptions.IgnoreCase);

                if (!matchesTarget) return false;

                // 2. KHÔNG ĐƯỢC thuộc về level khác
                foreach (var other in otherLevels)
                {
                    if (path.Contains($"{other} dung mori")) return false;
                    if (Regex.IsMatch(path, $@"[\\/_\s\-]{other}(?:[\\/_\s\.\-]|$)", RegexOptions.IgnoreCase))
                    {
                        if (!path.Contains($"{requestedLvl} dung mori") && !path.Contains($"/{requestedLvl}/"))
                            return false;
                    }
                }

                return true;
            }).Cast<dynamic>().ToList();

            // Nếu không tìm thấy bằng bộ lọc nghiêm ngặt, fallback tìm kiếm từ khóa level
            if (candidatePool.Count == 0)
            {
                candidatePool = fullCandidatePool.Where(f => ((string)f.NormFullPath).Contains(requestedLvl)).Cast<dynamic>().ToList();
            }
        }

        var result = new AutoBuildScanResultDto
        {
            CourseTitle = courseTitle,
            JlptLevel = jlptLevel,
        };

        // 4. Nhận diện các Section trong phạm vi các file đã lọc:
        //  A) Bài học chuẩn Minna / Dũng Mori: "Bài 01", "Bài 26", v.v.
        //  B) Luyện đề & Thi thử: "Thi thử JLPT số 1", "Đề 1", v.v.
        //  C) Chương / Chặng: "Chương 1", "Chặng 1", v.v.

        var sectionCandidates = new Dictionary<string, (string Title, int Number, bool IsExam, string PatternKey)>(StringComparer.OrdinalIgnoreCase);

        foreach (var file in candidatePool)
        {
            string fPath = file.FullPath;
            var pathParts = fPath.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var part in pathParts)
            {
                var normPart = RemoveDiacritics(part);

                // Quét tìm Bài học ("Bài X" hoặc "Bài 0X")
                var mBai = Regex.Match(normPart, @"^(?:bai|b|lesson)\s*0*(\d{1,3})(?:[\.\:\-\s]*(.*))?$", RegexOptions.IgnoreCase);
                if (mBai.Success && int.TryParse(mBai.Groups[1].Value, out int bNum) && bNum >= 1 && bNum <= 100)
                {
                    // Kiểm tra phạm vi bài học chuẩn: N5 (1..25), N4 (26..50) nếu không chọn root cụ thể
                    if (string.IsNullOrWhiteSpace(rootFolderPath))
                    {
                        if (jlptLevel == "N4" && (bNum < 26 || bNum > 50)) continue;
                        if (jlptLevel == "N5" && bNum > 25) continue;
                    }

                    var key = $"BAI_{bNum}";
                    if (!sectionCandidates.ContainsKey(key))
                    {
                        var cleanTitle = part.Trim();
                        if (cleanTitle.StartsWith("Bản sao của", StringComparison.OrdinalIgnoreCase))
                            cleanTitle = cleanTitle.Replace("Bản sao của", "").Trim();
                        sectionCandidates[key] = (cleanTitle.Length > 8 ? cleanTitle : $"Bài {bNum}: Minna no Nihongo", bNum, false, $"bai {bNum}");
                    }
                }

                // Quét tìm Đề thi & Luyện đề ("Thi thử JLPT X", "Đề X", "Luyện đề X")
                var mDe = Regex.Match(normPart, @"^(?:thi\s*thu\s*jlpt.*|de\s*thi\s*thu.*|luyen\s*de.*|de\s*0*(\d{1,2}))", RegexOptions.IgnoreCase);
                if (mDe.Success)
                {
                    var key = $"EXAM_{normPart}";
                    if (!sectionCandidates.ContainsKey(key))
                    {
                        var examTitle = part.Trim();
                        if (examTitle.StartsWith("Bản sao của", StringComparison.OrdinalIgnoreCase))
                            examTitle = examTitle.Replace("Bản sao của", "").Trim();
                        sectionCandidates[key] = ($"Luyện Đề: {examTitle}", 1000 + sectionCandidates.Count, true, normPart);
                    }
                }

                // Quét tìm Chương ("Chương X") cho N3, N2, N1
                var mChuong = Regex.Match(normPart, @"^chuong\s*0*(\d{1,3})(?:[\.\:\-\s]*(.*))?$", RegexOptions.IgnoreCase);
                if (mChuong.Success && int.TryParse(mChuong.Groups[1].Value, out int cNum) && cNum >= 1 && cNum <= 100)
                {
                    var key = $"CHUONG_{cNum}";
                    if (!sectionCandidates.ContainsKey(key))
                    {
                        sectionCandidates[key] = (part.Trim(), cNum, false, $"chuong {cNum}");
                    }
                }
            }
        }

        // Nếu không phát hiện section nào, tạo khung mặc định theo JLPT
        if (sectionCandidates.Count == 0)
        {
            int start = jlptLevel.Equals("N4", StringComparison.OrdinalIgnoreCase) ? 26 : 1;
            for (int i = start; i <= (jlptLevel.Equals("N4", StringComparison.OrdinalIgnoreCase) ? 50 : 25); i++)
            {
                sectionCandidates[$"BAI_{i}"] = ($"Bài {i}: Minna no Nihongo", i, false, $"bai {i}");
            }
        }

        int sectionOrder = 0;
        int totalFilesMatched = 0;
        int totalLessons = 0;

        var sortedSections = sectionCandidates.Values.OrderBy(s => s.Number).ThenBy(s => s.Title).ToList();

        foreach (var secInfo in sortedSections)
        {
            sectionOrder++;
            var section = new AutoBuildSectionPreviewDto
            {
                Title = secInfo.Title,
                DisplayOrder = sectionOrder,
                LessonNumber = secInfo.Number,
                Lessons = new List<AutoBuildLessonPreviewDto>()
            };

            var flowDefinitions = secInfo.IsExam
                ? new (int FlowOrder, string Title, string Skill, int Duration)[]
                {
                    (1, "1. Đề thi Kiến thức ngôn ngữ & Đọc hiểu (PDF)", "ExamKnowledge", 60),
                    (2, "2. Đề thi Nghe hiểu (Choukai - PDF đề & Audio)", "ExamAudio", 45),
                    (3, "3. Đáp án & Hướng dẫn giải chi tiết (nếu có)", "ExamAnswer", 30)
                }
                : new (int FlowOrder, string Title, string Skill, int Duration)[]
                {
                    (1, "1. Từ vựng (Vocabulary)", "Vocabulary", 30),
                    (2, "2. Chữ Hán (Kanji)", "Kanji", 45),
                    (3, "3. Ngữ pháp (Grammar)", "Grammar", 50),
                    (4, "4. Hội thoại & Nghe hiểu (Kaiwa & Choukai)", "Kaiwa/Choukai", 40),
                    (5, "5. Luyện tập & Đề kiểm tra (Quiz / Test)", "Quiz", 45)
                };

            foreach (var lDef in flowDefinitions)
            {
                totalLessons++;
                var lessonPreview = new AutoBuildLessonPreviewDto
                {
                    Title = lDef.Title,
                    FlowOrder = lDef.FlowOrder,
                    Skill = lDef.Skill,
                    EstimatedDurationMinutes = lDef.Duration,
                    Resources = new List<AutoBuildResourcePreviewDto>()
                };

                var scoredFiles = new List<(AutoBuildResourcePreviewDto Res, int Score)>();

                foreach (var file in candidatePool)
                {
                    int score = ScoreFileForSectionLesson(
                        (string)file.NormFullPath,
                        (string)file.NormName,
                        (string)file.FileExtension,
                        secInfo.Number,
                        secInfo.PatternKey,
                        secInfo.IsExam,
                        lDef.Skill,
                        jlptLevel,
                        out string sourceTier);

                    if (score >= 40)
                    {
                        var resType = InferResourceTypeFromPath((string)file.FileExtension, (string)file.NormFullPath);
                        var resDto = new AutoBuildResourcePreviewDto
                        {
                            DriveNodeId = (Guid)file.Id,
                            Title = (string)file.Name,
                            RawPath = (string?)file.RawPath,
                            WebViewLink = (string?)file.WebViewLink,
                            ResourceType = resType,
                            MatchScore = Math.Min(100, score),
                            SourceTier = sourceTier
                        };
                        scoredFiles.Add((resDto, score));
                    }
                }

                // Lấy top file điểm cao nhất cho lesson này (tối đa 4 files)
                lessonPreview.Resources = scoredFiles
                    .GroupBy(x => x.Res.DriveNodeId)
                    .Select(g => g.OrderByDescending(x => x.Score).First())
                    .OrderByDescending(x => x.Score)
                    .Take(4)
                    .Select(x => x.Res)
                    .ToList();

                totalFilesMatched += lessonPreview.Resources.Count;
                section.Lessons.Add(lessonPreview);
            }

            result.Sections.Add(section);
        }

        result.TotalSections = result.Sections.Count;
        result.TotalLessons = totalLessons;
        result.TotalFilesMatched = totalFilesMatched;

        return result;
    }

    public async Task<AutoBuildScanResultDto> ScanAndPreviewCourseFromPdfAsync(
        Stream pdfStream, string fileName, string? courseTitle, string? jlptLevel, CancellationToken cancellationToken = default)
    {
        if (_syllabusParserService == null)
            throw new InvalidOperationException("SyllabusParserService is not initialized.");

        var parsed = await _syllabusParserService.ParseFromPdfAsync(pdfStream, fileName, cancellationToken);

        var finalTitle = !string.IsNullOrWhiteSpace(courseTitle)
            ? courseTitle
            : (!string.IsNullOrWhiteSpace(parsed.CourseTitle) ? parsed.CourseTitle : $"Khóa học Tiếng Nhật {parsed.JlptLevel}");

        var finalLevel = !string.IsNullOrWhiteSpace(jlptLevel)
            ? jlptLevel.ToUpperInvariant()
            : (!string.IsNullOrWhiteSpace(parsed.JlptLevel) ? parsed.JlptLevel.ToUpperInvariant() : "N4");

        var result = new AutoBuildScanResultDto
        {
            CourseTitle = finalTitle,
            JlptLevel = finalLevel,
            TotalSections = parsed.Sections.Count,
            TotalLessons = parsed.Sections.Sum(s => s.Lessons.Count),
            TotalFilesMatched = parsed.Sections.Sum(s => s.Lessons.Sum(l => l.SuggestedDriveFiles.Count)),
            Sections = new List<AutoBuildSectionPreviewDto>()
        };

        for (int secIdx = 0; secIdx < parsed.Sections.Count; secIdx++)
        {
            var pSec = parsed.Sections[secIdx];
            var secDto = new AutoBuildSectionPreviewDto
            {
                Title = pSec.Title,
                DisplayOrder = pSec.DisplayOrder > 0 ? pSec.DisplayOrder : secIdx + 1,
                LessonNumber = secIdx + 1,
                Lessons = new List<AutoBuildLessonPreviewDto>()
            };

            for (int lesIdx = 0; lesIdx < pSec.Lessons.Count; lesIdx++)
            {
                var pLes = pSec.Lessons[lesIdx];
                var lesDto = new AutoBuildLessonPreviewDto
                {
                    Title = pLes.Title,
                    FlowOrder = pLes.DisplayOrder > 0 ? pLes.DisplayOrder : lesIdx + 1,
                    Skill = pLes.Skills != null && pLes.Skills.Count > 0 ? string.Join(", ", pLes.Skills) : "Tổng hợp",
                    EstimatedDurationMinutes = pLes.EstimatedDurationMinutes > 0 ? pLes.EstimatedDurationMinutes : 45,
                    Resources = pLes.SuggestedDriveFiles.Select(f => new AutoBuildResourcePreviewDto
                    {
                        DriveNodeId = f.DriveNodeId,
                        Title = f.FileName,
                        RawPath = f.RawPath,
                        WebViewLink = f.WebViewLink,
                        ResourceType = f.ResourceType,
                        MatchScore = f.MatchScore,
                        SourceTier = "LessonFolder"
                    }).ToList()
                };
                secDto.Lessons.Add(lesDto);
            }

            result.Sections.Add(secDto);
        }

        return result;
    }

    public async Task<CourseDto> ApplyAutoBuiltCourseAsync(
        AutoBuildApplyRequestDto dto, CancellationToken cancellationToken = default)
    {
        var slug = Regex.Replace(dto.CourseTitle.ToLowerInvariant(), @"[^a-z0-9\s-]", "").Replace(" ", "-");
        if (string.IsNullOrWhiteSpace(slug)) slug = "course-" + Guid.NewGuid().ToString()[..8];

        var course = new Course
        {
            Title = dto.CourseTitle,
            Slug = slug,
            Description = dto.Description ?? $"Khóa học chuẩn {dto.JlptLevel} tạo tự động từ Google Drive",
            JlptLevel = dto.JlptLevel,
            DisplayOrder = 0,
            IsPublished = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Courses.Add(course);

        int sOrder = 0;
        foreach (var secDto in dto.Sections.OrderBy(s => s.DisplayOrder))
        {
            sOrder++;
            var section = new Section
            {
                CourseId = course.Id,
                Title = secDto.Title,
                DisplayOrder = sOrder,
                CreatedAtUtc = DateTime.UtcNow
            };

            int lOrder = 0;
            foreach (var lDto in secDto.Lessons.OrderBy(l => l.FlowOrder))
            {
                lOrder++;
                var lesson = new Lesson
                {
                    SectionId = section.Id,
                    Title = lDto.Title,
                    DisplayOrder = lOrder,
                    EstimatedDurationMinutes = lDto.EstimatedDurationMinutes,
                    IsPublished = true,
                    CreatedAtUtc = DateTime.UtcNow
                };

                int rOrder = 0;
                foreach (var rDto in lDto.Resources)
                {
                    rOrder++;
                    lesson.Resources.Add(new Resource
                    {
                        LessonId = lesson.Id,
                        Title = rDto.Title,
                        ResourceType = rDto.ResourceType,
                        DriveNodeId = rDto.DriveNodeId,
                        DisplayOrder = rOrder,
                        CreatedAtUtc = DateTime.UtcNow
                    });
                }

                section.Lessons.Add(lesson);
            }

            course.Sections.Add(section);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapToCourseDto(course);
    }

    // ─── Scoring Logic Chuẩn Xác Tuyệt Đối (Strict Word-Boundary Matching) ───
    private static int ScoreFileForSectionLesson(
        string normFullPath,
        string normFileName,
        string fileExt,
        int sectionNumber,
        string patternKey,
        bool isExamSection,
        string skill,
        string courseLevel,
        out string sourceTier)
    {
        sourceTier = "LessonFolder";
        int score = 0;

        if (isExamSection)
        {
            // Kiểm tra xem file có nằm trong thư mục của Đề thi này không
            bool isMatchingExam = normFullPath.Contains(patternKey) || normFileName.Contains(patternKey);
            if (isMatchingExam)
            {
                score += 55;
                sourceTier = "LessonFolder";

                switch (skill)
                {
                    case "ExamKnowledge":
                        // Bài thi kiến thức: từ vựng, chữ hán, ngữ pháp, đọc hiểu (PDF/Docx), KHÔNG lấy file audio
                        if (normFullPath.Contains("bai thi") || normFullPath.Contains("tu vung") || normFullPath.Contains("chu han") || normFullPath.Contains("ngu phap") || normFullPath.Contains("doc hieu") || fileExt == ".pdf" || fileExt == ".docx")
                        {
                            if (!normFullPath.Contains("nghe hieu") && fileExt != ".mp3" && fileExt != ".m4a")
                                score += 40;
                        }
                        break;

                    case "ExamAudio":
                        // Bài thi nghe hiểu: PDF đề nghe + Toàn bộ file Audio bài nghe
                        if (normFullPath.Contains("nghe hieu") || normFullPath.Contains("choukai") || normFullPath.Contains("bai nghe") || normFullPath.Contains("track") || fileExt == ".mp3" || fileExt == ".m4a")
                        {
                            score += 40;
                        }
                        break;

                    case "ExamAnswer":
                        // Đáp án & lời giải
                        if (normFullPath.Contains("dap an") || normFullPath.Contains("loi giai") || normFullPath.Contains("chua de") || normFullPath.Contains("huong dan") || normFullPath.Contains("giai thich"))
                        {
                            score += 40;
                        }
                        break;
                }
            }
            return score;
        }

        // Với bài học thông thường (Minna Bài X):
        // KHÔNG ĐƯỢC chứa file của các thư mục Đề thi / Luyện đề
        bool isExamFile = normFullPath.Contains("02. de thi")
                       || normFullPath.Contains("/de thi/")
                       || normFullPath.Contains("thi thu jlpt")
                       || normFullPath.Contains("luyen thi jlpt")
                       || normFullPath.Contains("luyen de");
        if (isExamFile)
        {
            return 0;
        }

        // Scoring cho Section Bài học chuẩn (Minna Bài X):
        // Bắt buộc dùng Regex Word Boundary để "bai 1" KHÔNG BAO GIỜ khớp với "bai 15", "bai 158", "chuong 12"
        var numStr = sectionNumber.ToString();
        string lessonPattern = $@"(?:bai|b|lesson|chuong|track)[\s_-]*0*{numStr}(?!\d)";
        string dirSegmentPattern = $@"[\\/]0*{numStr}[\\/]";

        bool isLessonFile = Regex.IsMatch(normFullPath, lessonPattern, RegexOptions.IgnoreCase)
                         || Regex.IsMatch(normFullPath, dirSegmentPattern, RegexOptions.IgnoreCase);

        if (isLessonFile)
        {
            score += 55;

            switch (skill)
            {
                case "Vocabulary":
                    if (normFullPath.Contains("tu vung") || normFullPath.Contains("kotoba") || normFullPath.Contains("01. tu vung") || normFullPath.Contains("4. tu vung"))
                    {
                        score += 40;
                        if (fileExt == ".mp4") score += 5;
                        sourceTier = "LessonFolder";
                    }
                    else if (normFullPath.Contains("tong hop ngu phap tai lieu") && normFullPath.Contains("tu vung"))
                    {
                        score += 35;
                        sourceTier = "CrossFolder";
                    }
                    break;

                case "Kanji":
                    if (normFullPath.Contains("1. chu han") || normFullPath.Contains("01. chu han") || normFullPath.Contains("chu han") || normFullPath.Contains("kanji") || normFullPath.Contains("bo thu"))
                    {
                        score += 40;
                        if (fileExt == ".mp4") score += 5;
                        if (normFullPath.Contains("bai tap chu han")) score += 5;
                        sourceTier = "LessonFolder";
                    }
                    else if (normFullPath.Contains("ngu phap") || normFullPath.Contains("nghe hieu"))
                    {
                        score -= 35;
                    }
                    break;

                case "Grammar":
                    if (normFullPath.Contains("ngu phap") || normFullPath.Contains("02. ngu phap") || normFullPath.Contains("2. ngu phap") || normFullPath.Contains("3. tong hop ngu phap") || normFullPath.Contains("bunpou") || normFullPath.Contains("np.pdf"))
                    {
                        score += 40;
                        if (fileExt == ".mp4") score += 5;
                        if (fileExt == ".pdf") score += 5;
                        sourceTier = "LessonFolder";
                    }
                    else if (normFullPath.Contains("tong hop ngu phap tai lieu") && normFullPath.Contains("ngu phap"))
                    {
                        score += 35;
                        sourceTier = "CrossFolder";
                    }
                    else if (normFullPath.Contains("chu han") || normFullPath.Contains("nghe hieu"))
                    {
                        score -= 35;
                    }
                    break;

                case "Kaiwa/Choukai":
                    if (normFullPath.Contains("hoi thoai") || normFullPath.Contains("kaiwa") || normFullPath.Contains("nghe hieu") || normFullPath.Contains("05. nghe hieu") || normFullPath.Contains("4. nghe hieu") || normFullPath.Contains("audio") || (fileExt == ".mp3" && normFullPath.Contains("track")))
                    {
                        score += 40;
                        if (fileExt == ".mp4" || fileExt == ".mp3") score += 5;
                        sourceTier = "LessonFolder";
                    }
                    break;

                case "Quiz":
                    if (normFullPath.Contains("test tong hop") || normFullPath.Contains("test") || normFullPath.Contains("kiem tra") || normFullPath.Contains("bai tap") || normFullPath.Contains("doc hieu") || normFullPath.Contains("04. doc hieu"))
                    {
                        score += 40;
                        if (fileExt == ".docx" || fileExt == ".pdf") score += 5;
                        sourceTier = "LessonFolder";
                    }
                    break;
            }
        }
        else
        {
            // Tier 3: Tài liệu dùng chung toàn khóa (KHÔNG ĐƯỢC thuộc về bài học cụ thể khác)
            bool belongsToOtherLesson = Regex.IsMatch(normFullPath, @"(?:bai|b|lesson)[\s_-]*\d{1,3}", RegexOptions.IgnoreCase);
            if (!belongsToOtherLesson)
            {
                var normLevel = RemoveDiacritics(courseLevel);
                if (normFullPath.Contains(normLevel) || normFullPath.Contains("tai lieu khoa hoc") || normFullPath.Contains("50 bai minna"))
                {
                    sourceTier = "SharedGeneral";
                    if (skill == "Kanji" && (normFullPath.Contains("kanji") || normFullPath.Contains("chu han")))
                        score = 65;
                    else if (skill == "Grammar" && (normFullPath.Contains("giai thich ngu phap") || normFullPath.Contains("sach giao khoa")))
                        score = 65;
                    else if (skill == "Vocabulary" && normFullPath.Contains("tu vung"))
                        score = 65;
                    else if (skill == "Kaiwa/Choukai" && (normFullPath.Contains("nghe hieu") || normFullPath.Contains("audio")))
                        score = 65;
                    else if (skill == "Quiz" && (normFullPath.Contains("doc hieu") || normFullPath.Contains("de thi")))
                        score = 65;
                }
            }
        }

        return score;
    }

    private static string RemoveDiacritics(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }

    private static ResourceType InferResourceTypeFromPath(string ext, string normFullPath)
    {
        var e = ext.ToLowerInvariant();
        if (e == ".mp4") return ResourceType.PrimaryVideo;
        if (e == ".mp3" || e == ".m4a") return ResourceType.Audio;
        if (e == ".pdf")
        {
            if (normFullPath.Contains("test") || normFullPath.Contains("bai tap") || normFullPath.Contains("kiem tra") || normFullPath.Contains("de thi"))
                return ResourceType.ExercisePdf;
            return ResourceType.Document;
        }
        if (e == ".docx" || e == ".doc")
        {
            if (normFullPath.Contains("test") || normFullPath.Contains("bai tap") || normFullPath.Contains("kiem tra"))
                return ResourceType.ExercisePdf;
            return ResourceType.Document;
        }
        if (e == ".png" || e == ".jpg" || e == ".jpeg") return ResourceType.Image;
        return ResourceType.Other;
    }

    private static CourseDto MapToCourseDto(Course c)
    {
        return new CourseDto
        {
            Id = c.Id,
            Title = c.Title,
            Slug = c.Slug,
            Description = c.Description,
            JlptLevel = c.JlptLevel,
            DisplayOrder = c.DisplayOrder,
            IsPublished = c.IsPublished,
            Sections = c.Sections.OrderBy(s => s.DisplayOrder).Select(s => new SectionDto
            {
                Id = s.Id,
                CourseId = s.CourseId,
                Title = s.Title,
                Description = s.Description,
                DisplayOrder = s.DisplayOrder,
                Lessons = s.Lessons.OrderBy(l => l.DisplayOrder).Select(l => new LessonDto
                {
                    Id = l.Id,
                    SectionId = l.SectionId,
                    Title = l.Title,
                    Description = l.Description,
                    DisplayOrder = l.DisplayOrder,
                    EstimatedDurationMinutes = l.EstimatedDurationMinutes,
                    IsPublished = l.IsPublished,
                    Resources = l.Resources.OrderBy(r => r.DisplayOrder).Select(r => new ResourceDto
                    {
                        Id = r.Id,
                        LessonId = r.LessonId,
                        Title = r.Title,
                        ResourceType = r.ResourceType,
                        DriveNodeId = r.DriveNodeId,
                        DriveFileId = r.DriveNode?.DriveFileId,
                        WebViewLink = r.DriveNode?.WebViewLink,
                        CustomUrl = r.CustomUrl,
                        DisplayOrder = r.DisplayOrder
                    }).ToList(),
                    Quizzes = l.Quizzes?.Select(q => new QuizSummaryDto
                    {
                        Id = q.Id,
                        Title = q.Title,
                        QuizType = (int)q.QuizType,
                        PassPercentage = q.PassPercentage,
                        QuestionCount = q.Questions?.Count ?? 0
                    }).ToList() ?? new List<QuizSummaryDto>()
                }).ToList()
            }).ToList()
        };
    }
}
