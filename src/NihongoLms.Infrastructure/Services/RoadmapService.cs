using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

/// <summary>
/// Quản lý RoadmapTemplate (CRUD cho Curator) và UserRoadmapEnrollment + Schedule (cho Learner).
/// Logic tính lịch học cá nhân theo PaceMode được tính động, không lưu cứng vào DB.
/// </summary>
public class RoadmapService : IRoadmapService
{
    private readonly LmsDbContext _db;

    public RoadmapService(LmsDbContext db)
    {
        _db = db;
    }

    // ═══════════════════════════════════════════════════════════
    //  CURATOR: CRUD RoadmapTemplate
    // ═══════════════════════════════════════════════════════════

    public async Task<List<RoadmapTemplateDto>> GetTemplatesAsync(
        string? jlptLevel, CancellationToken ct = default)
    {
        var query = _db.RoadmapTemplates.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(jlptLevel))
            query = query.Where(t => t.JlptLevel == jlptLevel);

        var templates = await query
            .OrderByDescending(t => t.CreatedAtUtc)
            .Select(t => new RoadmapTemplateDto
            {
                Id                    = t.Id,
                Title                 = t.Title,
                JlptLevel             = t.JlptLevel,
                Description           = t.Description,
                TotalDays             = t.TotalDays,
                TotalEstimatedMinutes = t.TotalEstimatedMinutes,
                SourcePdfName         = t.SourcePdfName,
                IsPublished           = t.IsPublished,
                CreatedAtUtc          = t.CreatedAtUtc,
                // Không load Items ở list view để tránh N+1
                Items = new List<RoadmapItemDto>()
            })
            .ToListAsync(ct);

