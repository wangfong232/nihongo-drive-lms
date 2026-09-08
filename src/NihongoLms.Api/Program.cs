using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Interfaces;
using NihongoLms.Infrastructure.Data;
using NihongoLms.Infrastructure.Jobs;
using NihongoLms.Infrastructure.Services;
using Quartz;

var builder = WebApplication.CreateBuilder(args);

// Add Services to DI container
builder.Services.AddHttpClient();

// FIX: Bỏ qua vòng lặp tham chiếu hai chiều giữa ParentNode và ChildNodes
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        // Accept camelCase from frontend AND output camelCase to frontend
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database Context (PostgreSQL with InMemory fallback for non-PG connection strings)
string connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5433;Database=nihongo_lms;Username=postgres;Password=postgres";

builder.Services.AddDbContext<LmsDbContext>(options =>
{
    if (connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase))
    {
        options.UseNpgsql(connectionString);
    }
    else
    {
        options.UseInMemoryDatabase("NihongoLmsDev");
    }
    options.ConfigureWarnings(warnings => warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

// ASP.NET Core Data Protection for Secrets & Keys Encryption
builder.Services.AddDataProtection()
    .SetApplicationName("NihongoLms");

// Domain & Application Services
builder.Services.AddSingleton<ITokenEncryptionService, TokenEncryptionService>();
builder.Services.AddScoped<IGoogleDriveService, GoogleDriveService>();
builder.Services.AddScoped<IDriveSyncService, DriveSyncService>();
builder.Services.AddScoped<ICuratorService, CuratorService>();
builder.Services.AddScoped<IAutoSuggestPatternEngine, AutoSuggestPatternEngine>();
builder.Services.AddScoped<IVocabularyService, VocabularyService>();
builder.Services.AddScoped<IKanjiService, KanjiService>();
builder.Services.AddScoped<IQuizAdminService, QuizAdminService>();
builder.Services.AddScoped<IProgressService, ProgressService>();
builder.Services.AddScoped<ISrsService, SrsService>();
builder.Services.AddScoped<IQuizLearnerService, QuizLearnerService>();
builder.Services.AddSingleton<ISrsSchedulingEngine, SrsSchedulingEngine>();
builder.Services.AddSingleton<IQuizGradingEngine, QuizGradingEngine>();

// System Settings & Encrypted Keys
builder.Services.AddScoped<ISystemSettingsService, SystemSettingsService>();

// Roadmap Template & Flexible Folder Course Builder System
builder.Services.AddScoped<ISyllabusParserService, SyllabusParserService>();
builder.Services.AddScoped<IRoadmapService, RoadmapService>();
builder.Services.AddScoped<IFolderCourseBuilderService, FolderCourseBuilderService>();
builder.Services.AddScoped<IAiSenseiService, AiSenseiService>();

// Quartz.NET Background Sync Job Setup
builder.Services.AddQuartz(q =>
{
    var jobKey = new JobKey("DriveRawMirrorSyncJob");
    q.AddJob<DriveRawMirrorSyncJob>(opts => opts.WithIdentity(jobKey));

    // Schedule job to run every 6 hours
    q.AddTrigger(opts => opts
        .ForJob(jobKey)
        .WithIdentity("DriveRawMirrorSyncJob-Trigger")
        .WithCronSchedule("0 0 */6 * * ?")); // Every 6 hours
});

builder.Services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);

// CORS Policy for Next.js Frontend (localhost:3000)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "https://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure HTTP Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthorization();
app.MapControllers();

// Health check endpoints for startup scripts and monitoring
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));
app.MapGet("/api/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));

// DB Health Check and Automatic Schema Migration on startup
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var db = scope.ServiceProvider.GetRequiredService<LmsDbContext>();

    if (db.Database.IsRelational())
    {
        // Retry logic to wait for PostgreSQL container initialization (15 retries x 2s = 30s)
        int maxRetries = 15;
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                logger.LogInformation("[DriveLearn] Connecting to PostgreSQL (Attempt {Attempt}/{MaxRetries})...", attempt, maxRetries);
                var canConnect = await db.Database.CanConnectAsync();
                if (canConnect)
                {
                    logger.LogInformation("[DriveLearn] PostgreSQL connected successfully! Applying EF Core Migrations...");
                    await db.Database.MigrateAsync();
                    logger.LogInformation("[DriveLearn] All database tables and migrations are up to date! 🚀");
                    break;
                }
            }
            catch (Exception ex)
            {
                if (attempt == maxRetries)
                {
                    logger.LogError(ex, "[DriveLearn] PostgreSQL connection/migration FAILED after {MaxRetries} attempts. Verify Port 5433 and Docker container status.", maxRetries);
                }
                else
                {
                    logger.LogWarning("[DriveLearn] Database not ready yet ({Message}). Retrying in 2 seconds...", ex.Message);
                    await Task.Delay(2000);
                }
            }
        }
    }
    else
    {
        await db.Database.EnsureCreatedAsync();
        logger.LogInformation("[DriveLearn] In-Memory Database initialized.");
    }
}

app.Run();