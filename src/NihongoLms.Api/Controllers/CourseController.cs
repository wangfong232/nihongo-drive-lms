using Microsoft.AspNetCore.Mvc;
using NihongoLms.Application.DTOs;
using NihongoLms.Application.Interfaces;

namespace NihongoLms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CourseController : ControllerBase
{
    private readonly ICuratorService _curatorService;

    public CourseController(ICuratorService curatorService)
    {
        _curatorService = curatorService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllCourses(CancellationToken cancellationToken)
    {
        var courses = await _curatorService.GetAllCoursesAsync(cancellationToken);
        return Ok(courses);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetCourseById(Guid id, CancellationToken cancellationToken)
    {
        var course = await _curatorService.GetCourseByIdAsync(id, cancellationToken);
        if (course == null) return NotFound(new { error = $"Course {id} not found." });
        return Ok(course);
    }

    [HttpPost]
    public async Task<IActionResult> CreateCourse([FromBody] CreateCourseDto dto, CancellationToken cancellationToken)
    {
        var course = await _curatorService.CreateCourseAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetCourseById), new { id = course.Id }, course);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateCourse(Guid id, [FromBody] CreateCourseDto dto, CancellationToken cancellationToken)
    {
        var course = await _curatorService.UpdateCourseAsync(id, dto, cancellationToken);
        return Ok(course);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteCourse(Guid id, CancellationToken cancellationToken)
    {
        await _curatorService.DeleteCourseAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("sections")]
    public async Task<IActionResult> CreateSection([FromBody] CreateSectionDto dto, CancellationToken cancellationToken)
    {
        var section = await _curatorService.CreateSectionAsync(dto, cancellationToken);
        return Ok(section);
    }

    [HttpPut("sections/{id:guid}")]
    public async Task<IActionResult> UpdateSection(Guid id, [FromBody] CreateSectionDto dto, CancellationToken cancellationToken)
    {
        var section = await _curatorService.UpdateSectionAsync(id, dto, cancellationToken);
        return Ok(section);
    }

    [HttpDelete("sections/{id:guid}")]
    public async Task<IActionResult> DeleteSection(Guid id, CancellationToken cancellationToken)
    {
        await _curatorService.DeleteSectionAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("lessons")]
    public async Task<IActionResult> CreateLesson([FromBody] CreateLessonDto dto, CancellationToken cancellationToken)
    {
        var lesson = await _curatorService.CreateLessonAsync(dto, cancellationToken);
        return Ok(lesson);
    }

    [HttpPut("lessons/{id:guid}")]
    public async Task<IActionResult> UpdateLesson(Guid id, [FromBody] CreateLessonDto dto, CancellationToken cancellationToken)
    {
        var lesson = await _curatorService.UpdateLessonAsync(id, dto, cancellationToken);
        return Ok(lesson);
    }

    [HttpDelete("lessons/{id:guid}")]
    public async Task<IActionResult> DeleteLesson(Guid id, CancellationToken cancellationToken)
    {
        await _curatorService.DeleteLessonAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("reorder-lessons")]
    public async Task<IActionResult> ReorderLessons([FromBody] ReorderLessonsDto dto, CancellationToken cancellationToken)
    {
        await _curatorService.ReorderLessonsAsync(dto, cancellationToken);
        return Ok(new { message = "Lessons reordered successfully." });
    }

    [HttpPost("assign-quiz")]
    public async Task<IActionResult> AssignQuiz([FromBody] AssignQuizRequestDto dto, CancellationToken cancellationToken)
    {
        await _curatorService.AssignQuizToLessonAsync(dto, cancellationToken);
        return Ok(new { message = "Quiz assigned to lesson successfully." });
    }
}
