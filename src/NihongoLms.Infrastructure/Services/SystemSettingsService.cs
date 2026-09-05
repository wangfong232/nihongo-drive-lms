using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;
using NihongoLms.Domain.Entities;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Infrastructure.Services;

public class SystemSettingsService : ISystemSettingsService
{
    private const string SettingKeyAiProvider = "AiProvider:Provider";
    private const string SettingKeyAiApiKey   = "AiProvider:ApiKey";
    private const string SettingKeyAiBaseUrl  = "AiProvider:BaseUrl";
    private const string SettingKeyAiModel    = "AiProvider:Model";

    private const string DefaultGeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
    private const string DefaultGeminiModel   = "gemini-1.5-flash";

    private const string DefaultOpenAiBaseUrl = "https://api.openai.com/v1";
    private const string DefaultOpenAiModel   = "gpt-4o-mini";

    private readonly LmsDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<SystemSettingsService> _logger;
    private readonly byte[] _encryptionKey;

    public SystemSettingsService(
        LmsDbContext db,
        IConfiguration config,
        IHttpClientFactory httpFactory,
        ILogger<SystemSettingsService> logger)
    {
        _db = db;
        _config = config;
        _httpFactory = httpFactory;
        _logger = logger;

        // Derive 256-bit AES encryption key from secret/config
        var secret = _config["Jwt:SecretKey"] 
                     ?? _config["System:EncryptionKey"] 
                     ?? "NihongoLms-Default-Local-Database-Encryption-Key-2026";
        using var sha = SHA256.Create();
        _encryptionKey = sha.ComputeHash(Encoding.UTF8.GetBytes(secret));
    }

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
                _logger.LogWarning(ex, "Failed to decrypt setting '{Key}', falling back to raw or config", key);
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

    public async Task<AiSettingsDto> GetAiSettingsAsync(CancellationToken ct = default)
    {
        // 1. Check Database first
        var dbApiKeySetting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == SettingKeyAiApiKey, ct);
        if (dbApiKeySetting != null && !string.IsNullOrEmpty(dbApiKeySetting.EncryptedValue))
        {
            string plainKey = "";
            try { plainKey = Decrypt(dbApiKeySetting.EncryptedValue); } catch { }

            var provider = (await GetSettingAsync(SettingKeyAiProvider, ct)) ?? "gemini";
            var baseUrl  = (await GetSettingAsync(SettingKeyAiBaseUrl, ct)) 
                           ?? (provider == "openai" ? DefaultOpenAiBaseUrl : DefaultGeminiBaseUrl);
            var model    = (await GetSettingAsync(SettingKeyAiModel, ct)) 
                           ?? (provider == "openai" ? DefaultOpenAiModel : DefaultGeminiModel);

            return new AiSettingsDto
            {
                IsConfigured = !string.IsNullOrWhiteSpace(plainKey),
                Source = "database",
                Provider = provider,
                MaskedApiKey = MaskApiKey(plainKey),
                BaseUrl = baseUrl,
                Model = model,
                LastUpdatedUtc = dbApiKeySetting.UpdatedAtUtc
            };
        }

        // 2. Check Environment variables / appsettings.json fallback
        var envApiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY")
                        ?? Environment.GetEnvironmentVariable("AI__ApiKey")
                        ?? _config["GEMINI_API_KEY"]
                        ?? _config["AiProvider:ApiKey"]
                        ?? _config["AI:ApiKey"]
                        ?? "";

        if (!string.IsNullOrWhiteSpace(envApiKey))
        {
            var envProvider = _config["AiProvider:Provider"] ?? "gemini";
            var envBaseUrl  = _config["AiProvider:BaseUrl"] ?? (envProvider == "openai" ? DefaultOpenAiBaseUrl : DefaultGeminiBaseUrl);
            var envModel    = _config["AiProvider:Model"] ?? (envProvider == "openai" ? DefaultOpenAiModel : DefaultGeminiModel);

            return new AiSettingsDto
            {
                IsConfigured = true,
                Source = "environment",
                Provider = envProvider,
                MaskedApiKey = MaskApiKey(envApiKey),
                BaseUrl = envBaseUrl,
                Model = envModel,
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
            BaseUrl = DefaultGeminiBaseUrl,
            Model = DefaultGeminiModel,
            LastUpdatedUtc = null
        };
    }

