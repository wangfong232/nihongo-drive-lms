using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Interfaces;
using NihongoLms.Infrastructure.Data;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly LmsDbContext _dbContext;
    private readonly ITokenEncryptionService _encryptionService;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public AuthController(
        LmsDbContext dbContext,
        ITokenEncryptionService encryptionService,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory)
    {
        _dbContext = dbContext;
        _encryptionService = encryptionService;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet("google/login")]
    public IActionResult GoogleLogin()
    {
        string clientId = _configuration["Authentication:Google:ClientId"] ?? throw new InvalidOperationException("Google ClientId missing");
        string redirectUri = _configuration["Authentication:Google:RedirectUri"] ?? $"{Request.Scheme}://{Request.Host}/api/auth/google/callback";
        string scope = Uri.EscapeDataString("https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email");

        string googleAuthUrl = $"https://accounts.google.com/o/oauth2/v2/auth?" +
                               $"client_id={clientId}&" +
                               $"redirect_uri={Uri.EscapeDataString(redirectUri)}&" +
                               $"response_type=code&" +
                               $"scope={scope}&" +
                               $"access_type=offline&" +
                               $"prompt=consent";

        return Redirect(googleAuthUrl);
    }

    [HttpGet("google/callback")]
    public async Task<IActionResult> GoogleCallback([FromQuery] string code, [FromQuery] string? error, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(error))
        {
            return BadRequest(new { error = $"Google authentication error: {error}" });
        }

        if (string.IsNullOrEmpty(code))
        {
            return BadRequest(new { error = "Authorization code missing." });
        }

        string clientId = _configuration["Authentication:Google:ClientId"] ?? throw new InvalidOperationException("Google ClientId missing");
        string clientSecret = _configuration["Authentication:Google:ClientSecret"] ?? throw new InvalidOperationException("Google ClientSecret missing");
        string redirectUri = _configuration["Authentication:Google:RedirectUri"] ?? $"{Request.Scheme}://{Request.Host}/api/auth/google/callback";

        var client = _httpClientFactory.CreateClient();
        var tokenRequestContent = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("code", code),
            new KeyValuePair<string, string>("client_id", clientId),
            new KeyValuePair<string, string>("client_secret", clientSecret),
            new KeyValuePair<string, string>("redirect_uri", redirectUri),
            new KeyValuePair<string, string>("grant_type", "authorization_code")
        });

        var response = await client.PostAsync("https://oauth2.googleapis.com/token", tokenRequestContent, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            string errBody = await response.Content.ReadAsStringAsync(cancellationToken);
            return StatusCode((int)response.StatusCode, new { error = "Failed to exchange authorization code for tokens.", details = errBody });
        }

        var tokenData = await response.Content.ReadFromJsonAsync<GoogleAuthTokenResponse>(cancellationToken: cancellationToken);
        if (tokenData == null || string.IsNullOrEmpty(tokenData.AccessToken))
        {
            return BadRequest(new { error = "Invalid token response from Google." });
        }

        // Store encrypted token in DB
        var tokenRecord = await _dbContext.UserOAuthTokens.FirstOrDefaultAsync(t => t.UserId == "default-user", cancellationToken);
        if (tokenRecord == null)
        {
            tokenRecord = new UserOAuthToken { UserId = "default-user" };
            _dbContext.UserOAuthTokens.Add(tokenRecord);
        }

        tokenRecord.EncryptedAccessToken = _encryptionService.Encrypt(tokenData.AccessToken);
        if (!string.IsNullOrEmpty(tokenData.RefreshToken))
        {
            tokenRecord.EncryptedRefreshToken = _encryptionService.Encrypt(tokenData.RefreshToken);
        }
        tokenRecord.TokenType = tokenData.TokenType ?? "Bearer";
        tokenRecord.ExpiresAtUtc = DateTime.UtcNow.AddSeconds(tokenData.ExpiresIn);
        tokenRecord.Scope = tokenData.Scope ?? string.Empty;
        tokenRecord.UpdatedAtUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        string frontendRedirect = _configuration["FrontendUrl"] ?? "http://localhost:3000/admin/settings?auth=success";
        return Redirect(frontendRedirect);
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetAuthStatus(CancellationToken cancellationToken)
    {
        var tokenRecord = await _dbContext.UserOAuthTokens.FirstOrDefaultAsync(t => t.UserId == "default-user", cancellationToken);
        bool isAuthenticated = tokenRecord != null && !string.IsNullOrEmpty(tokenRecord.EncryptedRefreshToken);

        return Ok(new
        {
            isAuthenticated,
            expiresAtUtc = tokenRecord?.ExpiresAtUtc,
            updatedAtUtc = tokenRecord?.UpdatedAtUtc,
            scope = tokenRecord?.Scope
        });
    }

    private class GoogleAuthTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string AccessToken { get; set; } = string.Empty;

        [JsonPropertyName("refresh_token")]
        public string? RefreshToken { get; set; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }

        [JsonPropertyName("token_type")]
        public string TokenType { get; set; } = string.Empty;

        [JsonPropertyName("scope")]
        public string Scope { get; set; } = string.Empty;
    }
}
