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
});

// Domain & Application Services
builder.Services.AddSingleton<ITokenEncryptionService, TokenEncryptionService>();
builder.Services.AddScoped<IGoogleDriveService, GoogleDriveService>();
builder.Services.AddScoped<IDriveSyncService, DriveSyncService>();
builder.Services.AddScoped<ICuratorService, CuratorService>();
builder.Services.AddScoped<IAutoSuggestPatternEngine, AutoSuggestPatternEngine>();
builder.Services.AddScoped<IVocabularyService, VocabularyService>();
builder.Services.AddScoped<IQuizAdminService, QuizAdminService>();
builder.Services.AddScoped<IProgressService, ProgressService>();
builder.Services.AddScoped<ISrsService, SrsService>();
builder.Services.AddScoped<IQuizLearnerService, QuizLearnerService>();
builder.Services.AddSingleton<ISrsSchedulingEngine, SrsSchedulingEngine>();
builder.Services.AddSingleton<IQuizGradingEngine, QuizGradingEngine>();

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

// DB Health Check on startup
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<LmsDbContext>();
        var canConnect = await db.Database.CanConnectAsync();
        if (canConnect)
            logger.LogInformation("[DriveLearn] PostgreSQL connected: {Host}", connectionString.Split(';')[0]);
        else
            logger.LogWarning("[DriveLearn] PostgreSQL CanConnect returned false.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[DriveLearn] PostgreSQL connection FAILED. Verify Port=5433 and Docker container is running.");
    }
}

app.Run();