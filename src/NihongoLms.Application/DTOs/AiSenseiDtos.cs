using System.Collections.Generic;

namespace NihongoLms.Application.DTOs;

public class SenseiChatMessageDto
{
    public string Role { get; set; } = "user"; // "user" or "assistant"
    public string Content { get; set; } = string.Empty;
}

public class SenseiChatRequestDto
{
    public string Message { get; set; } = string.Empty;
    public string? LessonTitle { get; set; }
    public string? CourseTitle { get; set; }
    public string? SectionTitle { get; set; }
    public string? JlptLevel { get; set; }
    public List<SenseiChatMessageDto>? History { get; set; }
}

public class SenseiChatResponseDto
{
    public string Reply { get; set; } = string.Empty;
    public List<string>? SuggestedQuestions { get; set; }
}
