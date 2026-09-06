using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class FolderCourseBuilderService : IFolderCourseBuilderService
{
    private readonly LmsDbContext _dbContext;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    private readonly ISystemSettingsService _systemSettingsService;
    private readonly ILogger<FolderCourseBuilderService> _logger;

    public FolderCourseBuilderService(
        LmsDbContext dbContext,
        IHttpClientFactory httpFactory,
        IConfiguration config,
        ISystemSettingsService systemSettingsService,
        ILogger<FolderCourseBuilderService> logger)
    {
        _dbContext = dbContext;
        _httpFactory = httpFactory;
        _config = config;
        _systemSettingsService = systemSettingsService;
        _logger = logger;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  1. HEURISTIC AUTO-DETECTION & TREE PREVIEW
    // ═════════════════════════════════════════════════════════════════════════

    public async Task<AutoDetectFolderResultDto> DetectFolderStructureAsync(Guid rootFolderId, CancellationToken ct = default)
    {
        var rootNode = await _dbContext.DriveNodes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == rootFolderId, ct);

        if (rootNode == null)
            throw new KeyNotFoundException($"Root folder with ID {rootFolderId} not found.");

        var rootCleanFullPath = GetEffectiveNodePath(rootNode.RawPath, rootNode.Name);
        var rootSegmentsCount = rootCleanFullPath.Split('/', StringSplitOptions.RemoveEmptyEntries).Length;

        // Fetch all descendants in the subtree
        var allDescendants = await _dbContext.DriveNodes
            .AsNoTracking()
            .Where(n => !n.IsDeletedInDrive)
            .Select(n => new
            {
                n.Id,
                n.ParentNodeId,
                n.Name,
                n.NodeType,
                n.RawPath,
                n.FileExtension,
                n.MimeType,
                n.Size,
                n.WebViewLink
            })
            .ToListAsync(ct);

        var descendantsInSubtree = allDescendants
            .Where(n => IsNodeInSubtree(n.RawPath, n.Name, n.ParentNodeId, n.Id, rootCleanFullPath, rootFolderId))
            .ToList();

        var subFolders = descendantsInSubtree.Where(n => n.NodeType == NodeType.Folder && n.Id != rootFolderId).ToList();
        var files = descendantsInSubtree.Where(n => n.NodeType == NodeType.File).ToList();

        // Calculate relative depths
        int maxDepth = 1;
        var folderDepths = new Dictionary<Guid, int>();

        foreach (var folder in subFolders)
        {
            var p = GetEffectiveNodePath(folder.RawPath, folder.Name);
            string relPath = "";
            if (p.Length > rootCleanFullPath.Length && p.StartsWith(rootCleanFullPath + "/", StringComparison.OrdinalIgnoreCase))
            {
                relPath = p.Substring(rootCleanFullPath.Length + 1);
            }
            else if (p.Contains("/" + rootCleanFullPath + "/", StringComparison.OrdinalIgnoreCase))
            {
                var idx = p.IndexOf("/" + rootCleanFullPath + "/", StringComparison.OrdinalIgnoreCase);
                relPath = p.Substring(idx + rootCleanFullPath.Length + 2);
            }
            var segs = relPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            int relDepth = segs.Length > 0 ? segs.Length : Math.Max(1, p.Split('/', StringSplitOptions.RemoveEmptyEntries).Length - rootSegmentsCount);
            folderDepths[folder.Id] = relDepth;
            if (relDepth > maxDepth) maxDepth = relDepth;
        }

        // Heuristic analysis of folder names
        bool hasBaiPattern = subFolders.Any(f => Regex.IsMatch(f.Name, @"(?:bai|b)[\s_-]*\d+", RegexOptions.IgnoreCase));
        bool hasChangPattern = subFolders.Any(f => Regex.IsMatch(f.Name, @"(?:chang|chặng|giai đoạn)[\s_-]*\d+", RegexOptions.IgnoreCase));
        bool hasChuongPattern = subFolders.Any(f => Regex.IsMatch(f.Name, @"(?:chuong|chương)[\s_-]*\d+", RegexOptions.IgnoreCase));

        string detectedPreset = "minna-lesson";
        string rationale;
        int suggestedSecDepth = 1;
        int suggestedLesDepth = 2;
        bool combineParentStages = false;
        string groupingMode = "single-folder";
        bool includeLeaf = true;

        if (hasChangPattern || (maxDepth >= 3 && !hasBaiPattern))
        {
            detectedPreset = "stage-skill-chapter";
            suggestedSecDepth = 2; // Cấp Kỹ Năng
            suggestedLesDepth = 3; // Cấp Chương / Dạng bài
            combineParentStages = true;
            groupingMode = "combine-stage-skill";
            includeLeaf = true;
            rationale = "Phát hiện cấu trúc Chặng (Chặng 1, Chặng 2) kết hợp Kỹ năng & Chương. Tự động áp dụng Gộp [Chặng + Kỹ năng] làm Section.";
        }
        else if (hasBaiPattern)
        {
            detectedPreset = "minna-lesson";
            var baiFolder = subFolders.FirstOrDefault(f => Regex.IsMatch(f.Name, @"(?:bai|b)[\s_-]*\d+", RegexOptions.IgnoreCase));
            if (baiFolder != null && folderDepths.TryGetValue(baiFolder.Id, out int bDepth))
            {
                suggestedSecDepth = bDepth;
                suggestedLesDepth = bDepth + 1;
            }
            else
            {
                suggestedSecDepth = 1;
                suggestedLesDepth = 2;
            }
            combineParentStages = false;
            groupingMode = "single-folder";
            includeLeaf = true;
            rationale = "Phát hiện cấu trúc theo Bài học Minna (Bài 1..50) và các thư mục kỹ năng con.";
        }
        else if (hasChuongPattern)
        {
            detectedPreset = "flat-chapters";
            suggestedSecDepth = 1;
            suggestedLesDepth = 2;
            combineParentStages = false;
            groupingMode = "flat-chapters";
            includeLeaf = true;
            rationale = "Phát hiện cấu trúc phân chia theo Chương hoặc Chuyên đề.";
        }
        else
        {
            detectedPreset = "minna-lesson";
            suggestedSecDepth = 1;
            suggestedLesDepth = Math.Min(2, maxDepth);
            combineParentStages = false;
            groupingMode = "single-folder";
            includeLeaf = true;
            rationale = $"Phân tích độ sâu thư mục (Độ sâu tối đa {maxDepth} cấp).";
        }

        // Build folder tree preview (up to depth 3)
        var treePreview = BuildFolderTreePreview(rootNode.Id, subFolders.Select(f => new FolderItem
        {
            Id = f.Id,
            ParentNodeId = f.ParentNodeId,
            Name = f.Name,
            NodeType = (int)f.NodeType,
            RawPath = f.RawPath,
            RelativeDepth = folderDepths.GetValueOrDefault(f.Id, 1)
        }).ToList(), files.Select(fl => new FileItem
        {
            Id = fl.Id,
            ParentNodeId = fl.ParentNodeId,
            Name = fl.Name,
            RawPath = fl.RawPath
        }).ToList(), maxPreviewDepth: 3);

        var suggestedConfig = new FolderMappingConfigDto
        {
            RootFolderNodeId = rootNode.Id,
            CourseTitle = rootNode.Name,
            JlptLevel = InferJlptLevelFromPath(rootCleanFullPath),
            PresetName = detectedPreset,
            SectionGroupingMode = groupingMode,
            CombineParentStages = combineParentStages,
            SectionFolderDepth = suggestedSecDepth,
            LessonFolderDepth = suggestedLesDepth,
            IncludeLeafFilesAsLessons = includeLeaf,
            ExcludeFolderPatterns = new List<string> { "*lộ trình*", "*lo trinh*", "*file sách*", "*file sach*", "*hướng dẫn*", "*huong dan*" }
        };

        var availablePresets = new List<FolderPresetInfoDto>
        {
            new()
            {
                PresetId = "stage-skill-chapter",
                Name = "Gộp [Chặng + Kỹ năng] làm Section (Khuyên dùng)",
                Description = "Ghép Cấp 1 (Chặng) và Cấp 2 (Kỹ năng) thành Tên Section (VD: Chặng 1 - Chữ Hán); Cấp 3 (Chương, Dạng bài) làm Lesson chứa toàn bộ Video & Docs.",
                SectionDepth = 2,
                LessonDepth = 3,
                IncludeLeafFilesAsLessons = true,
                SamplePathPattern = "Chặng 1 / 1. Chữ hán / Chương 1 / Video + Tài liệu"
            },
            new()
            {
                PresetId = "minna-lesson",
                Name = "Mô hình Minna (Bài 1..50)",
                Description = "Thư mục Bài học làm Section, các thư mục con hoặc file media làm Lesson kỹ năng.",
                SectionDepth = 1,
                LessonDepth = 2,
                IncludeLeafFilesAsLessons = true,
                SamplePathPattern = "01. Bài giảng / Bài 26 / 1. Chữ hán, 2. Ngữ pháp, Video lẻ"
            },
            new()
            {
                PresetId = "flat-chapters",
                Name = "Mô hình Chương Đơn (Flat Chapters)",
                Description = "Mỗi thư mục con cấp 1 làm Section, các video/tài liệu bên trong làm Lesson.",
                SectionDepth = 1,
                LessonDepth = 2,
                IncludeLeafFilesAsLessons = true,
                SamplePathPattern = "Chương 1 / Video 1.mp4, Video 2.mp4"
            },
            new()
            {
                PresetId = "custom",
                Name = "Tùy biến Nâng cao (Custom Depth & Rules)",
                Description = "Tự do điều chỉnh độ sâu Section/Lesson, tùy chọn gộp tên cha con và các bộ lọc loại trừ.",
                SectionDepth = suggestedSecDepth,
                LessonDepth = suggestedLesDepth,
                IncludeLeafFilesAsLessons = includeLeaf,
                SamplePathPattern = "Tùy biến theo cấu trúc thực tế của bạn"
            }
        };

        return new AutoDetectFolderResultDto
        {
            RootFolderId = rootNode.Id,
            RootFolderName = rootNode.Name,
            DetectedPreset = detectedPreset,
            Confidence = 0.95,
            Rationale = rationale,
            TotalSubFolders = subFolders.Count,
            TotalFiles = files.Count,
            MaxDepth = maxDepth,
            SuggestedConfig = suggestedConfig,
            FolderTreePreview = treePreview,
            AvailablePresets = availablePresets
        };
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  2. AI PROMPT HELPER: ANALYZE FOLDER TREE WITH GEMINI
    // ═════════════════════════════════════════════════════════════════════════

    public async Task<FolderMappingConfigDto> AnalyzeFolderTreeWithAiAsync(Guid rootFolderId, string? customPrompt = null, CancellationToken ct = default)
    {
        var autoDetect = await DetectFolderStructureAsync(rootFolderId, ct);

        // Serialize compact folder tree preview to JSON for LLM
        var compactTree = autoDetect.FolderTreePreview.Select(SimplifyNodeForLlm).ToList();
        var compactTreeJson = JsonSerializer.Serialize(compactTree, new JsonSerializerOptions { WriteIndented = true });

        // Retrieve AI config dynamically from SystemSettingsService (Database first, then env)
        var (effectiveApiKey, effectiveBaseUrl, effectiveModel) = await _systemSettingsService.GetEffectiveAiConfigAsync(ct);

        var apiKey = !string.IsNullOrWhiteSpace(effectiveApiKey)
            ? effectiveApiKey
            : (_config["Google:ApiKey"] ?? _config["GeminiApiKey"] ?? _config["OpenAI:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY"));

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("[FolderBuilder] Chưa cấu hình AI API Key. Trả về cấu hình Heuristic Auto-Detect.");
            var fallback = autoDetect.SuggestedConfig;
            fallback.AiAnalysisRationale = "Chưa tìm thấy Gemini API Key trong hệ thống. Vui lòng vào Cài đặt Hệ thống để nhập API Key hoặc tiếp tục với cấu hình Tự Động Nhận Diện.";
            return fallback;
        }

        var baseUrl = !string.IsNullOrWhiteSpace(effectiveBaseUrl)
            ? effectiveBaseUrl
            : (_config["OpenAI:BaseUrl"] ?? "https://generativelanguage.googleapis.com/v1beta/openai");
        var model = !string.IsNullOrWhiteSpace(effectiveModel)
            ? effectiveModel
            : (_config["OpenAI:Model"] ?? "gemini-2.5-flash");

        var systemPrompt = """
            You are an expert Educational Curriculum and LMS Architect.
            Analyze the provided Google Drive folder tree JSON and the user's natural language instructions to determine the optimal mapping configuration to convert it into a well-structured course (Sections and Lessons).

            RULES:
            1. For multi-tier structures (e.g. Stage / Chặng -> Skill / Kỹ năng -> Chapter / Chương -> Media files):
               - Set combineParentStages: true
               - Set sectionGroupingMode: "combine-stage-skill"
               - Set sectionFolderDepth: 2 (Skill level)
               - Set lessonFolderDepth: 3 (Chapter / Topic level)
            2. For standard single-tier courses (e.g. Minna: Bài 1..50 -> Skills):
               - Set combineParentStages: false
               - Set sectionGroupingMode: "single-folder"
               - Set sectionFolderDepth: 1
               - Set lessonFolderDepth: 2
            3. Set includeLeafFilesAsLessons: true if media files without subfolders should become individual lessons.
            4. Provide excludeFolderPatterns (e.g., ["*lộ trình*", "*file sách*"]).
            5. Provide aiAnalysisRationale: A concise, polite explanation in Vietnamese explaining how you structured the course according to the user's instructions.
            6. Return ONLY a valid JSON object matching FolderMappingConfigDto with no extra formatting or markdown code blocks.
            """;

        var userContent = $"""
            Folder Tree JSON:
            {compactTreeJson}

            User Instructions:
            {customPrompt ?? "Tự động phân tích và chọn mô hình Section/Lesson chuẩn xác nhất. Ưu tiên gộp [Chặng + Kỹ năng] làm Section nếu có cấu trúc Chặng."}
            """;

        try
        {
            var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromMinutes(2);
            http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

            var requestBody = new
            {
                model = model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userContent }
                },
                temperature = 0.1,
                response_format = new { type = "json_object" }
            };

            var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await http.PostAsync($"{baseUrl.TrimEnd('/')}/chat/completions", jsonContent, ct);

            if (response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(responseBody);
                var content = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

                if (!string.IsNullOrWhiteSpace(content))
                {
                    using var parsedDoc = JsonDocument.Parse(content);
                    var root = parsedDoc.RootElement;

                    bool combineParent = root.TryGetProperty("combineParentStages", out var cps)
                        ? cps.GetBoolean()
                        : (root.TryGetProperty("sectionGroupingMode", out var sgm) && sgm.GetString() == "combine-stage-skill");

                    var config = new FolderMappingConfigDto
                    {
                        RootFolderNodeId = rootFolderId,
                        CourseTitle = autoDetect.RootFolderName,
                        JlptLevel = autoDetect.SuggestedConfig.JlptLevel,
                        PresetName = "custom",
                        SectionGroupingMode = root.TryGetProperty("sectionGroupingMode", out var sgmProp) ? (sgmProp.GetString() ?? "combine-stage-skill") : "combine-stage-skill",
                        CombineParentStages = combineParent,
                        SectionFolderDepth = root.TryGetProperty("sectionFolderDepth", out var sdp) ? sdp.GetInt32() : (combineParent ? 2 : autoDetect.SuggestedConfig.SectionFolderDepth),
                        LessonFolderDepth = root.TryGetProperty("lessonFolderDepth", out var ldp) ? ldp.GetInt32() : (combineParent ? 3 : autoDetect.SuggestedConfig.LessonFolderDepth),
                        IncludeLeafFilesAsLessons = root.TryGetProperty("includeLeafFilesAsLessons", out var ilf) && ilf.GetBoolean(),
                        AiAnalysisRationale = root.TryGetProperty("aiAnalysisRationale", out var air) ? air.GetString() : "AI đã phân tích và thiết lập cấu hình tối ưu theo yêu cầu của bạn.",
                        DefaultLessonDurationMinutes = 45
                    };
                    return config;
                }
            }
            else
            {
                _logger.LogWarning("[FolderBuilder] AI API Error: Status {StatusCode}", response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[FolderBuilder] Lỗi khi gọi AI phân tích cây thư mục: {Message}", ex.Message);
        }

        var res = autoDetect.SuggestedConfig;
        res.AiAnalysisRationale = "Đã áp dụng cấu hình phân tích tự động dựa trên độ sâu cây thư mục.";
        return res;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  3. GENERATE PREVIEW (Compound Section Grouping, RawPath, Natural Sort)
    // ═════════════════════════════════════════════════════════════════════════

    public async Task<AutoBuildScanResultDto> GeneratePreviewAsync(FolderMappingConfigDto config, CancellationToken ct = default)
    {
        var rootNode = await _dbContext.DriveNodes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == config.RootFolderNodeId, ct);

        if (rootNode == null)
            throw new KeyNotFoundException($"Root folder {config.RootFolderNodeId} not found.");

        var courseTitle = !string.IsNullOrWhiteSpace(config.CourseTitle) ? config.CourseTitle : rootNode.Name;
        var rootCleanFullPath = GetEffectiveNodePath(rootNode.RawPath, rootNode.Name);
        var rootSegmentsCount = rootCleanFullPath.Split('/', StringSplitOptions.RemoveEmptyEntries).Length;

        // Fetch all descendants in the subtree
        var allDriveNodes = await _dbContext.DriveNodes
            .AsNoTracking()
            .Where(n => !n.IsDeletedInDrive)
            .Select(n => new SubtreeNodeItem
            {
                Id = n.Id,
                ParentNodeId = n.ParentNodeId,
                Name = n.Name,
                NodeType = n.NodeType,
                RawPath = n.RawPath,
                FileExtension = n.FileExtension,
                MimeType = n.MimeType,
                Size = n.Size,
                WebViewLink = n.WebViewLink
            })
            .ToListAsync(ct);

        var subtreeNodes = allDriveNodes
            .Where(n => IsNodeInSubtree(n.RawPath, n.Name, n.ParentNodeId, n.Id, rootCleanFullPath, config.RootFolderNodeId))
            .ToList();

        // 1. Exclude paths matching ExcludeFolderPatterns & ExcludeFileExtensions
        var excludedPatterns = config.ExcludeFolderPatterns ?? new List<string>();
        var validNodes = subtreeNodes.Where(n =>
        {
            var fullPath = GetEffectiveNodePath(n.RawPath, n.Name);
            foreach (var pattern in excludedPatterns)
            {
                if (IsWildcardMatch(fullPath, pattern)) return false;
            }
            if (n.NodeType == NodeType.File && config.ExcludeFileExtensions != null)
            {
                var ext = (n.FileExtension ?? Path.GetExtension(n.Name) ?? "").ToLowerInvariant();
                if (config.ExcludeFileExtensions.Any(e => string.Equals(e, ext, StringComparison.OrdinalIgnoreCase))) return false;
            }
            return true;
        }).ToList();

        var subFolders = validNodes.Where(n => n.NodeType == NodeType.Folder && n.Id != config.RootFolderNodeId).ToList();
        var files = validNodes.Where(n => n.NodeType == NodeType.File).ToList();

        // Compute relative depth and path for each folder
        var folderMap = new Dictionary<Guid, (SubtreeNodeItem Node, int RelDepth, string RelPath)>();
        foreach (var folder in subFolders)
        {
            var p = GetEffectiveNodePath(folder.RawPath, folder.Name);
            string relPath = "";
            if (p.Length > rootCleanFullPath.Length && p.StartsWith(rootCleanFullPath + "/", StringComparison.OrdinalIgnoreCase))
            {
                relPath = p.Substring(rootCleanFullPath.Length + 1);
            }
            else if (p.Contains("/" + rootCleanFullPath + "/", StringComparison.OrdinalIgnoreCase))
            {
                var idx = p.IndexOf("/" + rootCleanFullPath + "/", StringComparison.OrdinalIgnoreCase);
                relPath = p.Substring(idx + rootCleanFullPath.Length + 2);
            }
            else
            {
                relPath = p;
            }

            var segs = relPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            int depth = segs.Length > 0 ? segs.Length : Math.Max(1, p.Split('/', StringSplitOptions.RemoveEmptyEntries).Length - rootSegmentsCount);
            folderMap[folder.Id] = (folder, depth, relPath);
        }

        var result = new AutoBuildScanResultDto
        {
            CourseTitle = courseTitle,
            JlptLevel = config.JlptLevel,
            Sections = new List<AutoBuildSectionPreviewDto>()
        };

        // Fallback: If no subfolders at all, create 1 section for root
        if (subFolders.Count == 0)
        {
            var defaultSec = new AutoBuildSectionPreviewDto
            {
                Title = courseTitle,
                DisplayOrder = 1,
                LessonNumber = 1,
                Lessons = new List<AutoBuildLessonPreviewDto>()
            };

            var rootFiles = files.OrderBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase)
                                 .Select(f => MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder"))
                                 .ToList();
            if (rootFiles.Count > 0)
            {
                defaultSec.Lessons.Add(new AutoBuildLessonPreviewDto
                {
                    Title = "Bài học tổng hợp",
                    FlowOrder = 1,
                    Skill = "Tổng hợp",
                    EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                    Resources = rootFiles
                });
            }
            result.Sections.Add(defaultSec);
            result.TotalSections = 1;
            result.TotalLessons = defaultSec.Lessons.Count;
            result.TotalFilesMatched = rootFiles.Count;
            return result;
        }

        bool isCompoundMode = config.CombineParentStages
            || string.Equals(config.SectionGroupingMode, "combine-stage-skill", StringComparison.OrdinalIgnoreCase)
            || string.Equals(config.PresetName, "stage-skill-chapter", StringComparison.OrdinalIgnoreCase);

        int secOrder = 0;
        int totalLessonsCount = 0;
        int totalFilesCount = 0;

        // ═════════════════════════════════════════════════════════════════════
        //  MODE A: GỘP [CHẶNG + KỸ NĂNG] LÀM SECTION (Phương án 1 - Chuẩn 4 tầng)
        // ═════════════════════════════════════════════════════════════════════
        if (isCompoundMode)
        {
            var stageFolders = folderMap.Values
                .Where(f => f.RelDepth == 1)
                .OrderBy(f => ExtractNaturalSortKey(f.Node.Name), StringComparer.OrdinalIgnoreCase)
                .ToList();

            foreach (var stageEntry in stageFolders)
            {
                var stageNode = stageEntry.Node;
                var stageRelPath = stageEntry.RelPath;
                var stagePathPrefix = GetEffectiveNodePath(stageNode.RawPath, stageNode.Name);
                int stageNum = ExtractLessonNumber(stageNode.Name, secOrder + 1);

                // Find Level 2 Skill folders directly under this Stage folder
                var skillFolders = folderMap.Values
                    .Where(f => f.RelDepth == 2 && (
                        f.RelPath.StartsWith(stageRelPath + "/", StringComparison.OrdinalIgnoreCase) ||
                        GetEffectiveNodePath(f.Node.RawPath, f.Node.Name).StartsWith(stagePathPrefix + "/", StringComparison.OrdinalIgnoreCase) ||
                        f.Node.ParentNodeId == stageNode.Id
                    ))
                    .OrderBy(f => ExtractNaturalSortKey(f.Node.Name), StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (skillFolders.Count > 0)
                {
                    foreach (var skillEntry in skillFolders)
                    {
                        secOrder++;
                        var skillNode = skillEntry.Node;
                        var skillRelPath = skillEntry.RelPath;
                        var skillPathPrefix = GetEffectiveNodePath(skillNode.RawPath, skillNode.Name);

                        // Format compound section title: "Chặng 1 - Chữ Hán", "Chặng 1 - Ngữ Pháp"
                        var cleanSkillTitle = CleanLeadingOrder(skillNode.Name);
                        var compoundSecTitle = $"{stageNode.Name} - {cleanSkillTitle}";

                        var sectionDto = new AutoBuildSectionPreviewDto
                        {
                            Title = compoundSecTitle,
                            DisplayOrder = secOrder,
                            LessonNumber = stageNum,
                            Lessons = new List<AutoBuildLessonPreviewDto>()
                        };

                        // Separate Level 3 folders into Chapter/Topic folders vs Documentation/Material folders
                        var allLevel3Folders = folderMap.Values
                            .Where(f => f.RelDepth == 3 && (
                                f.RelPath.StartsWith(skillRelPath + "/", StringComparison.OrdinalIgnoreCase) ||
                                GetEffectiveNodePath(f.Node.RawPath, f.Node.Name).StartsWith(skillPathPrefix + "/", StringComparison.OrdinalIgnoreCase) ||
                                f.Node.ParentNodeId == skillNode.Id
                            ))
                            .OrderBy(f => ExtractNaturalSortKey(f.Node.Name), StringComparer.OrdinalIgnoreCase)
                            .ToList();

                        bool IsDocFolder(SubtreeNodeItem n) => Regex.IsMatch(n.Name, @"^(?:0\.\s*)?(?:tài liệu|tai lieu|document|docs|sách|sach|giao trinh|giáo trình)", RegexOptions.IgnoreCase);

                        var docFolders = allLevel3Folders.Where(f => IsDocFolder(f.Node)).ToList();
                        var chapterFolders = allLevel3Folders.Where(f => !IsDocFolder(f.Node)).ToList();

                        // Files inside docFolders (e.g., 0. Tài liệu / Chương 1.pdf ... Chương 8.pdf)
                        var docFiles = files.Where(f =>
                        {
                            var fp = GetEffectiveNodePath(f.RawPath, f.Name);
                            return docFolders.Any(df => f.ParentNodeId == df.Node.Id || fp.StartsWith(GetEffectiveNodePath(df.Node.RawPath, df.Node.Name) + "/", StringComparison.OrdinalIgnoreCase));
                        }).ToList();

                        var handledDocFileIds = new HashSet<Guid>();

                        // Direct files under this Skill folder (not inside any chapter or doc folder)
                        var directSkillFiles = files.Where(f =>
                        {
                            var fp = GetEffectiveNodePath(f.RawPath, f.Name);
                            return (f.ParentNodeId == skillNode.Id || fp.StartsWith(skillPathPrefix + "/", StringComparison.OrdinalIgnoreCase)) &&
                                   !chapterFolders.Any(cf => fp.StartsWith(GetEffectiveNodePath(cf.Node.RawPath, cf.Node.Name) + "/", StringComparison.OrdinalIgnoreCase)) &&
                                   !docFolders.Any(df => fp.StartsWith(GetEffectiveNodePath(df.Node.RawPath, df.Node.Name) + "/", StringComparison.OrdinalIgnoreCase));
                        })
                        .OrderBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase)
                        .ToList();

                        int lesOrder = 0;

                        if (chapterFolders.Count > 0)
                        {
                            foreach (var chEntry in chapterFolders)
                            {
                                lesOrder++;
                                var chNode = chEntry.Node;
                                var chPathPrefix = GetEffectiveNodePath(chNode.RawPath, chNode.Name);

                                // All files under this chapter folder
                                var chFiles = files.Where(f =>
                                {
                                    var fp = GetEffectiveNodePath(f.RawPath, f.Name);
                                    return f.ParentNodeId == chNode.Id ||
                                           fp.StartsWith(chPathPrefix + "/", StringComparison.OrdinalIgnoreCase) ||
                                           fp.Equals(chPathPrefix, StringComparison.OrdinalIgnoreCase);
                                })
                                .OrderBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase)
                                .ToList();

                                // Match corresponding PDF/Docs from 0. Tài liệu folder (e.g., Chương 1.pdf into Lesson Chương 1)
                                int chNum = ExtractLessonNumber(chNode.Name, -1);
                                var matchedDocs = docFiles.Where(df =>
                                {
                                    if (df.Name.Contains(chNode.Name, StringComparison.OrdinalIgnoreCase)) return true;
                                    if (chNum > 0 && Regex.IsMatch(df.Name, $@"(?:chuong|c|chương|bai|b)[\s_\-\.]*0*{chNum}(?!\d)", RegexOptions.IgnoreCase)) return true;
                                    return false;
                                }).ToList();

                                foreach (var mDoc in matchedDocs)
                                {
                                    handledDocFileIds.Add(mDoc.Id);
                                }

                                var combinedFiles = chFiles
                                    .Concat(matchedDocs.Where(d => !chFiles.Any(cf => cf.Id == d.Id)))
                                    .OrderBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase)
                                    .ToList();

                                string skillTag = DetectSkillFromPath(chPathPrefix, config.SkillKeywordRules);
                                if (skillTag == "Tổng hợp") skillTag = DetectSkillFromPath(skillNode.Name, config.SkillKeywordRules);

                                var lessonDto = new AutoBuildLessonPreviewDto
                                {
                                    Title = chNode.Name, // Clean chapter/topic title (Chương 1, Tanbun, Mondai 1...)
                                    FlowOrder = lesOrder,
                                    Skill = skillTag,
                                    EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                                    Resources = combinedFiles.Select(f => MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder")).ToList()
                                };

                                sectionDto.Lessons.Add(lessonDto);
                                totalFilesCount += lessonDto.Resources.Count;
                            }

                            // Leftover unmapped doc files and direct skill files
                            var unmappedDocFiles = docFiles.Where(df => !handledDocFileIds.Contains(df.Id)).ToList();
                            var remainingFiles = directSkillFiles.Concat(unmappedDocFiles).OrderBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase).ToList();

                            if (remainingFiles.Count > 0)
                            {
                                lesOrder++;
                                var looseLesson = new AutoBuildLessonPreviewDto
                                {
                                    Title = "Tài liệu & Video bổ trợ",
                                    FlowOrder = lesOrder,
                                    Skill = DetectSkillFromPath(skillNode.Name, config.SkillKeywordRules),
                                    EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                                    Resources = remainingFiles.Select(f => MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder")).ToList()
                                };
                                sectionDto.Lessons.Add(looseLesson);
                                totalFilesCount += looseLesson.Resources.Count;
                            }
                        }
                        else
                        {
                            // Skill folder has NO chapter subfolders (e.g. only 0. Tài liệu / file1.pdf, file2.pdf and/or loose files)
                            var allAvailableFiles = directSkillFiles.Concat(docFiles).OrderBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase).ToList();

                            if (config.IncludeLeafFilesAsLessons && allAvailableFiles.Count > 1)
                            {
                                foreach (var f in allAvailableFiles)
                                {
                                    lesOrder++;
                                    var lessonDto = new AutoBuildLessonPreviewDto
                                    {
                                        Title = Path.GetFileNameWithoutExtension(f.Name),
                                        FlowOrder = lesOrder,
                                        Skill = DetectSkillFromPath(f.Name, config.SkillKeywordRules),
                                        EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                                        Resources = new List<AutoBuildResourcePreviewDto> { MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder") }
                                    };
                                    sectionDto.Lessons.Add(lessonDto);
                                    totalFilesCount++;
                                }
                            }
                            else if (allAvailableFiles.Count > 0)
                            {
                                lesOrder++;
                                var lessonDto = new AutoBuildLessonPreviewDto
                                {
                                    Title = cleanSkillTitle,
                                    FlowOrder = lesOrder,
                                    Skill = DetectSkillFromPath(skillNode.Name, config.SkillKeywordRules),
                                    EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                                    Resources = allAvailableFiles.Select(f => MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder")).ToList()
                                };
                                sectionDto.Lessons.Add(lessonDto);
                                totalFilesCount += lessonDto.Resources.Count;
                            }
                        }

                        totalLessonsCount += sectionDto.Lessons.Count;
                        result.Sections.Add(sectionDto);
                    }
                }
                else
                {
                    // Stage folder without level 2 subfolders (only direct files or flat)
                    secOrder++;
                    var sectionDto = new AutoBuildSectionPreviewDto
                    {
                        Title = stageNode.Name,
                        DisplayOrder = secOrder,
                        LessonNumber = stageNum,
                        Lessons = new List<AutoBuildLessonPreviewDto>()
                    };

                    var directStageFiles = files.Where(f =>
                    {
                        var fp = GetEffectiveNodePath(f.RawPath, f.Name);
                        return f.ParentNodeId == stageNode.Id || fp.StartsWith(stagePathPrefix + "/", StringComparison.OrdinalIgnoreCase);
                    })
                    .OrderBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase)
                    .ToList();

                    int lesOrder = 0;
                    if (config.IncludeLeafFilesAsLessons && directStageFiles.Count > 1)
                    {
                        foreach (var f in directStageFiles)
                        {
                            lesOrder++;
                            var lessonDto = new AutoBuildLessonPreviewDto
                            {
                                Title = Path.GetFileNameWithoutExtension(f.Name),
                                FlowOrder = lesOrder,
                                Skill = DetectSkillFromPath(f.Name, config.SkillKeywordRules),
                                EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                                Resources = new List<AutoBuildResourcePreviewDto> { MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder") }
                            };
                            sectionDto.Lessons.Add(lessonDto);
                            totalFilesCount++;
                        }
                    }
                    else if (directStageFiles.Count > 0)
                    {
                        lesOrder++;
                        var lessonDto = new AutoBuildLessonPreviewDto
                        {
                            Title = stageNode.Name,
                            FlowOrder = lesOrder,
                            Skill = DetectSkillFromPath(stageNode.Name, config.SkillKeywordRules),
                            EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                            Resources = directStageFiles.Select(f => MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder")).ToList()
                        };
                        sectionDto.Lessons.Add(lessonDto);
                        totalFilesCount += lessonDto.Resources.Count;
                    }

                    totalLessonsCount += sectionDto.Lessons.Count;
                    result.Sections.Add(sectionDto);
                }
            }
        }
        // ═════════════════════════════════════════════════════════════════════
        //  MODE B: SINGLE-DEPTH / CUSTOM MAPPING (Minna, Flat Chapters, Custom)
        // ═════════════════════════════════════════════════════════════════════
        else
        {
            var targetSecDepth = Math.Max(1, config.SectionFolderDepth);
            var targetLesDepth = Math.Max(targetSecDepth + 1, config.LessonFolderDepth);

            var sectionFolderEntries = folderMap.Values
                .Where(f => f.RelDepth == targetSecDepth)
                .OrderBy(f => ExtractNaturalSortKey(f.Node.Name), StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (sectionFolderEntries.Count == 0)
            {
                sectionFolderEntries = folderMap.Values
                    .Where(f => f.RelDepth == 1)
                    .OrderBy(f => ExtractNaturalSortKey(f.Node.Name), StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }

            foreach (var secEntry in sectionFolderEntries)
            {
                secOrder++;
                var secNode = secEntry.Node;
                var secPathPrefix = GetEffectiveNodePath(secNode.RawPath, secNode.Name);
                int lessonNum = ExtractLessonNumber(secNode.Name, secOrder);

                var sectionDto = new AutoBuildSectionPreviewDto
                {
                    Title = secNode.Name,
                    DisplayOrder = secOrder,
                    LessonNumber = lessonNum,
                    Lessons = new List<AutoBuildLessonPreviewDto>()
                };

                // STRICT FILTERING: Only lesson folders at targetLesDepth or immediate children without mixing ancestors
                var lessonFolderCandidates = folderMap.Values
                    .Where(f => f.RelDepth == targetLesDepth && (
                        f.RelPath.StartsWith(secEntry.RelPath + "/", StringComparison.OrdinalIgnoreCase) ||
                        GetEffectiveNodePath(f.Node.RawPath, f.Node.Name).StartsWith(secPathPrefix + "/", StringComparison.OrdinalIgnoreCase) ||
                        f.Node.ParentNodeId == secNode.Id
                    ))
                    .OrderBy(f => ExtractNaturalSortKey(f.Node.Name), StringComparer.OrdinalIgnoreCase)
                    .ToList();

                // If no folders at targetLesDepth, check immediate child folders
                if (lessonFolderCandidates.Count == 0)
                {
                    lessonFolderCandidates = folderMap.Values
                        .Where(f => f.RelDepth == secEntry.RelDepth + 1 && (
                            f.RelPath.StartsWith(secEntry.RelPath + "/", StringComparison.OrdinalIgnoreCase) ||
                            GetEffectiveNodePath(f.Node.RawPath, f.Node.Name).StartsWith(secPathPrefix + "/", StringComparison.OrdinalIgnoreCase) ||
                            f.Node.ParentNodeId == secNode.Id
                        ))
                        .OrderBy(f => ExtractNaturalSortKey(f.Node.Name), StringComparer.OrdinalIgnoreCase)
                        .ToList();
                }

                // Direct files under this section
                var directSecFiles = files.Where(f =>
                {
                    var fp = GetEffectiveNodePath(f.RawPath, f.Name);
                    return (f.ParentNodeId == secNode.Id || fp.StartsWith(secPathPrefix + "/", StringComparison.OrdinalIgnoreCase)) &&
                           !lessonFolderCandidates.Any(lf => fp.StartsWith(GetEffectiveNodePath(lf.Node.RawPath, lf.Node.Name) + "/", StringComparison.OrdinalIgnoreCase));
                })
                .OrderBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase)
                .ToList();

                int lesOrder = 0;

                if (lessonFolderCandidates.Count > 0)
                {
                    foreach (var lesEntry in lessonFolderCandidates)
                    {
                        lesOrder++;
                        var lesNode = lesEntry.Node;
                        var lesPathPrefix = GetEffectiveNodePath(lesNode.RawPath, lesNode.Name);

                        var lesFiles = files.Where(f =>
                        {
                            var fp = GetEffectiveNodePath(f.RawPath, f.Name);
                            return f.ParentNodeId == lesNode.Id ||
                                   fp.StartsWith(lesPathPrefix + "/", StringComparison.OrdinalIgnoreCase) ||
                                   fp.Equals(lesPathPrefix, StringComparison.OrdinalIgnoreCase);
                        })
                        .OrderBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase)
                        .ToList();

                        string skillTag = DetectSkillFromPath(lesPathPrefix, config.SkillKeywordRules);

                        var lessonDto = new AutoBuildLessonPreviewDto
                        {
                            Title = lesNode.Name,
                            FlowOrder = lesOrder,
                            Skill = skillTag,
                            EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                            Resources = lesFiles.Select(f => MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder")).ToList()
                        };

                        sectionDto.Lessons.Add(lessonDto);
                        totalFilesCount += lessonDto.Resources.Count;
                    }

                    if (directSecFiles.Count > 0)
                    {
                        lesOrder++;
                        var looseLesson = new AutoBuildLessonPreviewDto
                        {
                            Title = "Tài liệu & Video bổ trợ",
                            FlowOrder = lesOrder,
                            Skill = DetectSkillFromPath(directSecFiles[0].Name, config.SkillKeywordRules),
                            EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                            Resources = directSecFiles.Select(f => MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder")).ToList()
                        };
                        sectionDto.Lessons.Add(looseLesson);
                        totalFilesCount += looseLesson.Resources.Count;
                    }
                }
                else
                {
                    if (config.IncludeLeafFilesAsLessons && directSecFiles.Count > 1)
                    {
                        foreach (var f in directSecFiles)
                        {
                            lesOrder++;
                            string skill = DetectSkillFromPath($"{secPathPrefix}/{f.Name}", config.SkillKeywordRules);
                            var lessonDto = new AutoBuildLessonPreviewDto
                            {
                                Title = Path.GetFileNameWithoutExtension(f.Name),
                                FlowOrder = lesOrder,
                                Skill = skill,
                                EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                                Resources = new List<AutoBuildResourcePreviewDto> { MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder") }
                            };
                            sectionDto.Lessons.Add(lessonDto);
                            totalFilesCount++;
                        }
                    }
                    else if (directSecFiles.Count > 0)
                    {
                        lesOrder++;
                        string skill = DetectSkillFromPath(secPathPrefix, config.SkillKeywordRules);
                        var lessonDto = new AutoBuildLessonPreviewDto
                        {
                            Title = secNode.Name,
                            FlowOrder = lesOrder,
                            Skill = skill,
                            EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                            Resources = directSecFiles.Select(f => MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder")).ToList()
                        };
                        sectionDto.Lessons.Add(lessonDto);
                        totalFilesCount += lessonDto.Resources.Count;
                    }
                }

                // Cross-folder matching for standard Minna sections
                bool isMatchableSection = Regex.IsMatch(secNode.Name, @"(?:bai|b|lesson|chuong|chương)[\s_-]*\d+", RegexOptions.IgnoreCase);
                if (config.EnableCrossFolderMatching && isMatchableSection && lessonNum > 0)
                {
                    var crossFiles = subtreeNodes
                        .Where(n => n.NodeType == NodeType.File)
                        .Where(n =>
                        {
                            var ext = (n.FileExtension ?? Path.GetExtension(n.Name) ?? "").ToLowerInvariant();
                            if (ext != ".pdf" && ext != ".docx" && ext != ".doc" && ext != ".xlsx") return false;

                            var fp = GetEffectiveNodePath(n.RawPath, n.Name);
                            if (fp.StartsWith(secPathPrefix + "/", StringComparison.OrdinalIgnoreCase) || fp.Equals(secPathPrefix, StringComparison.OrdinalIgnoreCase)) return false;

                            var numStr = lessonNum.ToString();
                            return Regex.IsMatch(fp, $@"(?:bai|b|lesson|chuong)[\s_-]*0*{numStr}(?!\d)", RegexOptions.IgnoreCase);
                        })
                        .ToList();

                    if (crossFiles.Count > 0)
                    {
                        var targetLesson = sectionDto.Lessons.FirstOrDefault(l => l.Skill.Contains("Grammar") || l.Skill.Contains("Vocabulary"))
                                        ?? sectionDto.Lessons.FirstOrDefault();

                        if (targetLesson != null)
                        {
                            foreach (var cf in crossFiles)
                            {
                                if (!targetLesson.Resources.Any(r => r.DriveNodeId == cf.Id))
                                {
                                    var resPreview = MapNodeToResourcePreview(cf, config.SkillKeywordRules, "CrossFolder");
                                    targetLesson.Resources.Add(resPreview);
                                    totalFilesCount++;
                                }
                            }
                        }
                    }
                }

                totalLessonsCount += sectionDto.Lessons.Count;
                result.Sections.Add(sectionDto);
            }
        }

        result.TotalSections = result.Sections.Count;
        result.TotalLessons = totalLessonsCount;
        result.TotalFilesMatched = totalFilesCount;

        return result;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  4. MATERIALIZE COURSE (Save Course, Sections, Lessons, Resources)
    // ═════════════════════════════════════════════════════════════════════════

    public async Task<CourseDto> MaterializeCourseAsync(AutoBuildApplyRequestDto request, CancellationToken ct = default)
    {
        var slug = Regex.Replace(request.CourseTitle.ToLowerInvariant(), @"[^a-z0-9\s-]", "").Replace(" ", "-");
        if (string.IsNullOrWhiteSpace(slug)) slug = "course-" + Guid.NewGuid().ToString()[..8];

        var course = new Course
        {
            Title = request.CourseTitle,
            Slug = slug,
            Description = request.Description ?? $"Khóa học {request.JlptLevel} tạo tự động từ Google Drive",
            JlptLevel = request.JlptLevel,
            DisplayOrder = 0,
            IsPublished = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Courses.Add(course);

        int sOrder = 0;
        foreach (var secDto in request.Sections.OrderBy(s => s.DisplayOrder))
        {
            sOrder++;
            var section = new Section
            {
                CourseId = course.Id,
                Title = secDto.Title,
                DisplayOrder = sOrder,
                CreatedAtUtc = DateTime.UtcNow
            };
            _dbContext.Sections.Add(section);

            int lOrder = 0;
            foreach (var lesDto in secDto.Lessons.OrderBy(l => l.FlowOrder))
            {
                lOrder++;
                var lesson = new Lesson
                {
                    SectionId = section.Id,
                    Title = lesDto.Title,
                    DisplayOrder = lOrder,
                    EstimatedDurationMinutes = lesDto.EstimatedDurationMinutes > 0 ? lesDto.EstimatedDurationMinutes : 45,
                    IsPublished = true,
                    CreatedAtUtc = DateTime.UtcNow
                };
                _dbContext.Lessons.Add(lesson);

                int rOrder = 0;
                foreach (var resDto in lesDto.Resources)
                {
                    rOrder++;
                    var resource = new Resource
                    {
                        LessonId = lesson.Id,
                        Title = resDto.Title,
                        ResourceType = resDto.ResourceType,
                        DriveNodeId = resDto.DriveNodeId,
                        DisplayOrder = rOrder,
                        CreatedAtUtc = DateTime.UtcNow
                    };
                    _dbContext.Resources.Add(resource);
                }
            }
        }

        await _dbContext.SaveChangesAsync(ct);

        return new CourseDto
        {
            Id = course.Id,
            Title = course.Title,
            Slug = course.Slug,
            Description = course.Description,
            JlptLevel = course.JlptLevel,
            DisplayOrder = course.DisplayOrder,
            IsPublished = course.IsPublished,
            Sections = new List<SectionDto>()
        };
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  HELPER METHODS
    // ═════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Cắt bỏ số thứ tự thừa ở đầu tên folder con khi nối chuỗi (VD: "1. Chữ hán" -> "Chữ Hán", "02_Ngữ pháp" -> "Ngữ Pháp")
    /// </summary>
    private static string CleanLeadingOrder(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return string.Empty;
        var trimmed = name.Trim();
        // Regex strips "1. ", "01. ", "1 - ", "01_ ", "1) ", "1.Chữ Hán"
        var cleaned = Regex.Replace(trimmed, @"^\s*(?:\d+[\s\.\-_:\)]+|\d+\s+)", "").Trim();
        if (string.IsNullOrWhiteSpace(cleaned)) return trimmed;

        try
        {
            return CultureInfo.CurrentCulture.TextInfo.ToTitleCase(cleaned);
        }
        catch
        {
            return char.ToUpper(cleaned[0]) + cleaned.Substring(1);
        }
    }

    private static string CleanPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return string.Empty;
        var p = RemoveDiacritics(path.Replace('\\', '/')).Trim('/');
        return p;
    }

    private static string GetEffectiveNodePath(string? rawPath, string name)
    {
        var cleanRaw = CleanPath(rawPath);
        var cleanName = CleanPath(name);
        if (string.IsNullOrEmpty(cleanRaw)) return cleanName;
        if (cleanRaw.EndsWith("/" + cleanName, StringComparison.OrdinalIgnoreCase) || cleanRaw.Equals(cleanName, StringComparison.OrdinalIgnoreCase))
        {
            return cleanRaw;
        }
        return $"{cleanRaw}/{cleanName}";
    }

    private static bool IsNodeInSubtree(string? rawPath, string name, Guid? parentId, Guid id, string rootCleanFullPath, Guid rootId)
    {
        if (id == rootId) return true;
        if (parentId == rootId) return true;

        var nodePath = GetEffectiveNodePath(rawPath, name);

        if (nodePath == rootCleanFullPath || nodePath.StartsWith(rootCleanFullPath + "/", StringComparison.OrdinalIgnoreCase))
            return true;

        if (nodePath.Contains("/" + rootCleanFullPath + "/", StringComparison.OrdinalIgnoreCase) || 
            nodePath.EndsWith("/" + rootCleanFullPath, StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }

    private static string RemoveDiacritics(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var normalizedString = text.Normalize(NormalizationForm.FormD);
        var stringBuilder = new StringBuilder();

        foreach (var c in normalizedString)
        {
            var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
            if (unicodeCategory != UnicodeCategory.NonSpacingMark)
            {
                stringBuilder.Append(c);
            }
        }

        return stringBuilder.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }

    private static string InferJlptLevelFromPath(string path)
    {
        var norm = path.ToLowerInvariant();
        if (norm.Contains("n1")) return "N1";
        if (norm.Contains("n2")) return "N2";
        if (norm.Contains("n3")) return "N3";
        if (norm.Contains("n4")) return "N4";
        if (norm.Contains("n5")) return "N5";
        return "N4";
    }

    private static bool IsWildcardMatch(string text, string pattern)
    {
        var p = RemoveDiacritics(pattern).Trim();
        var regex = "^" + Regex.Escape(p).Replace("\\*", ".*").Replace("\\?", ".") + "$";
        return Regex.IsMatch(text, regex, RegexOptions.IgnoreCase);
    }

    private static string DetectSkillFromPath(string fullPath, Dictionary<string, string>? rules)
    {
        var norm = RemoveDiacritics(fullPath);
        if (rules != null)
        {
            foreach (var kvp in rules)
            {
                var kw = RemoveDiacritics(kvp.Key);
                if (norm.Contains(kw))
                {
                    return kvp.Value;
                }
            }
        }

        if (norm.Contains("chu han") || norm.Contains("kanji")) return "Kanji";
        if (norm.Contains("tu vung") || norm.Contains("kotoba")) return "Vocabulary";
        if (norm.Contains("ngu phap") || norm.Contains("bunpou")) return "Grammar";
        if (norm.Contains("nghe") || norm.Contains("choukai") || norm.Contains("mondai")) return "Choukai";
        if (norm.Contains("doc") || norm.Contains("dokkai") || norm.Contains("tanbun") || norm.Contains("chuubun") || norm.Contains("choubun")) return "Dokkai";
        if (norm.Contains("hoi thoai") || norm.Contains("kaiwa")) return "Kaiwa";
        if (norm.Contains("de thi") || norm.Contains("thi thu") || norm.Contains("test")) return "Quiz";

        return "Tổng hợp";
    }

    private static AutoBuildResourcePreviewDto MapNodeToResourcePreview(dynamic node, Dictionary<string, string>? rules, string sourceTier)
    {
        var ext = (string?)(node.FileExtension ?? Path.GetExtension((string)node.Name) ?? "");
        var resType = DetermineResourceType(ext, (string)node.Name, (string?)node.RawPath);

        return new AutoBuildResourcePreviewDto
        {
            DriveNodeId = node.Id,
            Title = node.Name,
            RawPath = node.RawPath,
            WebViewLink = node.WebViewLink,
            ResourceType = resType,
            MatchScore = 100,
            SourceTier = sourceTier
        };
    }

    private static ResourceType DetermineResourceType(string? ext, string name, string? rawPath)
    {
        var e = (ext ?? "").ToLowerInvariant();
        var full = $"{rawPath ?? ""}/{name}".ToLowerInvariant();

        if (e == ".mp4" || e == ".mkv" || e == ".avi" || e == ".webm")
        {
            return ResourceType.PrimaryVideo;
        }
        if (e == ".mp3" || e == ".m4a" || e == ".wav" || e == ".aac")
        {
            return ResourceType.Audio;
        }
        if (e == ".pdf")
        {
            if (full.Contains("de thi") || full.Contains("test") || full.Contains("bai tap"))
                return ResourceType.ExercisePdf;
            return ResourceType.Document;
        }
        if (e == ".docx" || e == ".doc")
        {
            if (full.Contains("test") || full.Contains("bai tap") || full.Contains("kiem tra"))
                return ResourceType.ExercisePdf;
            return ResourceType.Document;
        }
        if (e == ".png" || e == ".jpg" || e == ".jpeg") return ResourceType.Image;
        return ResourceType.Document;
    }

    private static int ExtractLessonNumber(string folderName, int fallback)
    {
        var match = Regex.Match(folderName, @"\b(\d+)\b");
        if (match.Success && int.TryParse(match.Groups[1].Value, out int num))
        {
            return num;
        }
        return fallback;
    }

    private static string ExtractNaturalSortKey(string input)
    {
        // Pads numbers with leading zeros for natural string sorting (e.g. "Chương 2" -> "Chương 0000000002")
        return Regex.Replace(input, @"\d+", m => m.Value.PadLeft(10, '0'));
    }

    private static List<FolderTreeNodeDto> BuildFolderTreePreview(Guid rootId, List<FolderItem> folders, List<FileItem> files, int maxPreviewDepth)
    {
        var rootFolders = folders.Where(f => f.RelativeDepth == 1).ToList();
        var result = new List<FolderTreeNodeDto>();

        foreach (var rf in rootFolders)
        {
            var node = CreateTreeNodeRecursive(rf, folders, files, currentDepth: 1, maxPreviewDepth);
            result.Add(node);
        }

        return result;
    }

    private static FolderTreeNodeDto CreateTreeNodeRecursive(FolderItem current, List<FolderItem> allFolders, List<FileItem> allFiles, int currentDepth, int maxDepth)
    {
        var currentPath = GetEffectiveNodePath(current.RawPath, current.Name);

        var childFolders = allFolders.Where(f => 
            f.ParentNodeId == current.Id || 
            GetEffectiveNodePath(f.RawPath, f.Name) == $"{currentPath}/{CleanPath(f.Name)}" ||
            (f.RelativeDepth == currentDepth + 1 && GetEffectiveNodePath(f.RawPath, f.Name).StartsWith(currentPath + "/", StringComparison.OrdinalIgnoreCase))
        ).ToList();

        var directFiles = allFiles.Where(f => 
            f.ParentNodeId == current.Id || 
            GetEffectiveNodePath(f.RawPath, f.Name) == $"{currentPath}/{CleanPath(f.Name)}" ||
            CleanPath(f.RawPath) == currentPath
        ).ToList();

        var treeNode = new FolderTreeNodeDto
        {
            Id = current.Id,
            Name = current.Name,
            NodeType = 0,
            RawPath = current.RawPath,
            RelativeDepth = currentDepth,
            SubFolderCount = childFolders.Count,
            FileCount = directFiles.Count,
            Children = new List<FolderTreeNodeDto>()
        };

        if (currentDepth < maxDepth)
        {
            foreach (var cf in childFolders)
            {
                treeNode.Children.Add(CreateTreeNodeRecursive(cf, allFolders, allFiles, currentDepth + 1, maxDepth));
            }
        }

        return treeNode;
    }

    private static object SimplifyNodeForLlm(FolderTreeNodeDto node)
    {
        return new
        {
            name = node.Name,
            depth = node.RelativeDepth,
            subFolders = node.SubFolderCount,
            files = node.FileCount,
            children = node.Children?.Select(SimplifyNodeForLlm).ToList()
        };
    }

    private class FolderItem
    {
        public Guid Id { get; set; }
        public Guid? ParentNodeId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int NodeType { get; set; }
        public string RawPath { get; set; } = string.Empty;
        public int RelativeDepth { get; set; }
    }

    private class FileItem
    {
        public Guid Id { get; set; }
        public Guid? ParentNodeId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string RawPath { get; set; } = string.Empty;
    }

    private class SubtreeNodeItem
    {
        public Guid Id { get; set; }
        public Guid? ParentNodeId { get; set; }
        public string Name { get; set; } = string.Empty;
        public NodeType NodeType { get; set; }
        public string RawPath { get; set; } = string.Empty;
        public string? FileExtension { get; set; }
        public string MimeType { get; set; } = string.Empty;
        public long? Size { get; set; }
        public string? WebViewLink { get; set; }
    }
}
