using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NihongoLms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemSettingsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""SystemSettings"" (
                    ""Id"" uuid NOT NULL,
                    ""Key"" text NOT NULL,
                    ""EncryptedValue"" text NOT NULL,
                    ""Description"" text,
                    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
                    ""UpdatedAtUtc"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_SystemSettings"" PRIMARY KEY (""Id"")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_SystemSettings_Key"" ON ""SystemSettings"" (""Key"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SystemSettings");
        }
    }
}