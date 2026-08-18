using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using NihongoLms.Domain.Interfaces;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AudioController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IGoogleDriveService _driveService;
    private readonly ITokenEncryptionService _encryptionService;
    private readonly IConfiguration _configuration;
    private readonly LmsDbContext _dbContext;
    private readonly ILogger<AudioController> _logger;

    private readonly string _uploadDir;
    private readonly string _cacheDir;

    public AudioController(
        IHttpClientFactory httpClientFactory,
        IGoogleDriveService driveService,
        ITokenEncryptionService encryptionService,
        IConfiguration configuration,
        LmsDbContext dbContext,
        ILogger<AudioController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _driveService = driveService;
        _encryptionService = encryptionService;
        _configuration = configuration;
        _dbContext = dbContext;
        _logger = logger;

        _uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "uploads", "audio");
        _cacheDir = Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "cache", "audio");

        Directory.CreateDirectory(_uploadDir);
        Directory.CreateDirectory(_cacheDir);
    }

    /// <summary>
    /// Mode 1: Upload local audio file directly to server (MP3, WAV, M4A, AAC, OGG)
    /// </summary>
    [HttpPost("upload")]
    public async Task<IActionResult> UploadAudio([FromForm] IFormFile? file, CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No audio file provided." });
        }

        var allowedExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"
        };

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext) || !allowedExts.Contains(ext))
        {
            return BadRequest(new { error = $"Unsupported audio extension: {ext}. Allowed: .mp3, .wav, .m4a, .aac, .ogg" });
        }

        string safeName = $"{Guid.NewGuid():N}_{Path.GetFileNameWithoutExtension(file.FileName)}{ext}";
        string filePath = Path.Combine(_uploadDir, safeName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        string baseUrl = $"{Request.Scheme}://{Request.Host}";
        string fileUrl = $"{baseUrl}/api/audio/files/{safeName}";

        return Ok(new
        {
            success = true,
            fileUrl,
            fileName = safeName,
            originalName = file.FileName,
            size = file.Length,
            mimeType = file.ContentType
        });
    }

    /// <summary>
    /// Stream uploaded local audio files with HTTP range processing support
    /// </summary>
    [HttpGet("files/{fileName}")]
    public IActionResult GetUploadedAudioFile(string fileName)
    {
        string filePath = Path.Combine(_uploadDir, fileName);
        if (!System.IO.File.Exists(filePath))
        {
            return NotFound(new { error = "Audio file not found." });
        }

        string contentType = GetMimeType(filePath);
        return PhysicalFile(filePath, contentType, enableRangeProcessing: true);
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, SemaphoreSlim> _downloadLocks = new();

    /// <summary>
    /// Mode 2: Proxy & local cache Google Drive audio link/ID for instant playback & no CORS
    /// </summary>
    [HttpGet("proxy-drive")]
    public async Task<IActionResult> ProxyDriveAudio(
        [FromQuery] string? driveFileId,
        [FromQuery] string? url,
        CancellationToken cancellationToken)
    {
        string? targetId = driveFileId?.Trim();
        if (string.IsNullOrWhiteSpace(targetId) && !string.IsNullOrWhiteSpace(url))
        {
            targetId = ExtractDriveId(url);
        }

        if (string.IsNullOrWhiteSpace(targetId))
        {
            return BadRequest(new { error = "Please provide driveFileId or a valid Google Drive URL." });
        }

        Response.Headers.Append("Access-Control-Allow-Origin", "*");
        Response.Headers.Append("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        Response.Headers.Append("Access-Control-Allow-Headers", "Range, Authorization, Content-Type");
        Response.Headers.Append("Accept-Ranges", "bytes");

        string cachedPath = Path.Combine(_cacheDir, $"{targetId}.mp3");

        // 1. Fast path: If already cached locally and is valid binary audio, stream immediately!
        if (System.IO.File.Exists(cachedPath))
        {
            if (IsValidAudioFile(cachedPath))
            {
                return PhysicalFile(cachedPath, "audio/mpeg", enableRangeProcessing: true);
            }
            else
            {
                try { System.IO.File.Delete(cachedPath); } catch {}
            }
        }

        // 2. Synchronize initial download across concurrent requests for the same driveFileId
        var semaphore = _downloadLocks.GetOrAdd(targetId, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync(cancellationToken);

        try
        {
            // Double check cache after acquiring lock
            if (System.IO.File.Exists(cachedPath))
            {
                if (IsValidAudioFile(cachedPath))
                {
                    return PhysicalFile(cachedPath, "audio/mpeg", enableRangeProcessing: true);
                }
                else
                {
                    try { System.IO.File.Delete(cachedPath); } catch {}
                }
            }

            // Fetch OAuth Access Token from DB
            var tokenEntity = await _dbContext.UserOAuthTokens
                .FirstOrDefaultAsync(u => u.UserId == "default-user", cancellationToken);

            string? accessToken = null;
            if (tokenEntity != null)
            {
                // Refresh token if expired
                if (tokenEntity.ExpiresAtUtc <= DateTime.UtcNow.AddMinutes(2))
                {
                    try
                    {
                        string refreshToken = _encryptionService.Decrypt(tokenEntity.EncryptedRefreshToken);
                        string clientId = _configuration["Authentication:Google:ClientId"] ?? _configuration["GoogleOAuth:ClientId"] ?? "";
                        string clientSecret = _configuration["Authentication:Google:ClientSecret"] ?? _configuration["GoogleOAuth:ClientSecret"] ?? "";
                        string newAccessToken = await _driveService.RefreshAccessTokenAsync(clientId, clientSecret, refreshToken, cancellationToken);

                        tokenEntity.EncryptedAccessToken = _encryptionService.Encrypt(newAccessToken);
                        tokenEntity.ExpiresAtUtc = DateTime.UtcNow.AddHours(1);
                        tokenEntity.UpdatedAtUtc = DateTime.UtcNow;
                        await _dbContext.SaveChangesAsync(cancellationToken);

                        accessToken = newAccessToken;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to refresh Google OAuth token, using current token");
                        accessToken = _encryptionService.Decrypt(tokenEntity.EncryptedAccessToken);
                    }
                }
                else
                {
                    accessToken = _encryptionService.Decrypt(tokenEntity.EncryptedAccessToken);
                }
            }

            string tempPath = Path.Combine(_cacheDir, $"{targetId}_{Guid.NewGuid():N}.tmp");

            if (!string.IsNullOrEmpty(accessToken))
            {
                try
                {
                    var credential = GoogleCredential.FromAccessToken(accessToken);
                    var driveService = new DriveService(new BaseClientService.Initializer
                    {
                        HttpClientInitializer = credential,
                        ApplicationName = "NihongoLms"
                    });

                    var getRequest = driveService.Files.Get(targetId);
                    getRequest.Alt = FilesResource.GetRequest.AltEnum.Media;
                    getRequest.SupportsAllDrives = true;

                    using (var fs = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        var result = await getRequest.DownloadAsync(fs, cancellationToken);
                        if (result.Status == Google.Apis.Download.DownloadStatus.Failed)
                        {
                            throw result.Exception ?? new Exception("Google Drive SDK download status Failed.");
                        }
                    }

                    if (System.IO.File.Exists(tempPath) && IsValidAudioFile(tempPath))
                    {
                        if (System.IO.File.Exists(cachedPath)) try { System.IO.File.Delete(cachedPath); } catch {}
                        System.IO.File.Move(tempPath, cachedPath);
                        return PhysicalFile(cachedPath, "audio/mpeg", enableRangeProcessing: true);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Drive API SDK download failed for {TargetId}, trying HTTP fallback", targetId);
                    if (System.IO.File.Exists(tempPath)) try { System.IO.File.Delete(tempPath); } catch {}
                }
            }

            // Fallback HTTP Download
            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(60);

            HttpResponseMessage? response = null;
            if (!string.IsNullOrEmpty(accessToken))
            {
                var req = new HttpRequestMessage(HttpMethod.Get, $"https://www.googleapis.com/drive/v3/files/{targetId}?alt=media&supportsAllDrives=true");
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
                response = await httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            }

            if (response == null || !response.IsSuccessStatusCode)
            {
                var downloadUrls = new[]
                {
                    $"https://drive.usercontent.google.com/download?id={targetId}&export=download&confirm=t",
                    $"https://drive.google.com/uc?id={targetId}&export=download&confirm=t",
                    $"https://docs.google.com/uc?export=download&id={targetId}"
                };

                foreach (var urlCandidate in downloadUrls)
                {
                    try
                    {
                        var req = new HttpRequestMessage(HttpMethod.Get, urlCandidate);
                        req.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                        response = await httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                        if (response.IsSuccessStatusCode) break;
                    }
                    catch {}
                }
            }

            if (response == null || !response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to download audio from Drive ID {TargetId}: StatusCode {Status}", targetId, response?.StatusCode);
                return StatusCode(response != null ? (int)response.StatusCode : 502, new { error = "Unable to fetch audio stream from Google Drive." });
            }

            using (var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await response.Content.CopyToAsync(fileStream, cancellationToken);
            }

            if (System.IO.File.Exists(tempPath) && IsValidAudioFile(tempPath))
            {
                if (System.IO.File.Exists(cachedPath)) try { System.IO.File.Delete(cachedPath); } catch {}
                System.IO.File.Move(tempPath, cachedPath);
                return PhysicalFile(cachedPath, "audio/mpeg", enableRangeProcessing: true);
            }
            else
            {
                if (System.IO.File.Exists(tempPath)) try { System.IO.File.Delete(tempPath); } catch {}
                return StatusCode(502, new { error = "Google Drive returned non-audio response (login/HTML page)." });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming audio from Drive ID {TargetId}", targetId);
            return StatusCode(500, new { error = $"Streaming proxy error: {ex.Message}" });
        }
        finally
        {
            semaphore.Release();
        }
    }

    private static bool IsValidAudioFile(string filePath)
    {
        try
        {
            var info = new FileInfo(filePath);
            if (info.Length < 100) return false;

            byte[] header = new byte[16];
            using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read))
            {
                int read = fs.Read(header, 0, header.Length);
                if (read < 16) return false;
            }

            string textHeader = System.Text.Encoding.UTF8.GetString(header).ToLowerInvariant();
            if (textHeader.Contains("<!doc") || textHeader.Contains("<html") || textHeader.Contains("{\"err"))
            {
                return false;
            }

            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string? ExtractDriveId(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        var trimmed = url.Trim();
        if (Regex.IsMatch(trimmed, @"^[a-zA-Z0-9_-]{25,50}$")) return trimmed;

        var m1 = Regex.Match(trimmed, @"/file/d/([a-zA-Z0-9_-]+)");
        if (m1.Success) return m1.Groups[1].Value;

        var m2 = Regex.Match(trimmed, @"[?&]id=([a-zA-Z0-9_-]+)");
        if (m2.Success) return m2.Groups[1].Value;

        return null;
    }

    private static string GetMimeType(string path)
    {
        var ext = Path.GetExtension(path).ToLowerInvariant();
        return ext switch
        {
            ".mp3" => "audio/mpeg",
            ".wav" => "audio/wav",
            ".ogg" => "audio/ogg",
            ".m4a" => "audio/mp4",
            ".aac" => "audio/aac",
            ".flac" => "audio/flac",
            _ => "application/octet-stream"
        };
    }
}
