using System;
using System.Collections.Generic;
using NihongoLms.Domain.Enums;

namespace NihongoLms.Application.DTOs;

/// <summary>
/// Cấu hình ánh xạ thư mục Drive thành khóa học LMS (Flexible Mapping Configuration)
/// </summary>
public class FolderMappingConfigDto
{
    public Guid RootFolderNodeId { get; set; }
    public string CourseTitle { get; set; } = string.Empty;
    public string JlptLevel { get; set; } = "N4";
    public string PresetName { get; set; } = "auto"; // "minna-lesson", "stage-skill-chapter", "flat-chapters", "custom"

    /// <summary>Chế độ gom nhóm Section: "combine-stage-skill" (Gộp Chặng + Kỹ năng), "single-folder", "flat-chapters", "custom"</summary>
    public string SectionGroupingMode { get; set; } = "combine-stage-skill";

    /// <summary>Gộp tên thư mục cha cấp trên vào tên Section (Ví dụ: "Chặng 1 - Chữ Hán", "Chặng 1 - Ngữ Pháp")</summary>
    public bool CombineParentStages { get; set; } = true;

    /// <summary>Giải thích hoặc phản hồi từ AI khi phân tích cây</summary>
    public string? AiAnalysisRationale { get; set; }

    /// <summary>Độ sâu tương đối của thư mục làm Section (1-based relative to root)</summary>
    public int SectionFolderDepth { get; set; } = 1;

    /// <summary>Độ sâu tương đối của thư mục làm Lesson (1-based relative to root)</summary>
    public int LessonFolderDepth { get; set; } = 2;

    /// <summary>Nếu thư mục không có subfolder con, mỗi file media tự thành 1 Lesson hay gom vào 1 Lesson chung</summary>
    public bool IncludeLeafFilesAsLessons { get; set; } = false;

    /// <summary>Danh sách pattern regex/glob bỏ qua (ví dụ: *lộ trình*, *file sách*, *00.*)</summary>
    public List<string> ExcludeFolderPatterns { get; set; } = new()
    {
        "*lộ trình*", "*lo trinh*", "*file sách*", "*file sach*", "*hướng dẫn*", "*huong dan*"
    };

    /// <summary>Bỏ qua các định dạng file không phải tài liệu học tập</summary>
    public List<string> ExcludeFileExtensions { get; set; } = new()
    {
        ".exe", ".zip", ".rar", ".iso", ".txt", ".ini"
    };

    /// <summary>
    /// Bảng quy tắc map từ khóa trong RawPath ra Nhãn Kỹ Năng (Skill tag).
    /// Chạy trên TOÀN BỘ đường dẫn (RawPath) để nhận diện đúng kể cả khi file tên videoplayback.mp4.
    /// </summary>
    public Dictionary<string, string> SkillKeywordRules { get; set; } = new(StringComparer.OrdinalIgnoreCase)
    {
        { "chu han", "Kanji" },
        { "chữ hán", "Kanji" },
        { "kanji", "Kanji" },
        { "tu vung", "Vocabulary" },
        { "từ vựng", "Vocabulary" },
        { "kotoba", "Vocabulary" },
        { "ngu phap", "Grammar" },
        { "ngữ pháp", "Grammar" },
        { "bunpou", "Grammar" },
        { "nghe", "Choukai" },
        { "choukai", "Choukai" },
        { "mondai", "Choukai" },
        { "doc", "Dokkai" },
        { "đọc", "Dokkai" },
        { "dokkai", "Dokkai" },
        { "tanbun", "Dokkai" },
        { "chuubun", "Dokkai" },
        { "choubun", "Dokkai" },
        { "kensaku", "Dokkai" },
        { "hoi thoai", "Kaiwa" },
        { "hội thoại", "Kaiwa" },
        { "kaiwa", "Kaiwa" },
        { "de thi", "Quiz" },
        { "đề thi", "Quiz" },
        { "thi thu", "Quiz" },
        { "thi thử", "Quiz" },
        { "luyen de", "Quiz" },
        { "luyện đề", "Quiz" },
        { "test", "Quiz" },
        { "kiem tra", "Quiz" }
    };

    /// <summary>Thời lượng ước tính mặc định cho mỗi bài (phút)</summary>
    public int DefaultLessonDurationMinutes { get; set; } = 45;

    /// <summary>Tự động gộp các file tài liệu dùng chung / tổng hợp ngoài folder bài giảng</summary>
    public bool EnableCrossFolderMatching { get; set; } = true;
}

/// <summary>
/// Node trong cây thư mục thu nhỏ để preview ở bước 1
/// </summary>
public class FolderTreeNodeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int NodeType { get; set; } // 0 = Folder, 1 = File
    public string RawPath { get; set; } = string.Empty;
    public int RelativeDepth { get; set; }
    public int SubFolderCount { get; set; }
    public int FileCount { get; set; }
    public List<FolderTreeNodeDto> Children { get; set; } = new();
}

/// <summary>
/// Kết quả tự động nhận diện cấu trúc cây thư mục (Auto-Detection Heuristics)
/// </summary>
public class AutoDetectFolderResultDto
{
    public Guid RootFolderId { get; set; }
    public string RootFolderName { get; set; } = string.Empty;
    public string DetectedPreset { get; set; } = "minna-lesson";
    public double Confidence { get; set; } = 0.95;
    public string Rationale { get; set; } = string.Empty;
    public int TotalSubFolders { get; set; }
    public int TotalFiles { get; set; }
    public int MaxDepth { get; set; }
    public FolderMappingConfigDto SuggestedConfig { get; set; } = new();
    public List<FolderTreeNodeDto> FolderTreePreview { get; set; } = new();
    public List<FolderPresetInfoDto> AvailablePresets { get; set; } = new();
}

/// <summary>
/// Thông tin preset cấu hình sẵn
/// </summary>
public class FolderPresetInfoDto
{
    public string PresetId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int SectionDepth { get; set; }
    public int LessonDepth { get; set; }
    public bool IncludeLeafFilesAsLessons { get; set; }
    public string SamplePathPattern { get; set; } = string.Empty;
}

/// <summary>
/// Request gửi JSON cây thư mục lên cho AI (Gemini) phân tích
/// </summary>
public class AiAnalyzeTreeRequestDto
{
    public Guid RootFolderId { get; set; }
    public string? CustomPromptInstruction { get; set; }
}

public class DetectFolderRequestDto
{
    public Guid FolderId { get; set; }
}

/// <summary>
/// Request quét thư mục cục bộ trên máy chủ/máy người dùng
/// </summary>
public class ScanLocalFolderRequestDto
{
    public string LocalPath { get; set; } = string.Empty;
    public string? CourseTitle { get; set; }
    public string? JlptLevel { get; set; }
}

/// <summary>
/// Kết quả quét thư mục cục bộ
/// </summary>
public class ScanLocalFolderResponseDto
{
    public Guid RootFolderNodeId { get; set; }
    public string LocalPath { get; set; } = string.Empty;
    public string RootFolderName { get; set; } = string.Empty;
    public AutoDetectFolderResultDto DetectionResult { get; set; } = new();
}

