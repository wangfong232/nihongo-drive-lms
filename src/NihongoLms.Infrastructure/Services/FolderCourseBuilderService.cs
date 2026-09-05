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
    private readonly ILogger<FolderCourseBuilderService> _logger;

    public FolderCourseBuilderService(
        LmsDbContext dbContext,
        IHttpClientFactory httpFactory,
        IConfiguration config,
        ILogger<FolderCourseBuilderService> logger)
    {
        _dbContext = dbContext;
        _httpFactory = httpFactory;
        _config = config;
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
        bool hasMondaiPattern = subFolders.Any(f => Regex.IsMatch(f.Name, @"(?:mondai|đề|de thi)[\s_-]*\d+", RegexOptions.IgnoreCase));

        string detectedPreset = "minna-lesson";
        string rationale;
        int suggestedSecDepth = 1;
        int suggestedLesDepth = 2;
        bool includeLeaf = true;

        if (hasChangPattern)
        {
            detectedPreset = "stage-skill-chapter";
            suggestedSecDepth = 1; // Chặng 1, Chặng 2 làm Section
            suggestedLesDepth = Math.Min(3, maxDepth); // Kỹ năng hoặc Chương làm Lesson
            includeLeaf = true;
            rationale = "Phát hiện cấu trúc Chặng (Chặng 1, Chặng 2) kết hợp Kỹ năng & Chương học.";
        }
        else if (hasBaiPattern)
        {
            detectedPreset = "minna-lesson";
            // Check if Bài folders are at depth 1 or depth 2 (e.g. 01. Bài giảng / Bài 26)
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
            includeLeaf = true;
            rationale = "Phát hiện cấu trúc theo Bài học Minna (Bài 1..50) và các thư mục kỹ năng con.";
        }
        else if (hasChuongPattern)
        {
            detectedPreset = "flat-chapters";
            suggestedSecDepth = 1;
            suggestedLesDepth = 2;
            includeLeaf = true;
            rationale = "Phát hiện cấu trúc phân chia theo Chương hoặc Chuyên đề.";
        }
        else
        {
            detectedPreset = "minna-lesson";
            suggestedSecDepth = 1;
            suggestedLesDepth = Math.Min(2, maxDepth);
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
            SectionFolderDepth = suggestedSecDepth,
            LessonFolderDepth = suggestedLesDepth,
            IncludeLeafFilesAsLessons = includeLeaf,
            ExcludeFolderPatterns = new List<string> { "*lộ trình*", "*lo trinh*", "*file sách*", "*file sach*", "*hướng dẫn*" }
        };

        var availablePresets = new List<FolderPresetInfoDto>
        {
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
                PresetId = "stage-skill-chapter",
                Name = "Mô hình Chặng - Kỹ năng - Chương (N3/N2)",
                Description = "Chặng 1, Chặng 2 làm Section; Kỹ năng hoặc Chương con làm Lesson.",
                SectionDepth = 1,
                LessonDepth = 3,
                IncludeLeafFilesAsLessons = true,
                SamplePathPattern = "Chặng 1 / 1. Chữ hán / Chương 1 / Video bài giảng"
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
                Description = "Tự do điều chỉnh độ sâu Section/Lesson và các bộ lọc loại trừ.",
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

        var apiKey = _config["Google:ApiKey"]
                  ?? _config["GeminiApiKey"]
                  ?? _config["OpenAI:ApiKey"]
                  ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("[FolderBuilder] Chưa cấu hình Gemini API Key. Trả về cấu hình Heuristic Auto-Detect.");
            return autoDetect.SuggestedConfig;
        }

        var baseUrl = _config["OpenAI:BaseUrl"] ?? "https://generativelanguage.googleapis.com/v1beta/openai";
        var model = _config["OpenAI:Model"] ?? "gemini-2.5-flash";

        var systemPrompt = """
            You are an expert Educational Curriculum and LMS Architect.
            Analyze the following Google Drive folder tree JSON and determine the optimal mapping configuration to convert it into a well-structured course (Sections and Lessons).

            RULES:
            1. Determine sectionFolderDepth (1, 2, or 3): Which folder level represents major units/chapters/stages (e.g. "Chặng 1", "Bài 26", "Chương 1").
            2. Determine lessonFolderDepth: Which folder level represents individual lessons/skills/topics.
            3. Set includeLeafFilesAsLessons: true if files should each be a lesson or grouped if inside a skill folder.
            4. Provide excludeFolderPatterns (e.g., ["*lộ trình*", "*file sách*"]).
            5. Return ONLY a valid JSON object matching FolderMappingConfigDto with no markdown or explanations.
            """;

        var userContent = $"""
            Folder Tree JSON:
            {compactTreeJson}

            User Note / Instructions:
            {customPrompt ?? "Tự động phân tích và chọn độ sâu Section/Lesson chuẩn xác nhất."}
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

                    var config = new FolderMappingConfigDto
                    {
                        RootFolderNodeId = rootFolderId,
                        CourseTitle = autoDetect.RootFolderName,
                        JlptLevel = autoDetect.SuggestedConfig.JlptLevel,
                        PresetName = "custom",
                        SectionFolderDepth = root.TryGetProperty("sectionFolderDepth", out var sdp) ? sdp.GetInt32() : autoDetect.SuggestedConfig.SectionFolderDepth,
                        LessonFolderDepth = root.TryGetProperty("lessonFolderDepth", out var ldp) ? ldp.GetInt32() : autoDetect.SuggestedConfig.LessonFolderDepth,
                        IncludeLeafFilesAsLessons = root.TryGetProperty("includeLeafFilesAsLessons", out var ilf) && ilf.GetBoolean(),
                        DefaultLessonDurationMinutes = 45
                    };
                    return config;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[FolderBuilder] Lỗi khi gọi AI phân tích cây thư mục: {Message}", ex.Message);
        }

        return autoDetect.SuggestedConfig;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  3. GENERATE PREVIEW (RawPath Skills, Cross-Folder Docs, Natural Sort)
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

        // 1. Exclude paths matching ExcludeFolderPatterns
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

        // Compute relative depth for each folder
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
            var segs = relPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            int depth = segs.Length > 0 ? segs.Length : Math.Max(1, p.Split('/', StringSplitOptions.RemoveEmptyEntries).Length - rootSegmentsCount);
            folderMap[folder.Id] = (folder, depth, relPath);
        }

        // 2. Identify Section Folders based on SectionFolderDepth
        var targetSecDepth = Math.Max(1, config.SectionFolderDepth);
        var targetLesDepth = Math.Max(targetSecDepth + 1, config.LessonFolderDepth);

        var sectionFolderEntries = folderMap.Values
            .Where(f => f.RelDepth == targetSecDepth)
            .OrderBy(f => ExtractNaturalSortKey(f.Node.Name), StringComparer.OrdinalIgnoreCase)
            .ToList();

        var result = new AutoBuildScanResultDto
        {
            CourseTitle = courseTitle,
            JlptLevel = config.JlptLevel,
            Sections = new List<AutoBuildSectionPreviewDto>()
        };

        // Fallback: If no folders at target depth, create 1 section for root
        if (sectionFolderEntries.Count == 0)
        {
            var defaultSec = new AutoBuildSectionPreviewDto
            {
                Title = courseTitle,
                DisplayOrder = 1,
                LessonNumber = 1,
                Lessons = new List<AutoBuildLessonPreviewDto>()
            };

            // Group files in root
            var rootFiles = files.Select(f => MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder")).ToList();
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

        int secOrder = 0;
        int totalLessonsCount = 0;
        int totalFilesCount = 0;

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

            // Subfolders belonging to this Section
            var secSubFolders = folderMap.Values
                .Where(f => f.RelDepth > targetSecDepth && (
                    f.RelPath.StartsWith(secEntry.RelPath + "/", StringComparison.OrdinalIgnoreCase) ||
                    GetEffectiveNodePath(f.Node.RawPath, f.Node.Name).StartsWith(secPathPrefix + "/", StringComparison.OrdinalIgnoreCase)
                ))
                .ToList();

            // Direct lesson folders (at targetLesDepth or immediate children)
            var lessonFolderCandidates = secSubFolders
                .Where(f => f.RelDepth == targetLesDepth || (f.RelDepth > targetSecDepth && f.RelDepth < targetLesDepth))
                .OrderBy(f => ExtractNaturalSortKey(f.Node.Name), StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Direct files under this Section folder
            var directSecFiles = files.Where(f =>
            {
                var fp = GetEffectiveNodePath(f.RawPath, f.Name);
                return fp.Equals(secPathPrefix, StringComparison.OrdinalIgnoreCase) || 
                       fp.Equals($"{secPathPrefix}/{CleanPath(f.Name)}", StringComparison.OrdinalIgnoreCase) ||
                       f.ParentNodeId == secNode.Id;
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

                    // Files under this lesson folder sorted naturally by full path and file name
                    var lesFiles = files.Where(f =>
                    {
                        var fp = GetEffectiveNodePath(f.RawPath, f.Name);
                        return fp.StartsWith(lesPathPrefix + "/", StringComparison.OrdinalIgnoreCase) ||
                               fp.Equals(lesPathPrefix, StringComparison.OrdinalIgnoreCase) ||
                               f.ParentNodeId == lesNode.Id;
                    })
                    .OrderBy(f => ExtractNaturalSortKey(GetEffectiveNodePath(f.RawPath, f.Name)), StringComparer.OrdinalIgnoreCase)
                    .ThenBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase)
                    .ToList();

                    // Detect skill from folder name + full rawpath
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

                // If there are also loose leaf files directly under the Section folder
                if (directSecFiles.Count > 0)
                {
                    lesOrder++;
                    var looseSkill = DetectSkillFromPath(directSecFiles[0].Name, config.SkillKeywordRules);
                    var looseLesson = new AutoBuildLessonPreviewDto
                    {
                        Title = "Tài liệu & Video bổ trợ",
                        FlowOrder = lesOrder,
                        Skill = looseSkill,
                        EstimatedDurationMinutes = config.DefaultLessonDurationMinutes,
                        Resources = directSecFiles.Select(f => MapNodeToResourcePreview(f, config.SkillKeywordRules, "LessonFolder")).ToList()
                    };
                    sectionDto.Lessons.Add(looseLesson);
                    totalFilesCount += looseLesson.Resources.Count;
                }
            }
            else
            {
                // No subfolders: Each file becomes a lesson OR all files grouped into 1-2 lessons
                if (config.IncludeLeafFilesAsLessons && directSecFiles.Count > 1)
                {
                    // Natural sort the files
                    var sortedFiles = directSecFiles.OrderBy(f => ExtractNaturalSortKey(f.Name), StringComparer.OrdinalIgnoreCase).ToList();
                    foreach (var f in sortedFiles)
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

            // ═════════════════════════════════════════════════════════════════
            //  CROSS-FOLDER MATCHING (e.g. Tổng hợp ngữ pháp bài 25-50 minna, tài liệu chương 1)
            // ═════════════════════════════════════════════════════════════════
            bool isMatchableSection = Regex.IsMatch(secNode.Name, @"(?:bai|b|lesson|chuong|chương)[\s_-]*\d+", RegexOptions.IgnoreCase);
            if (config.EnableCrossFolderMatching && isMatchableSection && lessonNum > 0)
            {
                var crossFiles = subtreeNodes
                    .Where(n => n.NodeType == NodeType.File)
                    .Where(n =>
                    {
                        var ext = (n.FileExtension ?? Path.GetExtension(n.Name) ?? "").ToLowerInvariant();
                        // Only documents/exercise files are eligible for cross-folder matching, NOT videos
                        if (ext != ".pdf" && ext != ".docx" && ext != ".doc" && ext != ".xlsx") return false;

                        var fp = GetEffectiveNodePath(n.RawPath, n.Name);
                        // Must not be already inside this section's path
                        if (fp.StartsWith(secPathPrefix + "/", StringComparison.OrdinalIgnoreCase) || fp.Equals(secPathPrefix, StringComparison.OrdinalIgnoreCase)) return false;

                        // Must match the lesson number strictly e.g. "bai 26", "b26", "chuong 1"
                        var numStr = lessonNum.ToString();
                        return Regex.IsMatch(fp, $@"(?:bai|b|lesson|chuong)[\s_-]*0*{numStr}(?!\d)", RegexOptions.IgnoreCase);
                    })
                    .ToList();

                if (crossFiles.Count > 0)
                {
                    // Append these resources to the first grammar/vocabulary lesson or create a dedicated resource entry
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

    private static string NormalizePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return string.Empty;
        var p = path.Replace('\\', '/').Trim();
        return RemoveDiacritics(p);
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
        if (norm.Contains("doc") || norm.Contains("dokkai") || norm.Contains("tanbun") || norm.Contains("choubun")) return "Dokkai";
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
        // Padds numbers with leading zeros for natural string sorting (e.g. "Chương 2" -> "Chương 0000000002")
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

    private class NaturalStringComparer : IComparer<string>
    {
        public int Compare(string? x, string? y)
        {
            return string.Compare(x, y, StringComparison.OrdinalIgnoreCase);
        }
    }
}
