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
            CreatedAtUtc = v.CreatedAtUtc
        };
    }
}
