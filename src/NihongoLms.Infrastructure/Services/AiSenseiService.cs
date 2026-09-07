using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Infrastructure.Services;

public class AiSenseiService : IAiSenseiService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ISystemSettingsService _settingsService;
    private readonly ILogger<AiSenseiService> _logger;

    private const string SenseiSystemPrompt = """
        Bạn là "AI Sensei" — một giáo viên dạy tiếng Nhật ảo vô cùng thân thiện, tận tâm, giải thích sâu sắc và dễ hiểu, chuyên hỗ trợ học viên toàn diện trong TẤT CẢ các kỹ năng tiếng Nhật (Từ vựng Goi, Ngữ pháp Bunpou, Chữ Hán Kanji, Đọc hiểu Dokkai, Nghe hiểu Choukai, Luyện thi JLPT N5-N1 và Đàm thoại giao tiếp thực tế).

        NGUYÊN TẮC GIẢI THÍCH:
        1. Giọng văn: Thân thiện, nhiệt tình, xưng "Sensei" và gọi học viên là "bạn" / "Kenji-san". Luôn khích lệ tinh thần học viên ("Ganbatte ne! 🎌").
        2. Trình bày: Định dạng Markdown đẹp mắt, ngắt đoạn rõ ràng, dùng bullet points, in đậm từ khóa quan trọng và emoji sinh động. Trả lời trực tiếp bằng văn bản tự nhiên, tuyệt đối KHÔNG trả về code JSON thô hay các trường kỹ thuật.
        3. Hỗ trợ toàn diện: Không giới hạn chỉ riêng Kanji! Sẵn sàng giải thích ngữ pháp, từ vựng, mẹo làm bài thi, sửa câu, dịch thuật đa ngôn ngữ (Đức, Anh, v.v. sang Nhật).
        4. Chữ Hán (Kanji): Phân tích cấu tạo bộ thủ, câu chuyện liên tưởng/mẹo nhớ sinh động, âm Hán Việt, cách đọc On/Kun.
        5. Ngữ pháp & Mẫu câu: Nêu rõ cấu trúc, ý nghĩa cốt lõi, hoàn cảnh dùng, ví dụ câu ngắn gọn có Kanji + Furigana/Hiragana + nghĩa tiếng Việt.
        6. Đề xuất: Ở cuối bài giải thích, hãy luôn gợi ý 2-3 câu hỏi tiếp theo theo định dạng:
        [GỢI Ý]: Câu hỏi 1 | Câu hỏi 2 | Câu hỏi 3
        """;

    public AiSenseiService(
        IHttpClientFactory httpFactory,
        ISystemSettingsService settingsService,
        ILogger<AiSenseiService> logger)
    {
        _httpFactory = httpFactory;
        _settingsService = settingsService;
        _logger = logger;
    }

    public async Task<SenseiChatResponseDto> AskSenseiAsync(SenseiChatRequestDto request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return new SenseiChatResponseDto
            {
                Reply = "Kon'nichiwa! Hãy đặt câu hỏi về ngữ pháp, chữ Hán, từ vựng hoặc bài học hiện tại để Sensei giải đáp giúp bạn nhé! 🎌",
                SuggestedQuestions = new List<string>
                {
                    "Tại sao 3 chữ 木 thành 森?",
                    "Cách nhớ nhanh 50 bộ thủ đầu",
                    "Phân biệt trợ từ は và が"
                }
            };
        }

        try
        {
            var (apiKey, baseUrl, model) = await _settingsService.GetEffectiveAiConfigAsync(ct);

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return GenerateSmartFallback(request);
            }

            var messages = new List<object>
            {
                new { role = "system", content = SenseiSystemPrompt }
            };

            // Inject context about current lesson/course
            var contextBuilder = new StringBuilder();
            if (!string.IsNullOrWhiteSpace(request.CourseTitle)) contextBuilder.AppendLine($"Khóa học: {request.CourseTitle}");
            if (!string.IsNullOrWhiteSpace(request.JlptLevel)) contextBuilder.AppendLine($"Trình độ: {request.JlptLevel}");
            if (!string.IsNullOrWhiteSpace(request.SectionTitle)) contextBuilder.AppendLine($"Chương/Chặng: {request.SectionTitle}");
            if (!string.IsNullOrWhiteSpace(request.LessonTitle)) contextBuilder.AppendLine($"Bài học đang xem: {request.LessonTitle}");

            if (contextBuilder.Length > 0)
            {
                messages.Add(new
                {
                    role = "system",
                    content = $"[BỐI CẢNH BÀI HỌC HIỆN TẠI]:\n{contextBuilder.ToString().Trim()}"
                });
            }

            // Append chat history (up to last 6 messages)
            if (request.History != null && request.History.Count > 0)
            {
                var recentHistory = request.History.Count > 6 
                    ? request.History.GetRange(request.History.Count - 6, 6) 
                    : request.History;

                foreach (var msg in recentHistory)
                {
                    messages.Add(new { role = msg.Role == "assistant" ? "assistant" : "user", content = msg.Content });
                }
            }

            // Append current user message
            messages.Add(new { role = "user", content = request.Message });

            var chosenModel = string.IsNullOrWhiteSpace(model) ? "gemini-2.0-flash" : model;

            var requestBody = new
            {
                model = chosenModel,
                messages = messages,
                temperature = 0.6
            };

            var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(30);
            http.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

            var effectiveBaseUrl = string.IsNullOrWhiteSpace(baseUrl)
                ? "https://generativelanguage.googleapis.com/v1beta/openai/"
                : baseUrl;

            var endpointUrl = $"{effectiveBaseUrl.TrimEnd('/')}/chat/completions";
            var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            var response = await http.PostAsync(endpointUrl, jsonContent, ct);
            var responseText = await response.Content.ReadAsStringAsync(ct);

            // If failed, retry with standard gemini-2.0-flash
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[AiSensei] Primary LLM call failed ({Status}): {Body}. Retrying with standard model...", response.StatusCode, responseText);
                
                var retryBody = new
                {
                    model = "gemini-2.0-flash",
                    messages = messages,
                    temperature = 0.6
                };
                var retryContent = new StringContent(JsonSerializer.Serialize(retryBody), Encoding.UTF8, "application/json");
                response = await http.PostAsync(endpointUrl, retryContent, ct);
                responseText = await response.Content.ReadAsStringAsync(ct);
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[AiSensei] LLM retry call also failed ({Status}): {Body}. Using smart fallback.", response.StatusCode, responseText);
                return GenerateSmartFallback(request);
            }

            using var doc = JsonDocument.Parse(responseText);
            var choices = doc.RootElement.GetProperty("choices");
            if (choices.GetArrayLength() == 0) return GenerateSmartFallback(request);

            var messageContent = choices[0].GetProperty("message").GetProperty("content").GetString() ?? "";
            return ParseLlmContent(messageContent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AiSensei] Error processing Sensei chat request");
            return GenerateSmartFallback(request);
        }
    }

    private static SenseiChatResponseDto ParseLlmContent(string messageContent)
    {
        if (string.IsNullOrWhiteSpace(messageContent))
        {
            return new SenseiChatResponseDto
            {
                Reply = "Sensei luôn sẵn sàng đồng hành cùng bạn! Bạn cần hỏi thêm về phần nào nè? 🎌",
                SuggestedQuestions = new List<string> { "Giải thích chi tiết hơn", "Cho thêm ví dụ câu" }
            };
        }

        var text = messageContent.Trim();

        // 1. If LLM returned a JSON structure, convert it into clean human-readable Markdown
        if (text.StartsWith("{") || text.StartsWith("```json") || text.StartsWith("```"))
        {
            var cleanJson = text;
            if (cleanJson.StartsWith("```json", StringComparison.OrdinalIgnoreCase)) cleanJson = cleanJson.Substring(7);
            else if (cleanJson.StartsWith("```")) cleanJson = cleanJson.Substring(3);
            if (cleanJson.EndsWith("```")) cleanJson = cleanJson.Substring(0, cleanJson.Length - 3);
            cleanJson = cleanJson.Trim();

            try
            {
                using var replyDoc = JsonDocument.Parse(cleanJson);
                var root = replyDoc.RootElement;
                if (root.ValueKind == JsonValueKind.Object)
                {
                    string? reply = null;
                    var suggested = new List<string>();

                    if (root.TryGetProperty("reply", out var rEl) && rEl.ValueKind == JsonValueKind.String)
                    {
                        reply = rEl.GetString();
                    }

                    // Extract suggestions
                    var suggestKeys = new[] { "suggestedQuestions", "suggested_questions", "available_support", "suggestions", "questions" };
                    foreach (var key in suggestKeys)
                    {
                        if (root.TryGetProperty(key, out var arrEl) && arrEl.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in arrEl.EnumerateArray())
                            {
                                var s = item.GetString();
                                if (!string.IsNullOrWhiteSpace(s) && !suggested.Contains(s)) suggested.Add(s);
                            }
                        }
                    }

                    // If no explicit "reply", recursively build human markdown from JSON elements
                    if (string.IsNullOrWhiteSpace(reply))
                    {
                        var sb = new StringBuilder();
                        BuildMarkdownFromJson(root, sb, 0);
                        reply = sb.ToString().Trim();
                    }

                    if (!string.IsNullOrWhiteSpace(reply))
                    {
                        if (suggested.Count == 0)
                        {
                            suggested.Add("Ví dụ thêm về phần này");
                            suggested.Add("Bài tập ứng dụng thực tế");
                        }

                        return new SenseiChatResponseDto
                        {
                            Reply = reply,
                            SuggestedQuestions = suggested
                        };
                    }
                }
            }
            catch
            {
                // Fall through to plain text parsing
            }
        }

        // 2. Parse natural markdown and check for [GỢI Ý]: ... line at the end
        var lines = text.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
        var replyLines = new List<string>();
        var suggestedQuestions = new List<string>();

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith("[GỢI Ý]:", StringComparison.OrdinalIgnoreCase) || 
                trimmed.StartsWith("[Gợi ý]:", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("Gợi ý câu hỏi:", StringComparison.OrdinalIgnoreCase))
            {
                var promptContent = trimmed.Substring(trimmed.IndexOf(':') + 1).Trim();
                var parts = promptContent.Split(new[] { '|', ';' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var p in parts)
                {
                    var q = p.Trim().TrimStart('-', '*', '1', '2', '3', '.', ' ');
                    if (!string.IsNullOrWhiteSpace(q) && !suggestedQuestions.Contains(q))
                    {
                        suggestedQuestions.Add(q);
                    }
                }
            }
            else
            {
                replyLines.Add(line);
            }
        }

        if (suggestedQuestions.Count == 0)
        {
            suggestedQuestions.Add("Giải thích chi tiết hơn");
            suggestedQuestions.Add("Cho thêm ví dụ câu");
        }

        return new SenseiChatResponseDto
        {
            Reply = string.Join("\n", replyLines).Trim(),
            SuggestedQuestions = suggestedQuestions
        };
    }

    private static void BuildMarkdownFromJson(JsonElement element, StringBuilder sb, int depth)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in element.EnumerateObject())
            {
                var name = prop.Name;
                if (name is "status" or "course" or "chapter" or "lesson" or "level" or "course_info")
                    continue;

                if (prop.Value.ValueKind == JsonValueKind.String)
                {
                    var val = prop.Value.GetString();
                    if (!string.IsNullOrWhiteSpace(val))
                    {
                        if (name is "reply" or "message" or "explanation" or "answer" or "text" or "note")
                        {
                            sb.AppendLine(val);
                            sb.AppendLine();
                        }
                        else
                        {
                            sb.AppendLine($"- **{name}**: {val}");
                        }
                    }
                }
                else if (prop.Value.ValueKind == JsonValueKind.Object)
                {
                    BuildMarkdownFromJson(prop.Value, sb, depth + 1);
                }
                else if (prop.Value.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in prop.Value.EnumerateArray())
                    {
                        if (item.ValueKind == JsonValueKind.String)
                        {
                            var s = item.GetString();
                            if (!string.IsNullOrWhiteSpace(s)) sb.AppendLine($"- {s}");
                        }
                    }
                    sb.AppendLine();
                }
            }
        }
        else if (element.ValueKind == JsonValueKind.String)
        {
            sb.AppendLine(element.GetString());
        }
    }

    private static SenseiChatResponseDto GenerateSmartFallback(SenseiChatRequestDto request)
    {
        var query = (request.Message ?? "").ToLowerInvariant().Trim();

        // 1. Greetings (hello, hi, chào, konnichiwa,...)
        if (query is "hello" or "hi" or "chào" or "xin chào" or "chào bạn" or "chào cô" or "chào thầy" or "konnichiwa" or "ohayou" or "kombanwa")
        {
            var targetLesson = string.IsNullOrWhiteSpace(request.LessonTitle) ? "khóa học" : $"bài '{request.LessonTitle}'";
            return new SenseiChatResponseDto
            {
                Reply = $"""
                Kon'nichiwa Kenji-san! 🎌 Sensei rất vui được học cùng bạn hôm nay!

                Sensei có thể giúp bạn:
                - 📚 **Giải thích ngữ pháp & trợ từ**: Phân tích các cấu trúc khó, cách dùng tự nhiên.
                - 🈸 **Mẹo nhớ chữ Hán (Kanji)**: Chiết tự theo bộ thủ, liên tưởng hình ảnh sinh động.
                - 🗣️ **Ví dụ đàm thoại thực tế**: Ứng dụng ngay vào giao tiếp đời sống và luyện thi JLPT.

                Bạn đang muốn tìm hiểu kỹ hơn về phần nào trong {targetLesson}? Hãy hỏi Sensei ngay nhé! ✨
                """,
                SuggestedQuestions = new List<string>
                {
                    "💡 Tại sao 3 chữ 木 thành 森?",
                    "⚡ Cách nhớ nhanh 50 bộ thủ đầu",
                    "📝 Ngữ pháp trọng tâm bài này là gì?"
                }
            };
        }

        // 2. Sensei spelling / meaning (sensei viết như thế nào, chữ sensei, nghĩa của sensei,...)
        if (query.Contains("sensei") || query.Contains("せんせい") || query.Contains("先生") || query.Contains("viết như thế nào") || query.Contains("cách viết") || query.Contains("tiên sinh"))
        {
            return new SenseiChatResponseDto
            {
                Reply = """
                🧑‍🏫 **Từ "Sensei" trong tiếng Nhật được viết như sau:**

                - **Chữ Hán (Kanji)**: **先生** (Âm Hán Việt: *Tiên Sinh*)
                - **Hiragana**: **せんせい** (`se-n-se-i`)
                - **Romaji / Phát âm**: `sensei` (khi nói thường phát âm trường âm là *sen-see*).
                - **Ý nghĩa**: Giáo viên, thầy cô giáo, bác sĩ, hoặc tiền bối trong nghề.

                💡 **Chiết tự & Mẹo nhớ thú vị:**
                1. **先 (Tiên)**: Nghĩa là *trước, đi trước* (gồm bộ `Nhân 儿` + `Ngưu 牛` biến thể).
                2. **生 (Sinh)**: Nghĩa là *sinh ra, sống* (hình tượng mầm cây vươn lên khỏi mặt đất).
                👉 *Tiên Sinh* chính là *"người sinh ra trước, đi trước ta"* để dẫn dắt và truyền dạy kiến thức!

                ✍️ **Cách dùng trong câu:**
                - `山田先生はとても優しいです。`
                  *(Yamada sensei wa totemo yasashii desu - Thầy Yamada rất hiền từ).*
                """,
                SuggestedQuestions = new List<string>
                {
                    "Phân biệt Sensei (先生) và Kyoushi (教師)",
                    "💡 Tại sao 3 chữ 木 thành 森?",
                    "Phân biệt trợ từ は và が"
                }
            };
        }

        // 3. Kanji & Radicals (Bộ Mộc, Lâm, Sâm,...)
        if (query.Contains("木") || query.Contains("sâm") || query.Contains("sam") || query.Contains("rừng") || query.Contains("bộ mộc") || query.Contains("mộc") || query.Contains("moc") || query.Contains("3 chữ"))
        {
            return new SenseiChatResponseDto
            {
                Reply = """
                🌲 **Bí quyết nhớ bộ Mộc (木) và các chữ Kanji phái sinh:**

                1. **木 (Mộc)**: Tượng hình hình dáng một **cây thân gỗ** có rễ cắm sâu vào lòng đất và các cành xòe ra.
                   - Nghĩa: Cây cối, gỗ.
                   - Cách đọc: `き (ki)` / `モク (moku)`.

                2. **林 (Lâm)**: Gồm **2 chữ 木** ghép lại → Hai cây đứng cạnh nhau tạo thành **khu rừng nhỏ / lùm cây**.
                   - Nghĩa: Rừng thưa, rừng trồng.
                   - Cách đọc: `はやし (hayashi)` / `リン (rin)`.

                3. **森 (Sâm)**: Gồm **3 chữ 木** xếp chồng lên nhau → Rất nhiều cây rậm rạp sum suê tạo thành **rừng nguyên sinh / đại ngàn**.
                   - Nghĩa: Rừng rậm, rừng sâu.
                   - Cách đọc: `もり (mori)` / `シン (shin)`.

                💡 *Mẹo nhớ:* 1 cây là **Mộc**, 2 cây là **Lâm**, 3 cây là **Sâm** sum suê! 🌳✨
                """,
                SuggestedQuestions = new List<string>
                {
                    "Cách nhớ nhanh 50 bộ thủ đầu",
                    "Bộ Nhật (日) và Nguyệt (月) ghép thành chữ gì?",
                    "Mẹo học 214 bộ thủ Kanji không bị quên"
                }
            };
        }

        // 4. Particles: は (wa) vs が (ga)
        if (query.Contains("は") && query.Contains("が") || query.Contains("trợ từ") || query.Contains("wa và ga") || query.Contains("ha và ga"))
        {
            return new SenseiChatResponseDto
            {
                Reply = """
                🎯 **Phân biệt trợ từ は (wa) và が (ga) chuẩn xác nhất:**

                1. **Trợ từ は (Chỉ Chủ đề - Topic Marker)**:
                   - **Trọng tâm thông tin nằm ở VẾ SAU は** (Vị ngữ giải thích chủ đề).
                   - Dùng nêu chủ đề câu chuyện hoặc so sánh đối chiếu.
                   - *Ví dụ:* `私はベトナム人です。` *(Tôi là người Việt Nam - Trọng tâm là "người VN").*

                2. **Trợ từ が (Chỉ Chủ ngữ cụ thể - Subject Marker)**:
                   - **Trọng tâm thông tin nằm ở VẾ TRƯỚC が** (Chính đối tượng đó chứ không phải ai khác).
                   - Dùng trong câu trả lời từ để hỏi (誰が...), mô tả hiện tượng tự nhiên (`雨が降る`), đi với tính từ sở thích/năng lực (`好き`, `上手`, `わかる`).
                   - *Ví dụ:* `誰が来ましたか？` → `田中さんが来ました。` *(Ai đã đến? → Chính anh Tanaka đã đến).*

                ✨ *Công thức vàng của Sensei:*
                👉 **A は [B]** (Nhấn mạnh B)
                👉 **[A] が B** (Nhấn mạnh A)
                """,
                SuggestedQuestions = new List<string>
                {
                    "Trợ từ に (ni) và で (de) khác nhau thế nào?",
                    "Cho tôi ví dụ thực tế về mẫu câu này",
                    "Cách chia thể て (Te) nhanh nhất"
                }
            };
        }

        // 5. 50 Radicals & General Radicals
        if (query.Contains("bộ thủ") || query.Contains("50 bộ") || query.Contains("214 bộ") || query.Contains("kanji") || query.Contains("chữ hán"))
        {
            return new SenseiChatResponseDto
            {
                Reply = """
                🎌 **Mẹo nhớ nhanh các bộ thủ Kanji cơ bản:**

                - **Nhóm Thiên Nhiên:** 
                  - **日 (Nhật - Mặt trời)** ☀️, **月 (Nguyệt - Mặt trăng)** 🌙, **火 (Hỏa - Lửa)** 🔥, **水 / 氵 (Thủy - Nước)** 💧, **木 (Mộc - Cây)** 🌲, **金 (Kim - Vàng/Kim loại)** 🪙, **土 (Thổ - Đất)** 🏔️.
                - **Nhóm Con Người:** 
                  - **人 / 亻 (Nhân - Người)** 👤, **女 (Nữ - Phụ nữ)** 👩, **子 (Tử - Trẻ con)** 👶, **口 (Khẩu - Miệng)** 👄, **目 (Mục - Mắt)** 👁️, **心 / 忄 (Tâm - Trái tim)** ❤️.
                - **Nhóm Hành Động & Công Cụ:** 
                  - **手 / 扌 (Thủ - Tay)** ✋, **足 (Túc - Chân)** 🦵, **言 / 讠 (Ngôn - Lời nói)** 💬, **門 (Môn - Cánh cửa)** 🚪.

                ✨ *Lời khuyên của Sensei:* Đừng học vẹt cả 214 bộ một lúc, hãy bắt đầu từ **50 bộ thông dụng nhất** xuất hiện trong 80% chữ Hán N5 & N4 nhé!
                """,
                SuggestedQuestions = new List<string>
                {
                    "Bộ Tâm (心) thường xuất hiện trong những chữ nào?",
                    "Phân biệt bộ Đao (刀) và bộ Lực (力)",
                    "Ngữ pháp bài học hiện tại"
                }
            };
        }

        // 6. Examples / Ví dụ
        if (query.Contains("ví dụ") || query.Contains("vi du") || query.Contains("example") || query.Contains("đặt câu"))
        {
            var target = string.IsNullOrWhiteSpace(request.LessonTitle) ? "bài học" : request.LessonTitle;
            return new SenseiChatResponseDto
            {
                Reply = $"""
                💬 **Ví dụ thực tế sinh động cho {target}:**

                1. **Ví dụ 1 (Giao tiếp hàng ngày):**
                   - `日本語の勉強はとても面白いです。`
                   - *Phiên âm:* `Nihongo no benkyou wa totemo omoshiroi desu.`
                   - *Dịch nghĩa:* Việc học tiếng Nhật rất là thú vị!

                2. **Ví dụ 2 (Ứng dụng nơi công sở / trường học):**
                   - `先生、この漢字の読み方を教えてください。`
                   - *Phiên âm:* `Sensei, kono kanji no yomikata o oshiete kudasai.`
                   - *Dịch nghĩa:* Thưa thầy/cô, xin hãy chỉ cho em cách đọc chữ Hán này với ạ.

                3. **Ví dụ 3 (Mục tiêu học tập):**
                   - `今年JLPT N3に合格できるように、毎日頑張ります！`
                   - *Phiên âm:* `Kotoshi JLPT N3 ni goukaku dekiru you ni, mainichi gambarimasu!`
                   - *Dịch nghĩa:* Để có thể đỗ JLPT N3 trong năm nay, mỗi ngày tôi đều cố gắng hết mình!

                🔥 *Bài tập nhỏ cho bạn:* Hãy thử dịch câu *"Tôi thích học tiếng Nhật cùng Sensei"* sang tiếng Nhật xem nào!
                """,
                SuggestedQuestions = new List<string>
                {
                    "Giải thích ngữ pháp câu ví dụ số 2",
                    "Phân biệt trợ từ は và が",
                    "Mẹo nhớ từ vựng trong bài"
                }
            };
        }

        // 7. Grammar
        if (query.Contains("ngữ pháp") || query.Contains("cấu trúc") || query.Contains("mẫu câu"))
        {
            return new SenseiChatResponseDto
            {
                Reply = $"""
                📝 **Bí quyết làm chủ ngữ pháp {(string.IsNullOrWhiteSpace(request.LessonTitle) ? "tiếng Nhật" : $"bài '{request.LessonTitle}'")}:**

                1. **Hiểu rõ cốt lõi (Core Meaning)**: Xác định chủ thể hành động và trợ từ liên kết (`は`, `が`, `を`, `に`, `で`).
                2. **So sánh tương quan**: Xem cấu trúc này khác gì với các mẫu tương đương đã học (ví dụ: `〜てください` vs `〜てはいけません`).
                3. **Quy tắc 3 câu**: Tự đặt ngay 3 câu liên quan đến cuộc sống hàng ngày của bạn để biến ngữ pháp thành phản xạ tự nhiên.

                Bạn cần Sensei phân tích chi tiết mẫu ngữ pháp nào trong bài không? 🎌
                """,
                SuggestedQuestions = new List<string>
                {
                    "Phân biệt trợ từ は và が",
                    "Cho tôi 3 ví dụ câu thực tế",
                    "Cách chia thể て (Te) nhanh nhất"
                }
            };
        }

        // 8. Translation & Multi-language Greetings (hallo, ich bin, hello, dịch sang tiếng nhật,...)
        if (query.Contains("hallo") || query.Contains("ich bin") || query.Contains("sang tiếng nhật") || query.Contains("tieng nhat") || query.Contains("dịch") || query.Contains("dich") || query.Contains("translate") || query.Contains("tiếng đức") || query.Contains("tiếng anh"))
        {
            var name = query.Contains("phong") ? "Phong (フォン)" : "bạn";
            return new SenseiChatResponseDto
            {
                Reply = $"""
                🌍 **Dịch câu sang tiếng Nhật:**

                Câu *"Hallo, ich bin {name}"* (tiếng Đức: *Xin chào, tôi là {name}*) trong tiếng Nhật nói như sau:

                - **Cách nói lịch sự, tự nhiên nhất:**
                  - **Chữ Nhật**: `こんにちは、フォンです。`
                  - **Furigana / Romaji**: `Konnichiwa, Fon desu.`
                  - **Ý nghĩa**: *Xin chào, tôi là Phong.*

                - **Cách nói đầy đủ, trang trọng hơn:**
                  - **Chữ Nhật**: `初めまして、私はフォンと申します。どうぞよろしくお願いします。`
                  - **Romaji**: `Hajimemashite, watashi wa Fon to moushimasu. Douzo yoroshiku onegaishimasu.`
                  - **Ý nghĩa**: *Rất vui được gặp bạn, tôi tên là Phong. Rất mong nhận được sự giúp đỡ của bạn.*

                💡 *Mẹo nhỏ:* Tên tiếng nước ngoài như "Phong" trong tiếng Nhật sẽ được viết bằng bảng chữ cứng Katakana là **フォン** (`Fo-n`)! ✨
                """,
                SuggestedQuestions = new List<string>
                {
                    "Viết tên tiếng Việt sang Katakana như thế nào?",
                    "Phân biệt はじめまして và こんにちは",
                    "Phân biệt trợ từ は và が"
                }
            };
        }

        return new SenseiChatResponseDto
        {
            Reply = $"""
            Kon'nichiwa Kenji-san! 🎌 Sensei đã nhận được câu hỏi: **"{request.Message}"**.

            ⚠️ **Hệ thống đang ở chế độ Trợ lý Offline (Chưa cấu hình API Key):**
            Để Sensei có thể suy luận trực tiếp bằng mô hình **Google Gemini (AI Studio)** hoặc **OpenAI (ChatGPT)** và trả lời tự do mọi câu hỏi của bạn:
            👉 Bạn hãy truy cập vào trang **[Cài đặt Hệ thống → Cấu hình AI](/admin/settings)** để điền API Key (miễn phí từ [Google AI Studio](https://aistudio.google.com/app/apikey)) nhé!

            Trong thời gian này, bạn có thể thử các câu hỏi tiếng Nhật mẫu của Sensei:
            1. *"sensei viết như thế nào"*
            2. *"Phân biệt trợ từ は và が"*
            3. *"Tại sao 3 chữ 木 thành 森?"*
            4. *"Cho tôi ví dụ thực tế về mẫu câu này"*
            """,
            SuggestedQuestions = new List<string>
            {
                "sensei viết như thế nào",
                "Phân biệt trợ từ は và が",
                "Tại sao 3 chữ 木 thành 森?"
            }
        };
    }
}
