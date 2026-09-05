using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NihongoLms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRoadmapSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RoadmapTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    JlptLevel = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    TotalDays = table.Column<int>(type: "integer", nullable: false),
                    TotalEstimatedMinutes = table.Column<int>(type: "integer", nullable: true),
                    SourcePdfName = table.Column<string>(type: "text", nullable: true),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: false),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoadmapTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoadmapItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoadmapTemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayNumber = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    EstimatedDurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    SkillsJson = table.Column<string>(type: "text", nullable: false),
                    SearchKeywordsJson = table.Column<string>(type: "text", nullable: false),
                    LinkedLessonId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoadmapItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoadmapItems_Lessons_LinkedLessonId",
                        column: x => x.LinkedLessonId,
                        principalTable: "Lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RoadmapItems_RoadmapTemplates_RoadmapTemplateId",
                        column: x => x.RoadmapTemplateId,
                        principalTable: "RoadmapTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserRoadmapEnrollments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    RoadmapTemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PaceMode = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    EnrolledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRoadmapEnrollments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserRoadmapEnrollments_RoadmapTemplates_RoadmapTemplateId",
                        column: x => x.RoadmapTemplateId,
                        principalTable: "RoadmapTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RoadmapItemDriveFiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoadmapItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    DriveNodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    MatchScore = table.Column<int>(type: "integer", nullable: false),
                    ResourceType = table.Column<int>(type: "integer", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoadmapItemDriveFiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoadmapItemDriveFiles_DriveNodes_DriveNodeId",
                        column: x => x.DriveNodeId,
                        principalTable: "DriveNodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoadmapItemDriveFiles_RoadmapItems_RoadmapItemId",
                        column: x => x.RoadmapItemId,
                        principalTable: "RoadmapItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserRoadmapDayProgresses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EnrollmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayNumber = table.Column<int>(type: "integer", nullable: false),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRoadmapDayProgresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserRoadmapDayProgresses_UserRoadmapEnrollments_EnrollmentId",
                        column: x => x.EnrollmentId,
                        principalTable: "UserRoadmapEnrollments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Sections_CourseId_DisplayOrder",
                table: "Sections",
                columns: new[] { "CourseId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ReviewSchedules_UserId_VocabularyEntryId",
                table: "ReviewSchedules",
                columns: new[] { "UserId", "VocabularyEntryId" });

            migrationBuilder.CreateIndex(
                name: "IX_Resources_ResourceType",
                table: "Resources",
                column: "ResourceType");

            migrationBuilder.CreateIndex(
                name: "IX_Quizzes_QuizType",
                table: "Quizzes",
                column: "QuizType");

            migrationBuilder.CreateIndex(
                name: "IX_QuizQuestions_QuizId_DisplayOrder",
                table: "QuizQuestions",
                columns: new[] { "QuizId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_UserId_CompletedAtUtc",
                table: "QuizAttempts",
                columns: new[] { "UserId", "CompletedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Lessons_SectionId_DisplayOrder",
                table: "Lessons",
                columns: new[] { "SectionId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_LessonProgresses_UserId",
                table: "LessonProgresses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_RoadmapItemDriveFiles_DriveNodeId",
                table: "RoadmapItemDriveFiles",
                column: "DriveNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_RoadmapItemDriveFiles_RoadmapItemId",
                table: "RoadmapItemDriveFiles",
                column: "RoadmapItemId");

            migrationBuilder.CreateIndex(
                name: "IX_RoadmapItems_LinkedLessonId",
                table: "RoadmapItems",
                column: "LinkedLessonId");

            migrationBuilder.CreateIndex(
                name: "IX_RoadmapItems_RoadmapTemplateId_DayNumber",
                table: "RoadmapItems",
                columns: new[] { "RoadmapTemplateId", "DayNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoadmapTemplates_CreatedByUserId",
                table: "RoadmapTemplates",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RoadmapTemplates_IsPublished",
                table: "RoadmapTemplates",
                column: "IsPublished");

            migrationBuilder.CreateIndex(
                name: "IX_RoadmapTemplates_JlptLevel",
                table: "RoadmapTemplates",
                column: "JlptLevel");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoadmapDayProgresses_EnrollmentId_DayNumber",
                table: "UserRoadmapDayProgresses",
                columns: new[] { "EnrollmentId", "DayNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserRoadmapEnrollments_RoadmapTemplateId",
                table: "UserRoadmapEnrollments",
                column: "RoadmapTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoadmapEnrollments_UserId",
                table: "UserRoadmapEnrollments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoadmapEnrollments_UserId_RoadmapTemplateId",
                table: "UserRoadmapEnrollments",
                columns: new[] { "UserId", "RoadmapTemplateId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RoadmapItemDriveFiles");

            migrationBuilder.DropTable(
                name: "UserRoadmapDayProgresses");

            migrationBuilder.DropTable(
                name: "RoadmapItems");

            migrationBuilder.DropTable(
                name: "UserRoadmapEnrollments");

            migrationBuilder.DropTable(
                name: "RoadmapTemplates");

            migrationBuilder.DropIndex(
                name: "IX_Sections_CourseId_DisplayOrder",
                table: "Sections");

            migrationBuilder.DropIndex(
                name: "IX_ReviewSchedules_UserId_VocabularyEntryId",
                table: "ReviewSchedules");

            migrationBuilder.DropIndex(
                name: "IX_Resources_ResourceType",
                table: "Resources");

            migrationBuilder.DropIndex(
                name: "IX_Quizzes_QuizType",
                table: "Quizzes");

            migrationBuilder.DropIndex(
                name: "IX_QuizQuestions_QuizId_DisplayOrder",
                table: "QuizQuestions");

            migrationBuilder.DropIndex(
                name: "IX_QuizAttempts_UserId_CompletedAtUtc",
                table: "QuizAttempts");

            migrationBuilder.DropIndex(
                name: "IX_Lessons_SectionId_DisplayOrder",
                table: "Lessons");

            migrationBuilder.DropIndex(
                name: "IX_LessonProgresses_UserId",
                table: "LessonProgresses");
        }
    }
}
