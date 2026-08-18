using Microsoft.EntityFrameworkCore;
using NihongoLms.Domain.Entities;

namespace NihongoLms.Infrastructure.Data;

public class LmsDbContext : DbContext
{
    public LmsDbContext(DbContextOptions<LmsDbContext> options) : base(options) { }

    public DbSet<UserOAuthToken> UserOAuthTokens => Set<UserOAuthToken>();
    public DbSet<DriveNode> DriveNodes => Set<DriveNode>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Section> Sections => Set<Section>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<Resource> Resources => Set<Resource>();
    public DbSet<VocabularyEntry> VocabularyEntries => Set<VocabularyEntry>();
    public DbSet<ReviewSchedule> ReviewSchedules => Set<ReviewSchedule>();
    public DbSet<SrsReviewLog> SrsReviewLogs => Set<SrsReviewLog>();
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<LessonProgress> LessonProgresses => Set<LessonProgress>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // UserOAuthToken
        modelBuilder.Entity<UserOAuthToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId).IsUnique();
        });

        // DriveNode (Self-referencing recursive hierarchy)
        modelBuilder.Entity<DriveNode>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.DriveFileId).IsUnique();
            entity.HasIndex(e => e.ParentDriveFileId);
            entity.HasIndex(e => e.RawPath);

            entity.HasOne(d => d.ParentNode)
                  .WithMany(p => p.ChildNodes)
                  .HasForeignKey(d => d.ParentNodeId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Course -> Section -> Lesson
        modelBuilder.Entity<Course>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => e.JlptLevel);
        });

        modelBuilder.Entity<Section>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.CourseId);
            entity.HasIndex(e => new { e.CourseId, e.DisplayOrder });

            entity.HasOne(s => s.Course)
                  .WithMany(c => c.Sections)
                  .HasForeignKey(s => s.CourseId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Lesson>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.SectionId);
            entity.HasIndex(e => new { e.SectionId, e.DisplayOrder });

            entity.HasOne(l => l.Section)
                  .WithMany(s => s.Lessons)
                  .HasForeignKey(l => l.SectionId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Resource -> Lesson & DriveNode
        modelBuilder.Entity<Resource>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.LessonId);
            entity.HasIndex(e => e.DriveNodeId);
            entity.HasIndex(e => e.ResourceType);

            entity.HasOne(r => r.Lesson)
                  .WithMany(l => l.Resources)
                  .HasForeignKey(r => r.LessonId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.DriveNode)
                  .WithMany(d => d.LinkedResources)
                  .HasForeignKey(r => r.DriveNodeId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // VocabularyEntry
        modelBuilder.Entity<VocabularyEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Word);
            entity.HasIndex(e => e.JlptLevel);
            entity.HasIndex(e => e.LessonId);

            entity.HasOne(v => v.Lesson)
                  .WithMany(l => l.VocabularyEntries)
                  .HasForeignKey(v => v.LessonId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(v => v.AudioDriveNode)
                  .WithMany()
                  .HasForeignKey(v => v.AudioDriveNodeId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(v => v.StrokeOrderDriveNode)
                  .WithMany()
                  .HasForeignKey(v => v.StrokeOrderDriveNodeId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // ReviewSchedule (SM-2)
        modelBuilder.Entity<ReviewSchedule>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.NextReviewDateUtc });
            entity.HasIndex(e => new { e.UserId, e.VocabularyEntryId });
            entity.HasIndex(e => e.VocabularyEntryId);

            entity.HasOne(r => r.VocabularyEntry)
                  .WithMany(v => v.ReviewSchedules)
                  .HasForeignKey(r => r.VocabularyEntryId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Quiz -> Questions -> Attempts
        modelBuilder.Entity<Quiz>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.LessonId);
            entity.HasIndex(e => e.QuizType);

            entity.HasOne(q => q.Lesson)
                  .WithMany(l => l.Quizzes)
                  .HasForeignKey(q => q.LessonId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<QuizQuestion>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.QuizId);
            entity.HasIndex(e => new { e.QuizId, e.DisplayOrder });

            entity.HasOne(qq => qq.Quiz)
                  .WithMany(q => q.Questions)
                  .HasForeignKey(qq => qq.QuizId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(qq => qq.AudioDriveNode)
                  .WithMany()
                  .HasForeignKey(qq => qq.AudioDriveNodeId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(qq => qq.ImageDriveNode)
                  .WithMany()
                  .HasForeignKey(qq => qq.ImageDriveNodeId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<QuizAttempt>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.QuizId });
            entity.HasIndex(e => new { e.UserId, e.CompletedAtUtc });

            entity.HasOne(qa => qa.Quiz)
                  .WithMany(q => q.Attempts)
                  .HasForeignKey(qa => qa.QuizId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // LessonProgress
        modelBuilder.Entity<LessonProgress>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.LessonId }).IsUnique();
            entity.HasIndex(e => e.LessonId);
            entity.HasIndex(e => e.UserId);

            entity.HasOne(lp => lp.Lesson)
                  .WithMany(l => l.ProgressRecords)
                  .HasForeignKey(lp => lp.LessonId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
