using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using NihongoLms.Domain.Entities;
using NihongoLms.Domain.Enums;
using NihongoLms.Domain.Interfaces;

namespace NihongoLms.Infrastructure.Services;

public class GoogleDriveService : IGoogleDriveService
{
    private readonly IHttpClientFactory _httpClientFactory;

    public GoogleDriveService(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<IEnumerable<DriveNode>> FetchChildNodesAsync(string accessToken, string parentFolderId, string rawPathPrefix, CancellationToken cancellationToken = default)
    {
        var driveService = CreateDriveService(accessToken);
        var nodes = new List<DriveNode>();

        string? pageToken = null;
        do
        {
            var request = driveService.Files.List();
            request.Q = $"'{parentFolderId}' in parents and trashed = false";
            request.Fields = "nextPageToken, files(id, name, mimeType, size, webViewLink, thumbnailLink, createdTime, shortcutDetails, modifiedTime)";
            request.PageToken = pageToken;
            request.PageSize = 1000;

            var response = await request.ExecuteAsync(cancellationToken);
            if (response.Files != null)
            {
                foreach (var file in response.Files)
                {
                    bool isFolder = file.MimeType == "application/vnd.google-apps.folder";
                    string path = string.IsNullOrEmpty(rawPathPrefix)
                        ? $"/{file.Name}"
                        : $"{rawPathPrefix}/{file.Name}";

                    string? extension = isFolder ? null : Path.GetExtension(file.Name)?.ToLowerInvariant();

                    var node = new DriveNode
                    {
                        DriveFileId = file.Id,
                        ParentDriveFileId = parentFolderId,
                        Name = file.Name,
                        NodeType = isFolder ? NodeType.Folder : NodeType.File,
                        MimeType = file.MimeType,
                        FileExtension = extension,
                        Size = file.Size,
                        WebViewLink = file.WebViewLink,
                        ThumbnailLink = file.ThumbnailLink,
                        RawPath = path,
                        DriveCreatedTime = file.CreatedTimeDateTimeOffset,
                        DriveModifiedTime = file.ModifiedTimeDateTimeOffset,
                        LastSyncedAtUtc = DateTime.UtcNow,
                        IsDeletedInDrive = false
                    };

                    nodes.Add(node);
                }
            }

            pageToken = response.NextPageToken;
        } while (!string.IsNullOrEmpty(pageToken));

        return nodes;
    }

    public async Task<DriveNode?> FetchNodeDetailsAsync(string accessToken, string driveFileId, string rawPath, CancellationToken cancellationToken = default)
    {
        var driveService = CreateDriveService(accessToken);
        var request = driveService.Files.Get(driveFileId);
        request.Fields = "id, name, mimeType, size, webViewLink, thumbnailLink, createdTime, modifiedTime, parents";

        var file = await request.ExecuteAsync(cancellationToken);
        if (file == null) return null;

        bool isFolder = file.MimeType == "application/vnd.google-apps.folder";
        string? extension = isFolder ? null : Path.GetExtension(file.Name)?.ToLowerInvariant();
        string? parentId = file.Parents != null && file.Parents.Count > 0 ? file.Parents[0] : null;

        return new DriveNode
        {
            DriveFileId = file.Id,
            ParentDriveFileId = parentId,
            Name = file.Name,
            NodeType = isFolder ? NodeType.Folder : NodeType.File,
            MimeType = file.MimeType,
            FileExtension = extension,
            Size = file.Size,
            WebViewLink = file.WebViewLink,
            ThumbnailLink = file.ThumbnailLink,
            RawPath = rawPath,
            DriveCreatedTime = file.CreatedTimeDateTimeOffset,
            DriveModifiedTime = file.ModifiedTimeDateTimeOffset,
            LastSyncedAtUtc = DateTime.UtcNow,
            IsDeletedInDrive = false
        };
    }

    public async Task<string> RefreshAccessTokenAsync(string clientId, string clientSecret, string refreshToken, CancellationToken cancellationToken = default)
    {
        var client = _httpClientFactory.CreateClient();
        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("client_id", clientId),
            new KeyValuePair<string, string>("client_secret", clientSecret),
            new KeyValuePair<string, string>("refresh_token", refreshToken),
            new KeyValuePair<string, string>("grant_type", "refresh_token")
        });

        var response = await client.PostAsync("https://oauth2.googleapis.com/token", content, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            string errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"Google Token Refresh failed ({response.StatusCode}): {errorBody}");
        }

        var tokenResponse = await response.Content.ReadFromJsonAsync<GoogleTokenResponse>(cancellationToken: cancellationToken);
        return tokenResponse?.AccessToken ?? throw new InvalidOperationException("Failed to obtain access token from Google.");
    }

    private static DriveService CreateDriveService(string accessToken)
    {
        var credential = GoogleCredential.FromAccessToken(accessToken);
        return new DriveService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "NihongoLms"
        });
    }

    private class GoogleTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string AccessToken { get; set; } = string.Empty;

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }

        [JsonPropertyName("token_type")]
        public string TokenType { get; set; } = string.Empty;

        [JsonPropertyName("scope")]
        public string Scope { get; set; } = string.Empty;
    }
}
