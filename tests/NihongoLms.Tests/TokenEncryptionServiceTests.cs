using FluentAssertions;
using Microsoft.Extensions.Configuration;
using NihongoLms.Infrastructure.Services;
using Xunit;

namespace NihongoLms.Tests;

public class TokenEncryptionServiceTests
{
    private readonly TokenEncryptionService _encryptionService;

    public TokenEncryptionServiceTests()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            { "Security:EncryptionKey", "TestSecretKey_For_UnitTesting_32BytesLong!" }
        };

        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        _encryptionService = new TokenEncryptionService(config);
    }

    [Theory]
    [InlineData("sample_oauth_refresh_token_1234567890")]
    [InlineData("1//09aBcDeFgHiJkLmNoPqRsTuVwXyZ")]
    [InlineData("short_secret")]
    public void Encrypt_And_Decrypt_Should_Return_Original_Text(string plainText)
    {
        // Act
        string encrypted = _encryptionService.Encrypt(plainText);
        string decrypted = _encryptionService.Decrypt(encrypted);

        // Assert
        encrypted.Should().NotBeNullOrEmpty();
        encrypted.Should().NotBe(plainText);
        decrypted.Should().Be(plainText);
    }

    [Fact]
    public void Decrypt_Invalid_Base64_Should_Throw()
    {
        // Act
        Action act = () => _encryptionService.Decrypt("InvalidBase64!!!");

        // Assert
        act.Should().Throw<FormatException>();
    }
}
