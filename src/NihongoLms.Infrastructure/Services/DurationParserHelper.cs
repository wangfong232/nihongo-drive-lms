using System.Text.RegularExpressions;

namespace NihongoLms.Infrastructure.Services;

/// <summary>
/// Parser thông minh chuẩn hóa chuỗi thời gian tiếng Việt từ PDF lộ trình → int phút.
/// Hỗ trợ các định dạng thường gặp trong bảng lộ trình N4/N5 của Dũng Mori / Minna no Nihongo.
/// </summary>
public static class DurationParserHelper
{
    // Pattern A: "1h18p26" hoặc "1h18p" — giờ + phút (+ giây bỏ qua)
    // Ví dụ: "1h18p26" → 78, "2h5p10" → 125
    private static readonly Regex PatternHourMinSec = new(
        @"(\d+)\s*[hH]\s*(\d+)\s*[pP](?:\d+)?",
        RegexOptions.Compiled);

    // Pattern B: "1 tiếng 30 phút" hoặc "2 tiếng 5 phút"
    private static readonly Regex PatternTiengPhut = new(
        @"(\d+)\s*tiếng\s*(\d+)\s*phút",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    // Pattern C: "2 tiếng" (chỉ có giờ, không có phút)
    private static readonly Regex PatternTiengOnly = new(
        @"(\d+)\s*tiếng",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    // Pattern D: "1h" hoặc "2H" (chỉ có giờ viết tắt)
    private static readonly Regex PatternHourOnly = new(
        @"^(\d+)\s*[hH]$",
        RegexOptions.Compiled);

    // Pattern E: "4p31+42p" — tổng nhiều phần (cộng lại)
    // Ví dụ: "4p31+42p" → 4+42=46, "10p+30p5" → 10+30=40
    private static readonly Regex PatternPlusSegments = new(
        @"(\d+)\s*[pP](?:\d+)?",
        RegexOptions.Compiled);

    // Pattern F: "50 phút" hoặc "45phút"
    private static readonly Regex PatternPhutOnly = new(
        @"(\d+)\s*phút",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    /// <summary>
    /// Parse chuỗi thời gian → tổng số phút nguyên.
    /// Trả về fallback 45 nếu không nhận dạng được định dạng nào.
    /// </summary>
    public static int Parse(string? input, int fallbackMinutes = 45)
    {
        if (string.IsNullOrWhiteSpace(input))
            return fallbackMinutes;

        var s = input.Trim();

        // Ưu tiên 1: "XhYpZ" — giờ + phút (bỏ giây)
        var m = PatternHourMinSec.Match(s);
        if (m.Success)
        {
            int h = int.Parse(m.Groups[1].Value);
            int p = int.Parse(m.Groups[2].Value);
            return h * 60 + p;
        }

        // Ưu tiên 2: "X tiếng Y phút"
        m = PatternTiengPhut.Match(s);
        if (m.Success)
        {
            int h = int.Parse(m.Groups[1].Value);
            int p = int.Parse(m.Groups[2].Value);
            return h * 60 + p;
        }

        // Ưu tiên 3: "X tiếng" (không có phút)
        m = PatternTiengOnly.Match(s);
        if (m.Success)
            return int.Parse(m.Groups[1].Value) * 60;

        // Ưu tiên 4: "Xh" (giờ viết tắt thuần)
        m = PatternHourOnly.Match(s);
        if (m.Success)
            return int.Parse(m.Groups[1].Value) * 60;

        // Ưu tiên 5: "Xp+Yp" — cộng tổng tất cả phần phút
        // Chỉ áp dụng khi chuỗi chứa dấu '+' hoặc nhiều token [pP]
        if (s.Contains('+') || Regex.IsMatch(s, @"\d+\s*[pP].*\d+\s*[pP]"))
        {
            var segments = PatternPlusSegments.Matches(s);
            if (segments.Count >= 2)
            {
                int total = 0;
                foreach (Match seg in segments)
                    total += int.Parse(seg.Groups[1].Value);
                return total;
            }
        }

        // Ưu tiên 6: "X phút"
        m = PatternPhutOnly.Match(s);
        if (m.Success)
            return int.Parse(m.Groups[1].Value);

        // Fallback: thử parse số nguyên thuần
        if (int.TryParse(s, out int raw))
            return raw;

        return fallbackMinutes;
    }

    /// <summary>
    /// Kiểm thử nhanh tất cả định dạng — dùng trong startup log hoặc unit test.
    /// </summary>
    public static IEnumerable<(string Input, int Expected, int Actual, bool Pass)> RunSelfTest()
    {
        var cases = new (string input, int expected)[]
        {
            ("50 phút",        50),
            ("1 tiếng 30 phút", 90),
            ("2 tiếng",        120),
            ("1h18p26",        78),
            ("4p31+42p",       46),
            ("1h",             60),
            ("2H5p10",         125),
            ("",               45),  // fallback
        };

        foreach (var (input, expected) in cases)
        {
            int actual = Parse(input);
            yield return (input, expected, actual, actual == expected);
        }
    }
}