    public async Task<AiSettingsDto> SaveAiSettingsAsync(SaveAiSettingsRequestDto request, CancellationToken ct = default)
    {
        var provider = string.IsNullOrWhiteSpace(request.Provider) ? "gemini" : request.Provider.Trim().ToLowerInvariant();
        var baseUrl = string.IsNullOrWhiteSpace(request.BaseUrl)
            ? (provider == "openai" ? DefaultOpenAiBaseUrl : DefaultGeminiBaseUrl)
            : request.BaseUrl.Trim();
        var model = string.IsNullOrWhiteSpace(request.Model)
            ? (provider == "openai" ? DefaultOpenAiModel : DefaultGeminiModel)
            : request.Model.Trim();

        if (!string.IsNullOrWhiteSpace(request.ApiKey))
        {
            await SaveSettingAsync(SettingKeyAiApiKey, request.ApiKey.Trim(), "AI Provider API Key (Encrypted)", ct);
        }

        await SaveSettingAsync(SettingKeyAiProvider, provider, "AI Provider Type", ct);
        await SaveSettingAsync(SettingKeyAiBaseUrl, baseUrl, "AI Provider Endpoint BaseUrl", ct);
        await SaveSettingAsync(SettingKeyAiModel, model, "AI Model Name", ct);

        return await GetAiSettingsAsync(ct);
    }

    public async Task<AiSettingsDto> DeleteAiSettingsAsync(CancellationToken ct = default)
    {
        await DeleteSettingAsync(SettingKeyAiApiKey, ct);
        await DeleteSettingAsync(SettingKeyAiProvider, ct);
        await DeleteSettingAsync(SettingKeyAiBaseUrl, ct);
        await DeleteSettingAsync(SettingKeyAiModel, ct);

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

        return (rawApiKey, current.BaseUrl, current.Model);
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
            baseUrl = effective.BaseUrl;
            model = effective.Model;
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
                    Message = "Kết nối thành công! API Key hoạt động bình thường.",
                    ModelUsed = model,
                    LatencyMs = sw.ElapsedMilliseconds
                };
            }
            else
            {
                return new TestAiConnectionResultDto
                {
                    Success = false,
                    Message = $"Lỗi kết nối từ nhà cung cấp (HTTP {(int)response.StatusCode})",
                    LatencyMs = sw.ElapsedMilliseconds,
                    Error = responseBody.Length > 300 ? responseBody[..300] + "..." : responseBody
                };
            }
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Failed to test AI connection to {BaseUrl}", baseUrl);
            return new TestAiConnectionResultDto
            {
                Success = false,
                Message = "Không thể kết nối tới endpoint AI (Kiểm tra lại mạng hoặc Base URL)",
                LatencyMs = sw.ElapsedMilliseconds,
                Error = ex.Message
            };
        }
    }

    // ─── Helpers: Encryption & Masking ───

    private string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return "";

        byte[] iv = new byte[16];
        RandomNumberGenerator.Fill(iv);

        using var aes = Aes.Create();
        aes.Key = _encryptionKey;
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

    private string Decrypt(string cipherTextBase64)
    {
        if (string.IsNullOrEmpty(cipherTextBase64)) return "";

        byte[] fullCipher = Convert.FromBase64String(cipherTextBase64);
        if (fullCipher.Length < 16) return "";

        byte[] iv = new byte[16];
        Array.Copy(fullCipher, 0, iv, 0, 16);

        using var aes = Aes.Create();
        aes.Key = _encryptionKey;
        aes.IV = iv;

        using var ms = new MemoryStream(fullCipher, 16, fullCipher.Length - 16);
        using var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Read);
        using var sr = new StreamReader(cs, Encoding.UTF8);

        return sr.ReadToEnd();
    }

    private static string MaskApiKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return "";
        if (key.Length <= 8) return "********";
        return $"{key[..6]}...{key[^4..]}";
    }
}