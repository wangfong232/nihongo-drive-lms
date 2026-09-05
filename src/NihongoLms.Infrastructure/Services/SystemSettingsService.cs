using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Interfaces;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class SystemSettingsService : ISystemSettingsService
{
    private const string SettingKeyAiProvider      = "AiProvider:Provider";
    private const string SettingKeyAiApiKey        = "AiProvider:ApiKey";
    private const string SettingKeyAiBaseUrl       = "AiProvider:BaseUrl";
    private const string SettingKeyAiSelectedModel = "AiProvider:Model";

    private const string SettingKeyDriveClientId     = "GoogleDrive:ClientId";
    private const string SettingKeyDriveClientSecret = "GoogleDrive:ClientSecret";
    private const string SettingKeyDriveRefreshToken = "GoogleDrive:RefreshToken";
    private const string SettingKeyDriveRootFolderId = "GoogleDrive:RootFolderId";

    private const string DefaultGeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
    private const string DefaultGeminiModel   = "gemini-3.1-flash-lite";

    private const string DefaultOpenAiBaseUrl = "https://api.openai.com/v1";
    private const string DefaultOpenAiModel   = "gpt-4o-mini";

    private static readonly List<string> GeminiModels = new()
    {
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    };

    private static readonly List<string> OpenAiModels = new()
    {
        "gpt-4o-mini",
        "gpt-4o",
        "gpt-3.5-turbo",
    };

    private static readonly List<string> CustomModels = new()
    {
        "llama3.2",
        "deepseek-chat",
        "qwen2.5",
        "mistral-small",
    };

    private readonly LmsDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IGoogleDriveService _driveService;
    private readonly IDataProtector _protector;
    private readonly ILogger<SystemSettingsService> _logger;
    private readonly byte[] _legacyKey;

    public SystemSettingsService(
        LmsDbContext db,
        IConfiguration config,
        IHttpClientFactory httpFactory,
        IGoogleDriveService driveService,
        IDataProtectionProvider dataProtectionProvider,
        ILogger<SystemSettingsService> logger)
    {
        _db = db;
        _config = config;
        _httpFactory = httpFactory;
        _driveService = driveService;
        _logger = logger;

        // ASP.NET Core Data Protection
        _protector = dataProtectionProvider.CreateProtector("NihongoLms.Settings.Secrets.v1");

        // Legacy key for backward compatibility
        var secret = _config["Jwt:SecretKey"] 
                     ?? _config["System:EncryptionKey"] 
                     ?? "NihongoLms-Default-Local-Database-Encryption-Key-2026";
        using var sha = SHA256.Create();
        _legacyKey = sha.ComputeHash(Encoding.UTF8.GetBytes(secret));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Generic Settings CRUD
    // ═══════════════════════════════════════════════════════════════════════════

    public async Task<string?> GetSettingAsync(string key, CancellationToken ct = default)
    {
        var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (setting != null && !string.IsNullOrEmpty(setting.EncryptedValue))
        {
            try
            {
                return Decrypt(setting.EncryptedValue);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to decrypt setting '{Key}', falling back to config", key);
            }
        }
        return _config[key];
    }

    public async Task SaveSettingAsync(string key, string plainValue, string? description = null, CancellationToken ct = default)
    {
        var existing = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        var encrypted = Encrypt(plainValue);

        if (existing == null)
        {
            _db.SystemSettings.Add(new SystemSetting
            {
                Key = key,
                EncryptedValue = encrypted,
                Description = description,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
        else
        {
            existing.EncryptedValue = encrypted;
            existing.Description = description ?? existing.Description;
            existing.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteSettingAsync(string key, CancellationToken ct = default)
    {
        var existing = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (existing != null)
        {
            _db.SystemSettings.Remove(existing);
            await _db.SaveChangesAsync(ct);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  AI Settings & Models Management
    // ═══════════════════════════════════════════════════════════════════════════

    public async Task<AiSettingsDto> GetAiSettingsAsync(CancellationToken ct = default)
    {
        // 1. Check Database first
        var dbApiKeySetting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == SettingKeyAiApiKey, ct);
        string dbPlainKey = "";
        if (dbApiKeySetting != null && !string.IsNullOrEmpty(dbApiKeySetting.EncryptedValue))
        {
            try { dbPlainKey = Decrypt(dbApiKeySetting.EncryptedValue); } catch { }
        }

        var dbProvider = await GetSettingAsync(SettingKeyAiProvider, ct);
        var dbBaseUrl  = await GetSettingAsync(SettingKeyAiBaseUrl, ct);
        var dbModel    = await GetSettingAsync(SettingKeyAiSelectedModel, ct);

        if (!string.IsNullOrWhiteSpace(dbPlainKey) || !string.IsNullOrWhiteSpace(dbModel) || !string.IsNullOrWhiteSpace(dbProvider))
        {
            var provider = string.IsNullOrWhiteSpace(dbProvider) ? "gemini" : dbProvider.ToLowerInvariant();
            var baseUrl  = !string.IsNullOrWhiteSpace(dbBaseUrl) 
                ? dbBaseUrl 
                : (provider == "openai" ? DefaultOpenAiBaseUrl : DefaultGeminiBaseUrl);
            var model    = !string.IsNullOrWhiteSpace(dbModel) 
                ? dbModel 
                : (provider == "openai" ? DefaultOpenAiModel : DefaultGeminiModel);

            var availableModels = GetModelsForProvider(provider);
            if (!availableModels.Contains(model, StringComparer.OrdinalIgnoreCase))
            {
                availableModels.Insert(0, model);
            }

            return new AiSettingsDto
            {
                IsConfigured = !string.IsNullOrWhiteSpace(dbPlainKey),
                Source = "database",
                Provider = provider,
                MaskedApiKey = MaskApiKey(dbPlainKey),
                HasApiKey = !string.IsNullOrWhiteSpace(dbPlainKey),
                BaseUrl = baseUrl,
                SelectedModel = model,
                AvailableModels = availableModels,
                LastUpdatedUtc = dbApiKeySetting?.UpdatedAtUtc ?? DateTime.UtcNow
            };
        }

        // 2. Check Environment variables / appsettings.json fallback
        var envApiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY")
                        ?? Environment.GetEnvironmentVariable("AI__ApiKey")
                        ?? _config["GEMINI_API_KEY"]
                        ?? _config["AiProvider:ApiKey"]
                        ?? _config["AI:ApiKey"]
                        ?? "";

        var envProvider = _config["AiProvider:Provider"] ?? "gemini";
        var envBaseUrl  = _config["AiProvider:BaseUrl"] ?? (envProvider == "openai" ? DefaultOpenAiBaseUrl : DefaultGeminiBaseUrl);
        var envModel    = _config["AiProvider:Model"] ?? (envProvider == "openai" ? DefaultOpenAiModel : DefaultGeminiModel);
        var envModels   = GetModelsForProvider(envProvider);

        if (!string.IsNullOrWhiteSpace(envApiKey))
        {
            if (!envModels.Contains(envModel, StringComparer.OrdinalIgnoreCase))
            {
                envModels.Insert(0, envModel);
            }

            return new AiSettingsDto
            {
                IsConfigured = true,
                Source = "environment",
                Provider = envProvider,
                MaskedApiKey = MaskApiKey(envApiKey),
                HasApiKey = true,
                BaseUrl = envBaseUrl,
                SelectedModel = envModel,
                AvailableModels = envModels,
                LastUpdatedUtc = null
            };
        }

        // 3. Not configured
        return new AiSettingsDto
        {
            IsConfigured = false,
            Source = "none",
            Provider = "gemini",
            MaskedApiKey = "",
            HasApiKey = false,
            BaseUrl = DefaultGeminiBaseUrl,
            SelectedModel = DefaultGeminiModel,
            AvailableModels = GeminiModels,
            LastUpdatedUtc = null
        };
    }

    public async Task<AiSettingsDto> UpdateAiSettingsAsync(UpdateAiSettingsRequestDto request, CancellationToken ct = default)
    {
        var current = await GetAiSettingsAsync(ct);

        // 1. Update API Key only if user passed a non-empty string
        if (!string.IsNullOrWhiteSpace(request.ApiKey))
        {
            await SaveSettingAsync(SettingKeyAiApiKey, request.ApiKey.Trim(), "AI Provider API Key (DataProtection Encrypted)", ct);
        }

        // 2. Update Provider if provided
        if (!string.IsNullOrWhiteSpace(request.Provider))
        {
            var p = request.Provider.Trim().ToLowerInvariant();
            await SaveSettingAsync(SettingKeyAiProvider, p, "AI Provider Type", ct);
        }

        // 3. Update BaseUrl if provided
        if (!string.IsNullOrWhiteSpace(request.BaseUrl))
        {
            await SaveSettingAsync(SettingKeyAiBaseUrl, request.BaseUrl.Trim(), "AI Provider Base URL", ct);
        }

        // 4. Update SelectedModel if provided (allows single-click model switching!)
        if (!string.IsNullOrWhiteSpace(request.SelectedModel))
        {
            await SaveSettingAsync(SettingKeyAiSelectedModel, request.SelectedModel.Trim(), "AI Selected Model Name", ct);
        }

        return await GetAiSettingsAsync(ct);
    }

    public async Task<AiSettingsDto> DeleteAiSettingsAsync(CancellationToken ct = default)
    {
        await DeleteSettingAsync(SettingKeyAiApiKey, ct);
        await DeleteSettingAsync(SettingKeyAiProvider, ct);
        await DeleteSettingAsync(SettingKeyAiBaseUrl, ct);
        await DeleteSettingAsync(SettingKeyAiSelectedModel, ct);

        return await GetAiSettingsAsync(ct);
    }

    public async Task<(string ApiKey, string BaseUrl, string Model)> GetEffectiveAiConfigAsync(CancellationToken ct = default)
    {
        var current = await GetAiSettingsAsync(ct);

        string rawApiKey = "";
        if (current.Source == "database")
        {
            var dbApiKeySetting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == SettingKeyAiApiKey, ct);
            if (dbApiKeySetting != null && !string.IsNullOrEmpty(dbApiKeySetting.EncryptedValue))
            {
                try { rawApiKey = Decrypt(dbApiKeySetting.EncryptedValue); } catch { }
            }
        }
        else if (current.Source == "environment")
        {
            rawApiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY")
                        ?? Environment.GetEnvironmentVariable("AI__ApiKey")
                        ?? _config["GEMINI_API_KEY"]
                        ?? _config["AiProvider:ApiKey"]
                        ?? _config["AI:ApiKey"]
                        ?? "";
        }

        return (rawApiKey, current.BaseUrl, current.SelectedModel);
    }

    public async Task<TestAiConnectionResultDto> TestAiConnectionAsync(TestAiConnectionRequestDto? request = null, CancellationToken ct = default)
    {
        string apiKey;
        string baseUrl;
        string model;

        if (request != null && !string.IsNullOrWhiteSpace(request.ApiKey))
        {
            var provider = (request.Provider ?? "gemini").ToLowerInvariant();
            apiKey = request.ApiKey.Trim();
            baseUrl = string.IsNullOrWhiteSpace(request.BaseUrl)
                ? (provider == "openai" ? DefaultOpenAiBaseUrl : DefaultGeminiBaseUrl)
                : request.BaseUrl.Trim();
            model = string.IsNullOrWhiteSpace(request.Model)
                ? (provider == "openai" ? DefaultOpenAiModel : DefaultGeminiModel)
                : request.Model.Trim();
        }
        else
        {
            var effective = await GetEffectiveAiConfigAsync(ct);
            apiKey = effective.ApiKey;
            baseUrl = !string.IsNullOrWhiteSpace(request?.BaseUrl) ? request.BaseUrl.Trim() : effective.BaseUrl;
            model = !string.IsNullOrWhiteSpace(request?.Model) ? request.Model.Trim() : effective.Model;
        }

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return new TestAiConnectionResultDto
            {
                Success = false,
                Message = "Chưa có API Key nào được cấu hình.",
                Error = "API Key is missing."
            };
        }

        var sw = Stopwatch.StartNew();
        try
        {
            var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(15);
            http.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

            var requestBody = new
            {
                model = model,
                messages = new[]
                {
                    new { role = "user", content = "Ping! Respond with only the word OK." }
                },
                max_tokens = 5
            };

            var url = $"{baseUrl.TrimEnd('/')}/chat/completions";
            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await http.PostAsync(url, content, ct);
            sw.Stop();

            var responseBody = await response.Content.ReadAsStringAsync(ct);

            if (response.IsSuccessStatusCode)
            {
                return new TestAiConnectionResultDto
                {
                    Success = true,
                    Message = $"Kết nối thành công! Model '{model}' phản hồi tốt.",
                    ModelUsed = model,
                    LatencyMs = sw.ElapsedMilliseconds
                };
            }
            else
            {
                return new TestAiConnectionResultDto
                {
                    Success = false,
                    Message = $"Lỗi kết nối tới model '{model}' (HTTP {(int)response.StatusCode})",
                    LatencyMs = sw.ElapsedMilliseconds,
                    Error = responseBody.Length > 350 ? responseBody[..350] + "..." : responseBody
                };
            }
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Failed to test AI connection with model {Model} to {BaseUrl}", model, baseUrl);
            return new TestAiConnectionResultDto
            {
                Success = false,
                Message = "Không thể kết nối tới endpoint AI (Kiểm tra lại mạng hoặc Base URL)",
                LatencyMs = sw.ElapsedMilliseconds,
                Error = ex.Message
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Google Drive Settings & Verification
    // ═══════════════════════════════════════════════════════════════════════════

    public async Task<DriveSettingsDto> GetDriveSettingsAsync(CancellationToken ct = default)
    {
        // 1. Check Database SystemSettings
        var dbClientId = await GetSettingAsync(SettingKeyDriveClientId, ct);
        var dbClientSecret = await GetSettingAsync(SettingKeyDriveClientSecret, ct);
        var dbRefreshToken = await GetSettingAsync(SettingKeyDriveRefreshToken, ct);
        var dbRootFolderId = await GetSettingAsync(SettingKeyDriveRootFolderId, ct);

        // Also check UserOAuthTokens table (used by OAuth callback)
        var tokenRecord = await _db.UserOAuthTokens.FirstOrDefaultAsync(t => t.UserId == "default-user", ct);
        if (string.IsNullOrWhiteSpace(dbRefreshToken) && tokenRecord != null && !string.IsNullOrEmpty(tokenRecord.EncryptedRefreshToken))
        {
            try { dbRefreshToken = Decrypt(tokenRecord.EncryptedRefreshToken); } catch { }
        }

        if (!string.IsNullOrWhiteSpace(dbClientId) || !string.IsNullOrWhiteSpace(dbRefreshToken))
        {
            return new DriveSettingsDto
            {
                IsConfigured = !string.IsNullOrWhiteSpace(dbClientId) && !string.IsNullOrWhiteSpace(dbRefreshToken),
                Source = "database",
                ClientId = dbClientId,
                MaskedClientSecret = MaskApiKey(dbClientSecret ?? ""),
                HasClientSecret = !string.IsNullOrWhiteSpace(dbClientSecret),
                MaskedRefreshToken = MaskApiKey(dbRefreshToken ?? ""),
                HasRefreshToken = !string.IsNullOrWhiteSpace(dbRefreshToken),
                RootFolderId = dbRootFolderId ?? _config["GoogleDrive:RootFolderId"] ?? "14MD4svpbhKvo6odQoGxvAgQTRSachRiz",
                LastUpdatedUtc = tokenRecord?.UpdatedAtUtc ?? DateTime.UtcNow
            };
        }

        // 2. Check Environment Variables
        var envClientId = _config["Authentication:Google:ClientId"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");
        var envClientSecret = _config["Authentication:Google:ClientSecret"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET");
        var envRefreshToken = _config["GoogleDrive:RefreshToken"] ?? Environment.GetEnvironmentVariable("GOOGLE_REFRESH_TOKEN");
        var envRootFolderId = _config["GoogleDrive:RootFolderId"] ?? Environment.GetEnvironmentVariable("GOOGLE_DRIVE_ROOT_FOLDER_ID") ?? "14MD4svpbhKvo6odQoGxvAgQTRSachRiz";

        if (!string.IsNullOrWhiteSpace(envClientId))
        {
            return new DriveSettingsDto
            {
                IsConfigured = !string.IsNullOrWhiteSpace(envClientId) && !string.IsNullOrWhiteSpace(envRefreshToken),
                Source = "environment",
                ClientId = envClientId,
                MaskedClientSecret = MaskApiKey(envClientSecret ?? ""),
                HasClientSecret = !string.IsNullOrWhiteSpace(envClientSecret),
                MaskedRefreshToken = MaskApiKey(envRefreshToken ?? ""),
                HasRefreshToken = !string.IsNullOrWhiteSpace(envRefreshToken),
                RootFolderId = envRootFolderId,
                LastUpdatedUtc = null
            };
        }

        return new DriveSettingsDto
        {
            IsConfigured = false,
            Source = "none",
            ClientId = null,
            MaskedClientSecret = null,
            HasClientSecret = false,
            MaskedRefreshToken = null,
            HasRefreshToken = false,
            RootFolderId = "14MD4svpbhKvo6odQoGxvAgQTRSachRiz",
            LastUpdatedUtc = null
        };
    }

    public async Task<DriveSettingsDto> UpdateDriveSettingsAsync(UpdateDriveSettingsRequestDto request, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(request.ClientId))
        {
            await SaveSettingAsync(SettingKeyDriveClientId, request.ClientId.Trim(), "Google Drive OAuth Client ID", ct);
        }

        if (!string.IsNullOrWhiteSpace(request.ClientSecret))
        {
            await SaveSettingAsync(SettingKeyDriveClientSecret, request.ClientSecret.Trim(), "Google Drive OAuth Client Secret (Encrypted)", ct);
        }

        if (!string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            await SaveSettingAsync(SettingKeyDriveRefreshToken, request.RefreshToken.Trim(), "Google Drive OAuth Refresh Token (Encrypted)", ct);

            // Sync with UserOAuthTokens table for DriveSyncService compatibility
            var tokenRecord = await _db.UserOAuthTokens.FirstOrDefaultAsync(t => t.UserId == "default-user", ct);
            var encrypted = Encrypt(request.RefreshToken.Trim());
            if (tokenRecord == null)
            {
                _db.UserOAuthTokens.Add(new UserOAuthToken
                {
                    UserId = "default-user",
                    EncryptedRefreshToken = encrypted,
                    ExpiresAtUtc = DateTime.UtcNow.AddDays(30),
                    UpdatedAtUtc = DateTime.UtcNow
                });
            }
            else
            {
                tokenRecord.EncryptedRefreshToken = encrypted;
                tokenRecord.UpdatedAtUtc = DateTime.UtcNow;
            }
            await _db.SaveChangesAsync(ct);
        }

        if (!string.IsNullOrWhiteSpace(request.RootFolderId))
        {
            await SaveSettingAsync(SettingKeyDriveRootFolderId, request.RootFolderId.Trim(), "Google Drive Root Folder ID", ct);
        }

        return await GetDriveSettingsAsync(ct);
    }

    public async Task<(string ClientId, string ClientSecret, string RefreshToken, string RootFolderId)> GetEffectiveDriveCredentialsAsync(CancellationToken ct = default)
    {
        var settings = await GetDriveSettingsAsync(ct);

        var clientId = (await GetSettingAsync(SettingKeyDriveClientId, ct)) 
                       ?? _config["Authentication:Google:ClientId"] 
                       ?? "";
        var clientSecret = (await GetSettingAsync(SettingKeyDriveClientSecret, ct)) 
                           ?? _config["Authentication:Google:ClientSecret"] 
                           ?? "";
        var refreshToken = (await GetSettingAsync(SettingKeyDriveRefreshToken, ct)) 
                           ?? _config["GoogleDrive:RefreshToken"] 
                           ?? "";
        var rootFolderId = (await GetSettingAsync(SettingKeyDriveRootFolderId, ct)) 
                           ?? _config["GoogleDrive:RootFolderId"] 
                           ?? "14MD4svpbhKvo6odQoGxvAgQTRSachRiz";

        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            var tokenRecord = await _db.UserOAuthTokens.FirstOrDefaultAsync(t => t.UserId == "default-user", ct);
            if (tokenRecord != null && !string.IsNullOrEmpty(tokenRecord.EncryptedRefreshToken))
            {
                try { refreshToken = Decrypt(tokenRecord.EncryptedRefreshToken); } catch { }
            }
        }

        return (clientId, clientSecret, refreshToken, rootFolderId);
    }

    public async Task<VerifyDriveConnectionResultDto> VerifyDriveConnectionAsync(UpdateDriveSettingsRequestDto? request = null, CancellationToken ct = default)
    {
        string clientId;
        string clientSecret;
        string refreshToken;
        string rootFolderId;

        if (request != null && !string.IsNullOrWhiteSpace(request.ClientId) && !string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            clientId = request.ClientId.Trim();
            clientSecret = request.ClientSecret?.Trim() ?? "";
            refreshToken = request.RefreshToken.Trim();
            rootFolderId = !string.IsNullOrWhiteSpace(request.RootFolderId) ? request.RootFolderId.Trim() : "14MD4svpbhKvo6odQoGxvAgQTRSachRiz";
        }
        else
        {
            var creds = await GetEffectiveDriveCredentialsAsync(ct);
            clientId = creds.ClientId;
            clientSecret = creds.ClientSecret;
            refreshToken = creds.RefreshToken;
            rootFolderId = creds.RootFolderId;
        }

        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(refreshToken))
        {
            return new VerifyDriveConnectionResultDto
            {
                Success = false,
                Message = "Chưa có đủ thông tin Client ID hoặc Refresh Token.",
                Error = "Missing Google Drive OAuth credentials."
            };
        }

        var sw = Stopwatch.StartNew();
        try
        {
            // 1. Try to refresh access token
            var accessToken = await _driveService.RefreshAccessTokenAsync(clientId, clientSecret, refreshToken, ct);

            // 2. Try to fetch root folder details or items
            var rootNode = await _driveService.FetchNodeDetailsAsync(accessToken, rootFolderId, "", ct);
            var items = await _driveService.FetchChildNodesAsync(accessToken, rootFolderId, "", ct);
            var itemCount = items?.Count() ?? 0;

            sw.Stop();

            return new VerifyDriveConnectionResultDto
            {
                Success = true,
                Message = "Kết nối Google Drive thành công! Refresh Token và quyền truy cập hợp lệ.",
                RootFolderName = rootNode?.Name ?? "Thư mục gốc",
                TopLevelItemsCount = itemCount,
                LatencyMs = sw.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Failed to verify Google Drive connection for client {ClientId}", clientId);
            return new VerifyDriveConnectionResultDto
            {
                Success = false,
                Message = "Không thể kết nối hoặc làm mới token Google Drive.",
                LatencyMs = sw.ElapsedMilliseconds,
                Error = ex.Message
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Helpers: ASP.NET Data Protection, Fallback Decryption, Masking
    // ═══════════════════════════════════════════════════════════════════════════

    private string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return "";
        try
        {
            return _protector.Protect(plainText);
        }
        catch
        {
            return FallbackAesEncrypt(plainText);
        }
    }

    private string Decrypt(string cipherText)
    {
        if (string.IsNullOrEmpty(cipherText)) return "";
        try
        {
            return _protector.Unprotect(cipherText);
        }
        catch
        {
            // Fallback to legacy AES decryption
            return FallbackAesDecrypt(cipherText);
        }
    }

    private string FallbackAesEncrypt(string plainText)
    {
        byte[] iv = new byte[16];
        RandomNumberGenerator.Fill(iv);

        using var aes = Aes.Create();
        aes.Key = _legacyKey;
        aes.IV = iv;

        using var ms = new MemoryStream();
        ms.Write(iv, 0, iv.Length);

        using (var cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
        using (var sw = new StreamWriter(cs, Encoding.UTF8))
        {
            sw.Write(plainText);
        }

        return Convert.ToBase64String(ms.ToArray());
    }

    private string FallbackAesDecrypt(string cipherTextBase64)
    {
        byte[] fullCipher = Convert.FromBase64String(cipherTextBase64);
        if (fullCipher.Length < 16) return "";

        byte[] iv = new byte[16];
        Array.Copy(fullCipher, 0, iv, 0, 16);

        using var aes = Aes.Create();
        aes.Key = _legacyKey;
        aes.IV = iv;

        using var ms = new MemoryStream(fullCipher, 16, fullCipher.Length - 16);
        using var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Read);
        using var sr = new StreamReader(cs, Encoding.UTF8);

        return sr.ReadToEnd();
    }

    private static List<string> GetModelsForProvider(string provider)
    {
        return provider.ToLowerInvariant() switch
        {
            "openai" => new List<string>(OpenAiModels),
            "custom" => new List<string>(CustomModels),
            _ => new List<string>(GeminiModels)
        };
    }

    private static string MaskApiKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return "";
        if (key.Length <= 8) return "••••••••";
        return $"{key[..6]}••••{key[^4..]}";
    }
}