using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NihongoLms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlaybackProgressFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "LastPlaybackPositionSeconds",
                table: "LessonProgresses",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "TotalDurationSeconds",
                table: "LessonProgresses",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastPlaybackPositionSeconds",
                table: "LessonProgresses");

            migrationBuilder.DropColumn(
                name: "TotalDurationSeconds",
                table: "LessonProgresses");
        }
    }
}
