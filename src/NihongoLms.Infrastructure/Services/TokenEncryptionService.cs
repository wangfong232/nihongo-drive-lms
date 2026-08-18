using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using NihongoLms.Domain.Interfaces;

namespace NihongoLms.Infrastructure.Services;

public class TokenEncryptionService : ITokenEncryptionService
{
    private readonly byte[] _key;

    public TokenEncryptionService(IConfiguration configuration)
    {
        var secret = configuration["Security:EncryptionKey"] ?? "NihongoLms_Default_Secret_Key_32Byte!";
        using var sha256 = SHA256.Create();
        _key = sha256.ComputeHash(Encoding.UTF8.GetBytes(secret));
    }

    public string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return plainText;

        byte[] nonce = new byte[12]; // 96 bits standard for AES-GCM
        RandomNumberGenerator.Fill(nonce);

        byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
        byte[] cipherBytes = new byte[plainBytes.Length];
        byte[] tag = new byte[16]; // 128 bits tag

        using var aesGcm = new AesGcm(_key, 16);
        aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);

        // Combine nonce + tag + ciphertext into a single byte array
        byte[] resultBytes = new byte[nonce.Length + tag.Length + cipherBytes.Length];
        Buffer.BlockCopy(nonce, 0, resultBytes, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, resultBytes, nonce.Length, tag.Length);
        Buffer.BlockCopy(cipherBytes, 0, resultBytes, nonce.Length + tag.Length, cipherBytes.Length);

        return Convert.ToBase64String(resultBytes);
    }

    public string Decrypt(string cipherText)
    {
        if (string.IsNullOrEmpty(cipherText)) return cipherText;

        byte[] rawBytes = Convert.FromBase64String(cipherText);
        if (rawBytes.Length < 12 + 16)
        {
            throw new ArgumentException("Invalid ciphertext length.", nameof(cipherText));
        }

        byte[] nonce = rawBytes[..12];
        byte[] tag = rawBytes[12..28];
        byte[] cipherBytes = rawBytes[28..];
        byte[] plainBytes = new byte[cipherBytes.Length];

        using var aesGcm = new AesGcm(_key, 16);
        aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);

        return Encoding.UTF8.GetString(plainBytes);
    }
}