        return templates;
    }

    public async Task<RoadmapTemplateDto?> GetTemplateByIdAsync(
        Guid id, CancellationToken ct = default)
    {
        var t = await _db.RoadmapTemplates
            .AsNoTracking()
            .Include(x => x.Items.OrderBy(i => i.DayNumber))
                .ThenInclude(i => i.DriveFiles.OrderBy(f => f.DisplayOrder))
                    .ThenInclude(f => f.DriveNode)
            .Include(x => x.Items)
                .ThenInclude(i => i.LinkedLesson)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return t is null ? null : SyllabusParserService.MapToTemplateDto(t);
    }

    public async Task<RoadmapTemplateDto> PublishTemplateAsync(
        Guid id, bool isPublished, CancellationToken ct = default)
    {
        var template = await _db.RoadmapTemplates.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new KeyNotFoundException($"RoadmapTemplate {id} không tìm thấy.");

        template.IsPublished = isPublished;
        await _db.SaveChangesAsync(ct);

        return (await GetTemplateByIdAsync(id, ct))!;
    }

    public async Task DeleteTemplateAsync(Guid id, CancellationToken ct = default)
    {
        var template = await _db.RoadmapTemplates.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (template is not null)
        {
            _db.RoadmapTemplates.Remove(template);
            await _db.SaveChangesAsync(ct);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  LEARNER: Enrollment
    // ═══════════════════════════════════════════════════════════

    public async Task<UserRoadmapEnrollmentDto> EnrollAsync(
        EnrollRoadmapRequestDto dto, string userId, CancellationToken ct = default)
    {
        var template = await _db.RoadmapTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == dto.RoadmapTemplateId && t.IsPublished, ct)
            ?? throw new KeyNotFoundException(
                $"RoadmapTemplate {dto.RoadmapTemplateId} không tìm thấy hoặc chưa được xuất bản.");

        // Kiểm tra đã enroll chưa
        var existing = await _db.UserRoadmapEnrollments
            .FirstOrDefaultAsync(e => e.UserId == userId && e.RoadmapTemplateId == dto.RoadmapTemplateId, ct);

        if (existing is not null)
        {
            // Cập nhật lại nếu đã enroll — cho phép đổi startDate và pace
            existing.StartDate = dto.StartDate;
            existing.PaceMode  = dto.PaceMode;
            existing.IsActive  = true;
            await _db.SaveChangesAsync(ct);
            return MapToEnrollmentDto(existing, template);
        }

        var enrollment = new UserRoadmapEnrollment
        {
            UserId            = userId,
            RoadmapTemplateId = dto.RoadmapTemplateId,
            StartDate         = dto.StartDate,
            PaceMode          = dto.PaceMode,
            IsActive          = true,
            EnrolledAtUtc     = DateTime.UtcNow,
        };

        _db.UserRoadmapEnrollments.Add(enrollment);
        await _db.SaveChangesAsync(ct);

        return MapToEnrollmentDto(enrollment, template);
    }

    public async Task<List<UserRoadmapEnrollmentDto>> GetMyEnrollmentsAsync(
        string userId, CancellationToken ct = default)
    {
        var enrollments = await _db.UserRoadmapEnrollments
            .AsNoTracking()
            .Where(e => e.UserId == userId && e.IsActive)
            .Include(e => e.RoadmapTemplate)
            .Include(e => e.DayProgresses)
            .OrderByDescending(e => e.EnrolledAtUtc)
            .ToListAsync(ct);

        return enrollments.Select(e =>
        {
            var dto = MapToEnrollmentDto(e, e.RoadmapTemplate!);
            dto.CompletedDays = e.DayProgresses.Count(p => p.IsCompleted);
            return dto;
        }).ToList();
    }

    // ═══════════════════════════════════════════════════════════
    //  LEARNER: Schedule (computed động)
    // ═══════════════════════════════════════════════════════════

    public async Task<List<UserScheduleDayDto>> GetMyScheduleAsync(
        Guid enrollmentId, string userId, CancellationToken ct = default)
    {
        var enrollment = await _db.UserRoadmapEnrollments
            .AsNoTracking()
            .Include(e => e.RoadmapTemplate)
                .ThenInclude(t => t!.Items.OrderBy(i => i.DayNumber))
                    .ThenInclude(i => i.DriveFiles.OrderBy(f => f.DisplayOrder))
                        .ThenInclude(f => f.DriveNode)
            .Include(e => e.RoadmapTemplate)
                .ThenInclude(t => t!.Items)
                    .ThenInclude(i => i.LinkedLesson)
            .Include(e => e.DayProgresses)
            .FirstOrDefaultAsync(e => e.Id == enrollmentId && e.UserId == userId, ct)
            ?? throw new KeyNotFoundException($"Enrollment {enrollmentId} không tìm thấy.");

        var items      = enrollment.RoadmapTemplate!.Items.OrderBy(i => i.DayNumber).ToList();
        var progresses = enrollment.DayProgresses.ToDictionary(p => p.DayNumber);
        var today      = DateOnly.FromDateTime(DateTime.Today);
        var schedule   = new List<UserScheduleDayDto>();

        for (int idx = 0; idx < items.Count; idx++)
        {
            var item = items[idx];
            // Tính ngày calendar theo PaceMode
            DateOnly date = ComputeDate(enrollment.StartDate, idx, enrollment.PaceMode);

            progresses.TryGetValue(item.DayNumber, out var progress);
            bool isCompleted = progress?.IsCompleted ?? false;

            schedule.Add(new UserScheduleDayDto
            {
                Date                     = date,
                DayNumber                = item.DayNumber,
                Title                    = item.Title,
                Description              = item.Description,
                EstimatedDurationMinutes = item.EstimatedDurationMinutes,
                Skills                   = TryDeserializeList(item.SkillsJson),
                IsCompleted              = isCompleted,
                CompletedAtUtc           = progress?.CompletedAtUtc,
                LinkedLessonId           = item.LinkedLessonId,
                LinkedLessonTitle        = item.LinkedLesson?.Title,
                IsToday                  = date == today,
                IsOverdue                = date < today && !isCompleted,
                DriveFiles = item.DriveFiles.OrderBy(f => f.DisplayOrder).Select(f => new RoadmapItemDriveFileDto
                {
                    Id           = f.Id,
                    DriveNodeId  = f.DriveNodeId,
                    FileName     = f.DriveNode?.Name ?? string.Empty,
                    WebViewLink  = f.DriveNode?.WebViewLink,
                    MatchScore   = f.MatchScore,
                    ResourceType = f.ResourceType,
                    DisplayOrder = f.DisplayOrder,
                }).ToList()
            });
        }

        return schedule;
    }

    public async Task MarkDayCompleteAsync(
        Guid enrollmentId, int dayNumber, bool isCompleted, string userId, CancellationToken ct = default)
    {
        var enrollment = await _db.UserRoadmapEnrollments
            .FirstOrDefaultAsync(e => e.Id == enrollmentId && e.UserId == userId, ct)
            ?? throw new KeyNotFoundException($"Enrollment {enrollmentId} không tìm thấy.");

        var progress = await _db.UserRoadmapDayProgresses
            .FirstOrDefaultAsync(p => p.EnrollmentId == enrollmentId && p.DayNumber == dayNumber, ct);

        if (progress is null)
        {
            progress = new UserRoadmapDayProgress
            {
                EnrollmentId = enrollmentId,
                DayNumber    = dayNumber,
            };
            _db.UserRoadmapDayProgresses.Add(progress);
        }

        progress.IsCompleted    = isCompleted;
        progress.CompletedAtUtc = isCompleted ? DateTime.UtcNow : null;

        await _db.SaveChangesAsync(ct);
    }

    // ═══════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// Tính ngày calendar thực tế từ StartDate, index (0-based) và PaceMode.
    /// - Normal:    1 item/ngày → date = startDate + idx days
    /// - Intensive: 2 items/ngày → date = startDate + (idx / 2) days
    /// - Relaxed:   1 item/2 ngày → date = startDate + (idx * 2) days
    /// </summary>
    private static DateOnly ComputeDate(DateOnly startDate, int zeroBasedIndex, PaceMode pace)
        => pace switch
        {
            PaceMode.Intensive => startDate.AddDays(zeroBasedIndex / 2),
            PaceMode.Relaxed   => startDate.AddDays(zeroBasedIndex * 2),
            _                  => startDate.AddDays(zeroBasedIndex),  // Normal
        };

    /// <summary>Tính ngày kết thúc dự kiến từ StartDate + TotalDays + PaceMode.</summary>
    private static DateOnly ComputeEndDate(DateOnly startDate, int totalDays, PaceMode pace)
        => pace switch
        {
            PaceMode.Intensive => startDate.AddDays((totalDays - 1) / 2),
            PaceMode.Relaxed   => startDate.AddDays((totalDays - 1) * 2),
            _                  => startDate.AddDays(totalDays - 1),
        };

    private static UserRoadmapEnrollmentDto MapToEnrollmentDto(
        UserRoadmapEnrollment e, RoadmapTemplate template) => new()
    {
        Id                 = e.Id,
        UserId             = e.UserId,
        RoadmapTemplateId  = e.RoadmapTemplateId,
        TemplateTitle      = template.Title,
        StartDate          = e.StartDate,
        PaceMode           = e.PaceMode,
        EstimatedEndDate   = ComputeEndDate(e.StartDate, template.TotalDays, e.PaceMode),
        IsActive           = e.IsActive,
        TotalDays          = template.TotalDays,
        CompletedDays      = 0, // được ghi đè nơi cần
        EnrolledAtUtc      = e.EnrolledAtUtc,
    };

    private static List<string> TryDeserializeList(string json)
    {
        try { return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json) ?? new(); }
        catch { return new(); }
    }
}
