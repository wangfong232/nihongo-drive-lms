using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;
using UglyToad.PdfPig;

namespace NihongoLms.Infrastructure.Services;

/// <summary>
/// Pipeline bóc tách lộ trình từ PDF → LLM → Fuzzy Match → Save RoadmapTemplate.
/// Bước 1: PdfPig trích text.
/// Bước 2: Gọi LLM endpoint (OpenAI-compatible) để parse thành JSON chuẩn.
/// Bước 3: Levenshtein fuzzy match keywords vs. DriveNodes (chỉ file media .mp4/.mp3/.m4a/.pdf).
/// Bước 4: SaveRoadmapTemplateAsync lưu template đã curator xác nhận vào DB.
/// </summary>
public class SyllabusParserService : ISyllabusParserService
{
    // ─── Định dạng file media được phép fuzzy match ───
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".mp3", ".m4a", ".pdf"
    };

    // ─── System Prompt nhúng sẵn cho LLM ───
    private const string SystemPrompt = """
        You are an expert Educational Curriculum Architect specialized in Japanese Language Learning (JLPT N5 to N1).
        Your task is to analyze raw extracted text from a Japanese course syllabus/curriculum PDF and convert it into a structured hierarchical roadmap.

        EXTRACTION RULES:
        1. Identify overarching chapters/phases as Sections (e.g., "Tuần 1", "Chặng 1", "Chương 2").
        2. Extract individual study units/days as Lessons under each Section.
        3. For estimatedDurationMinutes: extract the raw time string as-is (e.g., "50 phút", "1h18p26", "4p31+42p").
           A separate parser will normalize it — do NOT convert yourself.
        4. For skills: detect keywords like Ngữ pháp/Bunpou→Grammar, Từ vựng/Kotoba→Vocabulary, Chữ Hán/Kanji→Kanji, 
           Nghe/Choukai→Choukai, Hội thoại/Kaiwa→Kaiwa, Đọc/Dokkai→Dokkai, Test/Kiểm tra→Quiz.
        5. For searchKeywords: generate 3–5 tokens likely present in Google Drive filenames 
           (e.g., ["B26", "Bai 26", "Kanji 26", "Tu vung 26"]).
        6. Discard administrative details, fees, contact info, promotional text, page numbers.
        7. Maintain original chronological order. Set displayOrder and dayNumber starting from 1.

        RESPOND ONLY with a single valid JSON object. No markdown, no explanation, no comments.

        JSON SCHEMA:
        {
          "courseTitle": "string",
          "jlptLevel": "N5"|"N4"|"N3"|"N2"|"N1",
          "description": "string",
          "sections": [
            {
              "displayOrder": number,
              "title": "string",
              "lessons": [
                {
                  "displayOrder": number,
                  "dayNumber": number,
                  "title": "string",
                  "description": "string",
                  "estimatedDurationMinutes": "string (raw time string, e.g. '50 phút')",
                  "skills": ["string"],
                  "searchKeywords": ["string"]
                }
              ]
            }
          ]
        }
        """;

    private readonly LmsDbContext _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<SyllabusParserService> _logger;

    public SyllabusParserService(
        LmsDbContext db,
        IHttpClientFactory httpFactory,
        IConfiguration config,
        ILogger<SyllabusParserService> logger)
    {
        _db = db;
        _httpFactory = httpFactory;
        _config = config;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════════════
    //  BƯỚC 1-3: Parse PDF → LLM → Fuzzy Match
    // ═══════════════════════════════════════════════════════════

    public async Task<ParsedSyllabusDto> ParseFromPdfAsync(
        Stream pdfStream, string pdfFileName, CancellationToken ct = default)
    {
        // BƯỚC 1 — Trích text từ PDF
        _logger.LogInformation("[SyllabusParser] Bước 1: Trích text từ PDF '{Name}'", pdfFileName);
        string rawText = ExtractTextFromPdf(pdfStream);

        if (string.IsNullOrWhiteSpace(rawText))
            throw new InvalidOperationException("Không thể trích xuất text từ file PDF. File có thể là scan ảnh hoặc bị mã hóa.");

        // BƯỚC 2 — Gọi LLM
        _logger.LogInformation("[SyllabusParser] Bước 2: Gọi LLM, text length = {Len} chars", rawText.Length);
        var llmResult = await CallLlmAsync(rawText, ct);

        // BƯỚC 3 — Fuzzy match Drive files
        _logger.LogInformation("[SyllabusParser] Bước 3: Fuzzy match DriveNodes cho {N} sections", llmResult.Sections.Count);
        await AttachDriveSuggestionsAsync(llmResult, ct);

        return llmResult;
    }

    // ─── BƯỚC 1: PdfPig text extraction ───
    private static string ExtractTextFromPdf(Stream pdfStream)
    {
        var sb = new StringBuilder();
        using var document = PdfDocument.Open(pdfStream);
        foreach (var page in document.GetPages())
        {
            // Lấy text theo thứ tự đọc tự nhiên (top-to-bottom, left-to-right)
            var words = page.GetWords();
            foreach (var word in words)
                sb.Append(word.Text).Append(' ');
            sb.AppendLine(); // Ngắt dòng giữa các trang
        }
        return sb.ToString();
    }

    // ─── BƯỚC 2: LLM call (OpenAI-compatible endpoint) ───
    private async Task<ParsedSyllabusDto> CallLlmAsync(string rawText, CancellationToken ct)
    {
        var baseUrl  = _config["AiProvider:BaseUrl"]  ?? "https://api.openai.com/v1";
        var apiKey   = _config["AiProvider:ApiKey"]   ?? "";
        var model    = _config["AiProvider:Model"]    ?? "gpt-4o-mini";
        int maxChars = 80_000; // giới hạn để tránh vượt context window

        if (rawText.Length > maxChars)
        {
            _logger.LogWarning("[SyllabusParser] Text quá dài ({L} chars), truncate về {M}", rawText.Length, maxChars);
            rawText = rawText[..maxChars];
        }

        var requestBody = new
        {
            model,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = SystemPrompt },
                new { role = "user",   content = $"Đây là nội dung PDF lộ trình học:\n\n{rawText}" }
            },
            temperature = 0.2
        };

        var http = _httpFactory.CreateClient();
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

        var json    = JsonSerializer.Serialize(requestBody);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var url     = $"{baseUrl.TrimEnd('/')}/chat/completions";

        var response = await http.PostAsync(url, content, ct);
        var body     = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("[SyllabusParser] LLM API error {Status}: {Body}", response.StatusCode, body);
            throw new HttpRequestException($"LLM API trả về lỗi {(int)response.StatusCode}: {body[..Math.Min(300, body.Length)]}");
        }

        // Trích content từ response OpenAI format
        using var doc    = JsonDocument.Parse(body);
        var messageContent = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? "{}";

        // Parse JSON trả về từ LLM thành intermediate object
        var llmJson = JsonDocument.Parse(messageContent).RootElement;
        return MapLlmJsonToDto(llmJson);
    }

    private static ParsedSyllabusDto MapLlmJsonToDto(JsonElement root)
    {
        var result = new ParsedSyllabusDto
        {
            CourseTitle = TryGetString(root, "courseTitle"),
            JlptLevel   = TryGetString(root, "jlptLevel", "N5"),
            Description = TryGetString(root, "description"),
        };

        int globalDayNumber = 0;
        if (root.TryGetProperty("sections", out var sectionsEl))
        {
            int sOrder = 0;
            foreach (var sec in sectionsEl.EnumerateArray())
            {
                sOrder++;
                var sectionDto = new ParsedSectionDto
                {
                    DisplayOrder = sec.TryGetProperty("displayOrder", out var dv) ? dv.GetInt32() : sOrder,
                    Title        = TryGetString(sec, "title", $"Tuần {sOrder}"),
                };

                if (sec.TryGetProperty("lessons", out var lessonsEl))
                {
                    int lOrder = 0;
                    foreach (var lesson in lessonsEl.EnumerateArray())
                    {
                        lOrder++;
                        globalDayNumber++;

                        // estimatedDurationMinutes có thể là string hoặc number từ LLM
                        int durationMinutes = 45;
                        if (lesson.TryGetProperty("estimatedDurationMinutes", out var durEl))
                        {
                            if (durEl.ValueKind == JsonValueKind.String)
                                durationMinutes = DurationParserHelper.Parse(durEl.GetString());
                            else if (durEl.ValueKind == JsonValueKind.Number)
                                durationMinutes = durEl.GetInt32();
                        }

                        var lessonDto = new ParsedLessonDto
                        {
                            DisplayOrder              = lesson.TryGetProperty("displayOrder", out var ldv) ? ldv.GetInt32() : lOrder,
                            DayNumber                 = lesson.TryGetProperty("dayNumber", out var dn) ? dn.GetInt32() : globalDayNumber,
                            Title                     = TryGetString(lesson, "title", $"Ngày {globalDayNumber}"),
                            Description               = TryGetString(lesson, "description"),
                            EstimatedDurationMinutes  = durationMinutes,
                            Skills                    = GetStringArray(lesson, "skills"),
                            SearchKeywords            = GetStringArray(lesson, "searchKeywords"),
                        };

                        sectionDto.Lessons.Add(lessonDto);
                    }
                }

                result.Sections.Add(sectionDto);
            }
        }

        return result;
    }

    // ─── BƯỚC 3: Levenshtein Fuzzy Match ───
    private async Task AttachDriveSuggestionsAsync(ParsedSyllabusDto syllabus, CancellationToken ct)
    {
        // Chỉ load file media hợp lệ, tránh full scan cả bảng DriveNodes
        var driveFiles = await _db.DriveNodes
            .AsNoTracking()
            .Where(n => n.NodeType == Domain.Enums.NodeType.File
                     && !n.IsDeletedInDrive
                     && n.FileExtension != null
                     && AllowedExtensions.Contains(n.FileExtension))
            .Select(n => new { n.Id, n.Name, n.WebViewLink, n.FileExtension, n.MimeType })
            .ToListAsync(ct);

        _logger.LogInformation("[SyllabusParser] Fuzzy matching với {Count} DriveNodes media", driveFiles.Count);

        foreach (var section in syllabus.Sections)
        {
            foreach (var lesson in section.Lessons)
            {
                if (!lesson.SearchKeywords.Any())
                    continue;

                // Với mỗi keyword, tính score tốt nhất với từng file
                var scored = new List<(Guid Id, string Name, string? WebViewLink, string Ext, int Score, string Keyword)>();

                foreach (var keyword in lesson.SearchKeywords)
                {
                    foreach (var file in driveFiles)
                    {
                        int score = FuzzyScore(keyword, file.Name);
                        if (score >= 30) // ngưỡng tối thiểu 30%
                            scored.Add((file.Id, file.Name, file.WebViewLink, file.FileExtension ?? "", score, keyword));
                    }
                }

                // Dedup theo DriveNodeId, lấy score cao nhất, top 3
                var top3 = scored
                    .GroupBy(x => x.Id)
                    .Select(g => g.OrderByDescending(x => x.Score).First())
                    .OrderByDescending(x => x.Score)
                    .Take(3)
                    .Select(x => new SuggestedDriveFileDto
                    {
                        DriveNodeId     = x.Id,
                        FileName        = x.Name,
                        WebViewLink     = x.WebViewLink,
                        MatchScore      = x.Score,
                        MatchedKeyword  = x.Keyword,
                        ResourceType    = InferResourceType(x.Ext)
                    })
                    .ToList();

                lesson.SuggestedDriveFiles = top3;
            }
        }
    }

    /// <summary>
    /// Tính điểm Levenshtein similarity giữa keyword và tên file.
    /// Chuẩn hóa cả hai về lowercase, bỏ dấu cách thừa trước khi so sánh.
    /// Trả về 0–100.
    /// </summary>
    private static int FuzzyScore(string keyword, string fileName)
    {
        var kw   = keyword.ToLowerInvariant().Trim();
        var name = fileName.ToLowerInvariant().Trim();

        // Bonus: chứa chuỗi con trực tiếp → score cao hơn
        if (name.Contains(kw))
            return 90 + Math.Min(10, kw.Length); // 90–100

        int dist = LevenshteinDistance(kw, name.Length > 50 ? name[..50] : name);
        int maxLen = Math.Max(kw.Length, name.Length);
        if (maxLen == 0) return 100;

        int score = (int)((1.0 - (double)dist / maxLen) * 100);
        return Math.Max(0, score);
    }

    /// <summary>Pure C# Levenshtein distance — không cần NuGet thêm.</summary>
    private static int LevenshteinDistance(string s, string t)
    {
        if (s.Length == 0) return t.Length;
        if (t.Length == 0) return s.Length;

        int[,] dp = new int[s.Length + 1, t.Length + 1];
        for (int i = 0; i <= s.Length; i++) dp[i, 0] = i;
        for (int j = 0; j <= t.Length; j++) dp[0, j] = j;

        for (int i = 1; i <= s.Length; i++)
            for (int j = 1; j <= t.Length; j++)
            {
                int cost = s[i - 1] == t[j - 1] ? 0 : 1;
                dp[i, j] = Math.Min(
                    Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1),
                    dp[i - 1, j - 1] + cost);
            }

        return dp[s.Length, t.Length];
    }

    private static ResourceType InferResourceType(string ext) => ext.ToLowerInvariant() switch
    {
        ".mp4"        => ResourceType.PrimaryVideo,
        ".mp3" or ".m4a" => ResourceType.Audio,
        ".pdf"        => ResourceType.ExercisePdf,
        _             => ResourceType.Other
    };

    // ═══════════════════════════════════════════════════════════
    //  BƯỚC 4: Lưu Template vào DB
    // ═══════════════════════════════════════════════════════════

    public async Task<RoadmapTemplateDto> SaveRoadmapTemplateAsync(
        SaveRoadmapTemplateRequestDto dto, CancellationToken ct = default)
    {
        // Flatten tất cả lessons để tính tổng
        var allLessons = dto.Sections.SelectMany(s => s.Lessons).ToList();
        int totalDays      = allLessons.Count;
        int totalMinutes   = allLessons.Sum(l => l.EstimatedDurationMinutes);

        var template = new RoadmapTemplate
        {
            Title                 = dto.Title,
            JlptLevel             = dto.JlptLevel,
            Description           = dto.Description,
            SourcePdfName         = dto.SourcePdfName,
            TotalDays             = totalDays,
            TotalEstimatedMinutes = totalMinutes,
            IsPublished           = false,
            CreatedAtUtc          = DateTime.UtcNow
        };

        _db.RoadmapTemplates.Add(template);

        int itemOrder = 0;
        foreach (var section in dto.Sections.OrderBy(s => s.DisplayOrder))
        {
            foreach (var lesson in section.Lessons.OrderBy(l => l.DayNumber))
            {
                itemOrder++;
                var item = new RoadmapItem
                {
                    RoadmapTemplateId        = template.Id,
                    DayNumber                = lesson.DayNumber > 0 ? lesson.DayNumber : itemOrder,
                    Title                    = lesson.Title,
                    Description              = lesson.Description,
                    EstimatedDurationMinutes = lesson.EstimatedDurationMinutes,
                    SkillsJson               = JsonSerializer.Serialize(lesson.Skills),
                    SearchKeywordsJson       = JsonSerializer.Serialize(lesson.SearchKeywords),
                    LinkedLessonId           = lesson.LinkedLessonId,
                };

                foreach (var file in lesson.ConfirmedDriveFiles.Take(3))
                {
                    item.DriveFiles.Add(new RoadmapItemDriveFile
                    {
                        DriveNodeId  = file.DriveNodeId,
                        MatchScore   = file.MatchScore,
                        ResourceType = file.ResourceType,
                        DisplayOrder = file.DisplayOrder,
                    });
                }

                template.Items.Add(item);
            }
        }

        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("[SyllabusParser] Đã lưu template '{Title}' với {N} items", template.Title, template.Items.Count);

        return await BuildTemplateDtoAsync(template.Id, ct);
    }

    // ─── Helper: Build RoadmapTemplateDto với eager load ───
    private async Task<RoadmapTemplateDto> BuildTemplateDtoAsync(Guid templateId, CancellationToken ct)
    {
        var t = await _db.RoadmapTemplates
            .AsNoTracking()
            .Include(x => x.Items.OrderBy(i => i.DayNumber))
                .ThenInclude(i => i.DriveFiles.OrderBy(f => f.DisplayOrder))
                    .ThenInclude(f => f.DriveNode)
            .Include(x => x.Items)
                .ThenInclude(i => i.LinkedLesson)
            .FirstOrDefaultAsync(x => x.Id == templateId, ct)
            ?? throw new KeyNotFoundException($"RoadmapTemplate {templateId} không tìm thấy.");

        return MapToTemplateDto(t);
    }

    internal static RoadmapTemplateDto MapToTemplateDto(RoadmapTemplate t) => new()
    {
        Id                   = t.Id,
        Title                = t.Title,
        JlptLevel            = t.JlptLevel,
        Description          = t.Description,
        TotalDays            = t.TotalDays,
        TotalEstimatedMinutes = t.TotalEstimatedMinutes,
        SourcePdfName        = t.SourcePdfName,
        IsPublished          = t.IsPublished,
        CreatedAtUtc         = t.CreatedAtUtc,
        Items = t.Items.OrderBy(i => i.DayNumber).Select(i => new RoadmapItemDto
        {
            Id                       = i.Id,
            DayNumber                = i.DayNumber,
            Title                    = i.Title,
            Description              = i.Description,
            EstimatedDurationMinutes = i.EstimatedDurationMinutes,
            Skills                   = TryDeserializeList(i.SkillsJson),
            SearchKeywords           = TryDeserializeList(i.SearchKeywordsJson),
            LinkedLessonId           = i.LinkedLessonId,
            LinkedLessonTitle        = i.LinkedLesson?.Title,
            DriveFiles = i.DriveFiles.OrderBy(f => f.DisplayOrder).Select(f => new RoadmapItemDriveFileDto
            {
                Id           = f.Id,
                DriveNodeId  = f.DriveNodeId,
                FileName     = f.DriveNode?.Name ?? string.Empty,
                WebViewLink  = f.DriveNode?.WebViewLink,
                MatchScore   = f.MatchScore,
                ResourceType = f.ResourceType,
                DisplayOrder = f.DisplayOrder,
            }).ToList()
        }).ToList()
    };

    // ─── JSON helpers ───
    private static string TryGetString(JsonElement el, string key, string defaultValue = "")
    {
        return el.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? defaultValue
            : defaultValue;
    }

    private static List<string> GetStringArray(JsonElement el, string key)
    {
        if (!el.TryGetProperty(key, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return new();
        return arr.EnumerateArray()
            .Where(x => x.ValueKind == JsonValueKind.String)
            .Select(x => x.GetString()!)
            .ToList();
    }

    private static List<string> TryDeserializeList(string json)
    {
        try { return JsonSerializer.Deserialize<List<string>>(json) ?? new(); }
        catch { return new(); }
    }
}
