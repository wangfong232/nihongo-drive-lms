using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class CuratorService : ICuratorService
{
    private readonly LmsDbContext _dbContext;

    public CuratorService(LmsDbContext dbContext)
    {
        _dbContext = dbContext;
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
        var section = new Section
        {
            CourseId = dto.CourseId,
            Title = dto.Title,
            Description = dto.Description,
            DisplayOrder = dto.DisplayOrder,
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
        var lesson = new Lesson
        {
            SectionId = dto.SectionId,
            Title = dto.Title,
            Description = dto.Description,
            DisplayOrder = dto.DisplayOrder,
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

    public async Task AssignQuizToLessonAsync(AssignQuizRequestDto dto, CancellationToken cancellationToken = default)
    {
        var quiz = await _dbContext.Quizzes.FirstOrDefaultAsync(q => q.Id == dto.QuizId, cancellationToken);
        if (quiz == null) throw new KeyNotFoundException($"Quiz {dto.QuizId} not found.");

        quiz.LessonId = dto.LessonId;
        await _dbContext.SaveChangesAsync(cancellationToken);
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
            Sections = c.Sections.Select(s => new SectionDto
            {
                Id = s.Id,
                CourseId = s.CourseId,
                Title = s.Title,
                Description = s.Description,
                DisplayOrder = s.DisplayOrder,
                Lessons = s.Lessons.Select(l => new LessonDto
                {
                    Id = l.Id,
                    SectionId = l.SectionId,
                    Title = l.Title,
                    Description = l.Description,
                    DisplayOrder = l.DisplayOrder,
                    EstimatedDurationMinutes = l.EstimatedDurationMinutes,
                    IsPublished = l.IsPublished,
                    Resources = l.Resources.Select(r => new ResourceDto
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
