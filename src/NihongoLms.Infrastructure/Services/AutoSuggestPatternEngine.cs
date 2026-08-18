using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class AutoSuggestPatternEngine : IAutoSuggestPatternEngine
{
    private readonly LmsDbContext _dbContext;

    public AutoSuggestPatternEngine(LmsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<AutoSuggestResultDto> AnalyzeFolderPatternAsync(AutoSuggestRequestDto request, CancellationToken cancellationToken = default)
    {
        var parentNode = await _dbContext.DriveNodes
            .FirstOrDefaultAsync(n => n.Id == request.ParentFolderDriveNodeId, cancellationToken);

        if (parentNode == null)
        {
            throw new ArgumentException("Specified Parent Folder DriveNode was not found.", nameof(request.ParentFolderDriveNodeId));
        }

        // Clean redundant (?i) prefix from user pattern if present
        string cleanPattern = Regex.Replace(request.PatternRegex?.Trim() ?? "", @"^\(\?i\)", "", RegexOptions.IgnoreCase);
        if (string.IsNullOrWhiteSpace(cleanPattern))
        {
            cleanPattern = @"Bài\s*(\d+)";
        }

        Regex regex;
        try
        {
            regex = new Regex(cleanPattern, RegexOptions.IgnoreCase | RegexOptions.Compiled);
        }
        catch
        {
            regex = new Regex(@".*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        }

        // 1. Fetch all direct child nodes of parent folder (both ParentNodeId Guid and ParentDriveFileId string)
        var allDirectChildren = await _dbContext.DriveNodes
            .Where(n => (n.ParentNodeId == parentNode.Id || (parentNode.DriveFileId != null && n.ParentDriveFileId == parentNode.DriveFileId)) && !n.IsDeletedInDrive)
            .OrderBy(n => n.Name)
            .ToListAsync(cancellationToken);

        var candidateFolders = allDirectChildren.Where(c => c.NodeType == NodeType.Folder).ToList();
        var candidateFiles = allDirectChildren.Where(c => c.NodeType == NodeType.File).ToList();

        var suggestedLessons = new List<SuggestedLessonDto>();

        // ─── Case A: Folder contains sub-folders ─────────────────────────────────
        if (candidateFolders.Count > 0)
        {
            foreach (var folder in candidateFolders)
            {
                var match = regex.Match(folder.Name);
                if (match.Success || cleanPattern == ".*")
                {
                    int lessonNumber = 0;
                    if (match.Success && match.Groups.Count > 1 && int.TryParse(match.Groups[1].Value, out int parsedNum))
                    {
                        lessonNumber = parsedNum;
                    }
                    else
                    {
                        // Try fallback extraction of any digits in folder name
                        var numMatch = Regex.Match(folder.Name, @"\d+");
                        if (numMatch.Success && int.TryParse(numMatch.Value, out int fallbackNum))
                        {
                            lessonNumber = fallbackNum;
                        }
                    }

                    // Fetch child files inside this lesson folder
                    var files = await _dbContext.DriveNodes
                        .Where(n => (n.ParentNodeId == folder.Id || (folder.DriveFileId != null && n.ParentDriveFileId == folder.DriveFileId)) && n.NodeType == NodeType.File && !n.IsDeletedInDrive)
                        .OrderBy(n => n.Name)
                        .ToListAsync(cancellationToken);

                    var suggestedResources = new List<SuggestedResourceDto>();
                    foreach (var file in files)
                    {
                        var resType = ClassifyResourceType(file.MimeType, file.FileExtension);
                        suggestedResources.Add(new SuggestedResourceDto
                        {
                            ResourceTitle = file.Name,
                            DriveNodeId = file.Id,
                            FileName = file.Name,
                            ResourceType = resType
                        });
                    }

                    suggestedLessons.Add(new SuggestedLessonDto
                    {
                        LessonTitle = folder.Name,
                        LessonNumber = lessonNumber,
                        FolderDriveNodeId = folder.Id,
                        FolderName = folder.Name,
                        Resources = suggestedResources.OrderBy(r => r.ResourceType).ThenBy(r => r.ResourceTitle).ToList()
                    });
                }
            }
        }

        // ─── Case B: Folder directly contains lesson files or no folders matched ──
        if (suggestedLessons.Count == 0 && candidateFiles.Count > 0)
        {
            // Group files or create 1 lesson per file with the sanitized clean name
            var fileGroups = new Dictionary<string, List<SuggestedResourceDto>>();
            var lessonNumberMap = new Dictionary<string, int>();

            foreach (var file in candidateFiles)
            {
                // Sanitize file name: strips .mp4.mp4_2, .mp4, .mp3, etc.
                string cleanTitle = SanitizeLessonTitle(file.Name);

                int lessonNum = 0;
                var numMatch = Regex.Match(file.Name, @"\d+");
                if (numMatch.Success && int.TryParse(numMatch.Value, out int parsedNum))
                {
                    lessonNum = parsedNum;
                }

                string groupKey = cleanTitle;

                if (!fileGroups.ContainsKey(groupKey))
                {
                    fileGroups[groupKey] = new List<SuggestedResourceDto>();
                    lessonNumberMap[groupKey] = lessonNum;
                }

                fileGroups[groupKey].Add(new SuggestedResourceDto
                {
                    ResourceTitle = file.Name,
                    DriveNodeId = file.Id,
                    FileName = file.Name,
                    ResourceType = ClassifyResourceType(file.MimeType, file.FileExtension)
                });
            }

            foreach (var (title, resources) in fileGroups)
            {
                suggestedLessons.Add(new SuggestedLessonDto
                {
                    LessonTitle = title, // Clean title without any extension artifacts!
                    LessonNumber = lessonNumberMap.TryGetValue(title, out int num) ? num : 0,
                    FolderDriveNodeId = parentNode.Id,
                    FolderName = parentNode.Name,
                    Resources = resources.OrderBy(r => r.ResourceType).ThenBy(r => r.ResourceTitle).ToList()
                });
            }
        }

        suggestedLessons = suggestedLessons
            .OrderBy(l => l.LessonNumber > 0 ? l.LessonNumber : int.MaxValue)
            .ThenBy(l => l.LessonTitle)
            .ToList();

        return new AutoSuggestResultDto
        {
            TargetSectionId = request.TargetSectionId,
            MatchesFound = suggestedLessons.Count,
            SuggestedLessons = suggestedLessons
        };
    }

    public static string SanitizeLessonTitle(string rawName)
    {
        if (string.IsNullOrWhiteSpace(rawName)) return "Bài học mới";
        string cleaned = rawName.Trim();
        // Remove repetitive extension suffixes like .mp4.mp4_2, .mp4_2, .mp4, .pdf, .mp3, etc.
        cleaned = Regex.Replace(cleaned, @"(\.(mp4|mp3|m4a|wav|pdf|docx?|pptx?|txt|mkv|avi|webm|flv|part|zip|rar)(_\d+)?)+$", "", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\.(mp4|mp3|pdf|mkv|avi|docx?|txt)_\d+$", "", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\.[a-zA-Z0-9]{2,5}$", "", RegexOptions.IgnoreCase);
        return string.IsNullOrWhiteSpace(cleaned) ? rawName.Trim() : cleaned.Trim();
    }

    private static ResourceType ClassifyResourceType(string mimeType, string? extension)
    {
        var ext = (extension ?? "").TrimStart('.').ToLowerInvariant();

        if (mimeType.StartsWith("video/") || ext is "mp4" or "mkv" or "avi" or "mov" or "webm")
            return ResourceType.PrimaryVideo;

        if (mimeType.StartsWith("audio/") || ext is "mp3" or "wav" or "aac" or "m4a" or "ogg")
            return ResourceType.Audio;

        if (mimeType == "application/pdf" || ext is "pdf")
            return ResourceType.ExercisePdf;

        if (mimeType.Contains("document") || ext is "doc" or "docx" or "txt")
            return ResourceType.Document;

        return ResourceType.Document;
    }
}
