using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
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
        ".mp4", ".mp3", ".m4a", ".pdf", ".docx", ".doc"
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
        5. For searchKeywords: generate 3–5 tokens likely present in Google Drive filenames or folder paths
           (e.g., ["B26", "Bai 26", "Kanji 26", "Tu vung 26", "Ngu phap 26"]).
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
    //  BƯỚC 1-3: Parse PDF → LLM → Path-Aware Context Matching
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

        // BƯỚC 3 — Path-Aware matching Drive files
        _logger.LogInformation("[SyllabusParser] Bước 3: Path-Aware matching DriveNodes cho {N} sections", llmResult.Sections.Count);
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
            var words = page.GetWords();
            foreach (var word in words)
                sb.Append(word.Text).Append(' ');
            sb.AppendLine();
        }
        return sb.ToString();
    }

    // ─── BƯỚC 2: LLM call ───
    private async Task<ParsedSyllabusDto> CallLlmAsync(string rawText, CancellationToken ct)
    {
        var baseUrl  = _config["AiProvider:BaseUrl"]  ?? "https://generativelanguage.googleapis.com/v1beta/openai/";
        var apiKey   = _config["AiProvider:ApiKey"]   ?? "";
        var model    = _config["AiProvider:Model"]    ?? "gemini-3.6-flash";
        int maxChars = 80_000;

        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Chưa cấu hình API Key AI.");

        if (rawText.Length > maxChars)
            rawText = rawText[..maxChars];

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
        http.Timeout = TimeSpan.FromMinutes(2);
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
            throw new HttpRequestException($"LLM API trả về lỗi {(int)response.StatusCode}");
        }

        using var doc = JsonDocument.Parse(body);
        var messageContent = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "{}";
        return MapLlmJsonToDto(JsonDocument.Parse(messageContent).RootElement);
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

    // ─── BƯỚC 3: Multi-Tier Path-Aware Context Matching ───
    private async Task AttachDriveSuggestionsAsync(ParsedSyllabusDto syllabus, CancellationToken ct)
    {
        // 1. Tải toàn bộ files media hợp lệ từ DriveNodes — KHÔNG dùng Take(500)
        var allDriveFiles = await _db.DriveNodes
            .AsNoTracking()
            .Where(n => n.NodeType == Domain.Enums.NodeType.File
                     && !n.IsDeletedInDrive
                     && n.FileExtension != null
                     && AllowedExtensions.Contains(n.FileExtension.ToLower()))
            .Select(n => new
            {
                n.Id,
                n.Name,
                n.RawPath,
                n.WebViewLink,
                n.FileExtension,
                n.MimeType
            })
            .ToListAsync(ct);

        _logger.LogInformation("[SyllabusParser] Đã tải {Count} file media trong DB cho Multi-Tier Matching", allDriveFiles.Count);

        // Pre-compute normalized path & file metadata
        var candidatePool = allDriveFiles.Select(f =>
        {
            var raw = f.RawPath ?? string.Empty;
            var fullPath = string.IsNullOrWhiteSpace(raw) ? f.Name : $"{raw.TrimEnd('/')}/{f.Name}";
            var normFullPath = RemoveDiacritics(fullPath);
            var normName = RemoveDiacritics(f.Name);
            var ext = (f.FileExtension ?? string.Empty).ToLowerInvariant();
            return new
            {
                f.Id,
                f.Name,
                f.RawPath,
                FullPath = fullPath,
                NormFullPath = normFullPath,
                NormName = normName,
                f.WebViewLink,
                FileExtension = ext,
                f.MimeType
            };
        }).ToList();

        var courseLevel = syllabus.JlptLevel ?? "N4";

        foreach (var section in syllabus.Sections)
        {
            foreach (var lesson in section.Lessons)
            {
                var lessonNumber = ExtractLessonNumber(lesson.Title, lesson.SearchKeywords);
                var scored = new List<(Guid Id, string DisplayName, string? RawPath, string? WebViewLink, int Score, string MatchedKeyword, ResourceType Type)>();

                foreach (var file in candidatePool)
                {
                    int score = ComputeMultiTierScore(
                        file.NormFullPath,
                        file.NormName,
                        file.FileExtension,
                        lesson,
                        lessonNumber,
                        courseLevel,
                        out string bestKeyword);

                    if (score >= 40) // Ngưỡng điểm chấp nhận
                    {
                        var resType = InferResourceType(file.FileExtension, file.NormFullPath);
                        scored.Add((file.Id, file.Name, file.RawPath, file.WebViewLink, score, bestKeyword, resType));
                    }
                }

                // Sắp xếp theo score giảm dần, lấy top 3 không trùng Id
                lesson.SuggestedDriveFiles = scored
                    .GroupBy(x => x.Id)
                    .Select(g => g.OrderByDescending(x => x.Score).First())
                    .OrderByDescending(x => x.Score)
                    .Take(3)
                    .Select(x => new SuggestedDriveFileDto
                    {
                        DriveNodeId     = x.Id,
                        FileName        = x.DisplayName,
                        RawPath         = x.RawPath,
                        WebViewLink     = x.WebViewLink,
                        MatchScore      = Math.Min(100, x.Score),
                        MatchedKeyword  = x.MatchedKeyword,
                        ResourceType    = x.Type
                    })
                    .ToList();
            }
        }
    }

    /// <summary>
    /// Thuật toán chấm điểm Multi-Tier Context Matching:
    /// Tier 1: Khớp chính xác thư mục bài học & thư mục con kỹ năng (1. Chữ hán, 2. Ngữ pháp, 4. Từ vựng...) (80-100đ)
    /// Tier 2: Khớp tài liệu riêng theo bài nằm ở folder ngoài (Tổng hợp ngữ pháp tài liệu bài 25-50 minna/...) (70-85đ)
    /// Tier 3: Khớp giáo trình/audio dùng chung cho toàn khóa (0.0 Tài liệu khóa học N4, Audio 50 bài minna...) (50-65đ)
    /// </summary>
    private static int ComputeMultiTierScore(
        string normFullPath,
        string normFileName,
        string fileExt,
        ParsedLessonDto lesson,
        int? lessonNumber,
        string courseLevel,
        out string bestKeyword)
    {
        int score = 0;
        bestKeyword = string.Empty;
        var ext = fileExt.ToLowerInvariant();

        // ─── Phân tích kỹ năng mục tiêu của bài học ───
        var titleLower = RemoveDiacritics(lesson.Title);
        var skillsLower = lesson.Skills.Select(s => RemoveDiacritics(s)).ToList();

        bool isKanji   = skillsLower.Any(s => s.Contains("kanji") || s.Contains("han")) || titleLower.Contains("kanji") || titleLower.Contains("chu han") || titleLower.Contains("bo thu");
        bool isGrammar = skillsLower.Any(s => s.Contains("grammar") || s.Contains("ngu phap") || s.Contains("bunpou") || s.Contains("bunpo")) || titleLower.Contains("ngu phap") || titleLower.Contains("bunpou");
        bool isVocab   = skillsLower.Any(s => s.Contains("vocab") || s.Contains("tu vung") || s.Contains("kotoba")) || titleLower.Contains("tu vung") || titleLower.Contains("kotoba");
        bool isChoukai = skillsLower.Any(s => s.Contains("choukai") || s.Contains("chokai") || s.Contains("nghe")) || titleLower.Contains("nghe") || titleLower.Contains("choukai");
        bool isKaiwa   = skillsLower.Any(s => s.Contains("kaiwa") || s.Contains("hoi thoai")) || titleLower.Contains("kaiwa") || titleLower.Contains("hoi thoai");
        bool isDokkai  = skillsLower.Any(s => s.Contains("dokkai") || s.Contains("doc")) || titleLower.Contains("doc") || titleLower.Contains("dokkai");
        bool isQuiz    = skillsLower.Any(s => s.Contains("quiz") || s.Contains("test") || s.Contains("kiem tra") || s.Contains("bai tap")) || titleLower.Contains("test") || titleLower.Contains("kiem tra") || titleLower.Contains("bai tap");

        // ─── TIER 1 & TIER 2: Có số bài học ───
        if (lessonNumber.HasValue)
        {
            int num = lessonNumber.Value;
            var numStr = num.ToString();
            var numPadded = num < 10 ? $"0{num}" : numStr;

            // Kiểm tra xem file có thuộc bài học này không (trong folder "Bài 26" hoặc tên file "bài 26", "bai 26-min", "026"...)
            bool isLessonFile = normFullPath.Contains($"bai {numStr}")
                             || normFullPath.Contains($"bai_{numStr}")
                             || normFullPath.Contains($"bai-{numStr}")
                             || normFullPath.Contains($"bai{numStr}")
                             || normFullPath.Contains($"b{numStr}")
                             || normFullPath.Contains($"/{numStr}/")
                             || normFullPath.Contains($"lesson {numStr}")
                             || normFullPath.Contains($"minna bai {numStr}")
                             || normFullPath.Contains($"bai {numPadded}")
                             || normFullPath.Contains($"track {numStr}")
                             || normFullPath.Contains($"track {numPadded}")
                             || normFullPath.Contains($"_{numPadded}.");

            if (isLessonFile)
            {
                // Kiểm tra xem có bị dính sang bài khác không (ví dụ "bài 26" vs "bài 27")
                bool wrongLesson = false;
                for (int other = 1; other <= 50; other++)
                {
                    if (other == num) continue;
                    var oStr = other.ToString();
                    // Nếu đường dẫn chứa rõ ràng bài khác mà không chứa bài hiện tại
                    if ((normFullPath.Contains($"bai {oStr}") || normFullPath.Contains($"/{oStr}/")) && !normFullPath.Contains($"bai {numStr}") && !normFullPath.Contains($"/{numStr}/"))
                    {
                        wrongLesson = true;
                        break;
                    }
                }

                if (!wrongLesson)
                {
                    score += 55;
                    bestKeyword = $"Bài {numStr}";

                    // ─── Phân giải sâu ngữ cảnh Sub-folder & File cụ thể trong Bài ───

                    // 1. Kỹ năng Kanji (Chữ hán)
                    if (isKanji)
                    {
                        if (normFullPath.Contains("1. chu han") || normFullPath.Contains("chu han") || normFullPath.Contains("kanji") || normFullPath.Contains("bo thu"))
                        {
                            score += 35;
                            bestKeyword = "Chữ Hán";
                            if (ext == ".mp4") score += 10; // Video bài giảng chữ Hán
                            if (normFullPath.Contains("bai tap chu han")) score += 5;
                        }
                        else if (normFullPath.Contains("2. ngu phap") || normFullPath.Contains("4. nghe hieu") || normFullPath.Contains("5. doc hieu"))
                        {
                            score -= 30; // Tránh nhầm video Ngữ pháp/Nghe hiểu vào tiết Chữ hán
                        }
                    }

                    // 2. Kỹ năng Ngữ pháp (Grammar)
                    if (isGrammar)
                    {
                        if (normFullPath.Contains("2. ngu phap") || normFullPath.Contains("3. tong hop ngu phap") || normFullPath.Contains("ngu phap") || normFullPath.Contains("bunpou"))
                        {
                            score += 35;
                            bestKeyword = "Ngữ pháp";
                            if (ext == ".mp4") score += 10; // Video ngữ pháp
                            if (ext == ".pdf" && normFullPath.Contains("minna")) score += 8; // PDF tổng hợp ngữ pháp
                        }
                        else if (normFullPath.Contains("1. chu han") || normFullPath.Contains("4. nghe hieu") || normFullPath.Contains("5. doc hieu"))
                        {
                            score -= 30;
                        }
                    }

                    // 3. Kỹ năng Từ vựng (Vocabulary)
                    if (isVocab)
                    {
                        if (normFullPath.Contains("tu vung") || normFullPath.Contains("kotoba"))
                        {
                            score += 35;
                            bestKeyword = "Từ vựng";
                            if (ext == ".mp4" || ext == ".pdf") score += 10;
                        }
                    }

                    // 4. Kỹ năng Hội thoại (Kaiwa)
                    if (isKaiwa)
                    {
                        if (normFullPath.Contains("hoi thoai") || normFullPath.Contains("kaiwa") || normFullPath.Contains("7. hoi thoai"))
                        {
                            score += 40;
                            bestKeyword = "Hội thoại";
                            if (ext == ".mp4") score += 10;
                        }
                    }

                    // 5. Kỹ năng Nghe hiểu (Choukai)
                    if (isChoukai)
                    {
                        if (normFullPath.Contains("4. nghe hieu") || normFullPath.Contains("nghe hieu") || normFullPath.Contains("choukai") || normFullPath.Contains("chokai") || normFullPath.Contains("audio"))
                        {
                            score += 35;
                            bestKeyword = "Nghe hiểu";
                            if (ext == ".mp3" || ext == ".m4a" || ext == ".mp4") score += 10;
                        }
                    }

                    // 6. Kỹ năng Đọc hiểu (Dokkai)
                    if (isDokkai)
                    {
                        if (normFullPath.Contains("5. doc hieu") || normFullPath.Contains("doc hieu") || normFullPath.Contains("dokkai"))
                        {
                            score += 40;
                            bestKeyword = "Đọc hiểu";
                            if (ext == ".mp4" || ext == ".pdf") score += 10;
                        }
                    }

                    // 7. Kỹ năng Test / Quiz / Bài tập
                    if (isQuiz)
                    {
                        if (normFullPath.Contains("test tong hop") || normFullPath.Contains("test") || normFullPath.Contains("kiem tra") || normFullPath.Contains("bai tap"))
                        {
                            score += 40;
                            bestKeyword = "Test / Bài tập";
                            if (ext == ".docx" || ext == ".pdf" || ext == ".doc") score += 10;
                        }
                    }
                }
            }
        }

        // ─── TIER 3: Tài liệu & Giáo trình DÙNG CHUNG cho cả khóa (0.0 Tài liệu khóa học N4, Audio 50 bài...) ───
        if (score < 60)
        {
            var normLevel = RemoveDiacritics(courseLevel); // e.g. "n4", "n5"
            bool isCourseLevelFile = normFullPath.Contains(normLevel) || normFullPath.Contains("tai lieu khoa hoc") || normFullPath.Contains("50 bai minna");

            if (isCourseLevelFile)
            {
                if (isKanji && (normFullPath.Contains("kanji") || normFullPath.Contains("chu han")))
                {
                    score = Math.Max(score, 62);
                    bestKeyword = $"{courseLevel} Kanji (Tài liệu chung)";
                }
                else if (isGrammar && (normFullPath.Contains("giai thich ngu phap") || normFullPath.Contains("ngu phap") || normFullPath.Contains("sach giao khoa")))
                {
                    score = Math.Max(score, 62);
                    bestKeyword = $"{courseLevel} Ngữ pháp (Tài liệu chung)";
                }
                else if (isVocab && (normFullPath.Contains("tu vung") || normFullPath.Contains("kotoba")))
                {
                    score = Math.Max(score, 62);
                    bestKeyword = $"{courseLevel} Từ vựng (Tài liệu chung)";
                }
                else if (isDokkai && normFullPath.Contains("doc hieu"))
                {
                    score = Math.Max(score, 62);
                    bestKeyword = $"{courseLevel} Sách đọc hiểu";
                }
                else if (isChoukai && (normFullPath.Contains("nghe hieu") || normFullPath.Contains("audio")))
                {
                    score = Math.Max(score, 62);
                    bestKeyword = $"{courseLevel} Sách nghe hiểu";
                }
                else if (normFullPath.Contains("sach giao khoa"))
                {
                    score = Math.Max(score, 55);
                    bestKeyword = $"{courseLevel} Sách giáo khoa";
                }
            }
        }

        // Khớp thêm các search keywords bổ trợ từ LLM
        foreach (var kw in lesson.SearchKeywords)
        {
            if (string.IsNullOrWhiteSpace(kw)) continue;
            var normKw = RemoveDiacritics(kw);
            if (normFullPath.Contains(normKw))
            {
                score += 15;
                if (string.IsNullOrEmpty(bestKeyword)) bestKeyword = kw;
            }
        }

        return score;
    }

    private static int? ExtractLessonNumber(string title, List<string> keywords)
    {
        var m = Regex.Match(title, @"(?:bài|bai|b|lesson)\s*(\d{1,3})", RegexOptions.IgnoreCase);
        if (m.Success && int.TryParse(m.Groups[1].Value, out int n1)) return n1;

        foreach (var kw in keywords)
        {
            var km = Regex.Match(kw, @"(?:bài|bai|b|lesson)?\s*(\d{1,3})", RegexOptions.IgnoreCase);
            if (km.Success && int.TryParse(km.Groups[1].Value, out int nk) && nk >= 1 && nk <= 150)
                return nk;
        }

        var nm = Regex.Match(title, @"ngày\s*(\d{1,3})", RegexOptions.IgnoreCase);
        if (nm.Success && int.TryParse(nm.Groups[1].Value, out int nd) && nd >= 1 && nd <= 50)
            return nd;

        return null;
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

    private static ResourceType InferResourceType(string ext, string normFullPath)
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

    // ═══════════════════════════════════════════════════════════
    //  BƯỚC 4: Lưu Template vào DB
    // ═══════════════════════════════════════════════════════════

    public async Task<RoadmapTemplateDto> SaveRoadmapTemplateAsync(
        SaveRoadmapTemplateRequestDto dto, CancellationToken ct = default)
    {
        var allLessons = dto.Sections.SelectMany(s => s.Lessons).ToList();
        var template = new RoadmapTemplate
        {
            Title                 = dto.Title,
            JlptLevel             = dto.JlptLevel,
            Description           = dto.Description,
            SourcePdfName         = dto.SourcePdfName,
            TotalDays             = allLessons.Count,
            TotalEstimatedMinutes = allLessons.Sum(l => l.EstimatedDurationMinutes),
            IsPublished           = true,
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
        _logger.LogInformation("[SyllabusParser] Đã lưu template '{Title}' (IsPublished=true) với {N} items", template.Title, template.Items.Count);
        return await BuildTemplateDtoAsync(template.Id, ct);
    }

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
