using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StackSift.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Data-only backfill: incidents analyzed before the trigger handler started
    /// writing Incident.AiAnalysisId are linked to their most recent analysis.
    /// Idempotent — only touches rows where the link is still NULL.
    /// </summary>
    public partial class BackfillIncidentAiAnalysisId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE "Incidents" i SET "AiAnalysisId" = a."Id"
                FROM (SELECT DISTINCT ON ("IncidentId") "IncidentId", "Id"
                      FROM "AiAnalyses"
                      WHERE "IsDeleted" = false
                      ORDER BY "IncidentId", "CreatedAt" DESC) a
                WHERE a."IncidentId" = i."Id" AND i."AiAnalysisId" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data backfill — intentionally irreversible; rolling back does not
            // require clearing the links.
        }
    }
}
