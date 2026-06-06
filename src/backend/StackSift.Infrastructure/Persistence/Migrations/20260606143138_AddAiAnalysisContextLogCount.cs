using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAiAnalysisContextLogCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ContextLogCount",
                table: "AiAnalyses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Backfill existing rows from the relevant-log list they already carry.
            migrationBuilder.Sql(
                """
                UPDATE "AiAnalyses"
                SET "ContextLogCount" = COALESCE(array_length("RelevantLogIds", 1), 0);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContextLogCount",
                table: "AiAnalyses");
        }
    }
}
