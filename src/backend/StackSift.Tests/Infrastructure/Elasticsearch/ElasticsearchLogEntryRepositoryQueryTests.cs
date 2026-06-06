using StackSift.Domain.Enums;
using StackSift.Domain.ValueObjects;
using StackSift.Infrastructure.Elasticsearch;
using StackSift.Tests.Helpers;

namespace StackSift.Tests.Infrastructure.Elasticsearch;

public class ElasticsearchLogEntryRepositoryQueryTests
{
    private static (ElasticsearchLogEntryRepository Repo, CapturingEsClientFactory Factory) CreateRepo()
    {
        var factory = new CapturingEsClientFactory();
        var client = factory.Create();
        var user = new FakeCurrentUserService { OrganizationId = Guid.NewGuid() };
        return (new ElasticsearchLogEntryRepository(client, user), factory);
    }

    [Fact]
    public async Task SearchAsync_TermFilters_TargetKeywordSubfields()
    {
        var (repo, factory) = CreateRepo();
        var filters = new LogQueryFilters(
            ProjectId: Guid.NewGuid(),
            Levels: [LogLevel.Error, LogLevel.Warning],
            Search: "boom",
            StartDate: null,
            EndDate: null,
            LogSourceId: Guid.NewGuid());

        await repo.SearchAsync(filters, 10, null);

        var body = Assert.Single(factory.RequestBodies);
        Assert.Contains("projectId.keyword", body);
        Assert.Contains("logSourceId.keyword", body);
        Assert.Contains("level.keyword", body);
    }

    [Fact]
    public async Task SearchAsync_SingleLevelFilter_TargetsKeywordSubfield()
    {
        var (repo, factory) = CreateRepo();
        var filters = new LogQueryFilters(
            ProjectId: null,
            Levels: [LogLevel.Error],
            Search: null,
            StartDate: null,
            EndDate: null,
            LogSourceId: null);

        await repo.SearchAsync(filters, 10, null);

        var body = Assert.Single(factory.RequestBodies);
        Assert.Contains("level.keyword", body);
        Assert.Contains("Error", body);
    }

    [Fact]
    public async Task SearchAsync_FullTextSearch_StaysOnAnalyzedMessageField()
    {
        var (repo, factory) = CreateRepo();
        var filters = new LogQueryFilters(
            ProjectId: null,
            Levels: null,
            Search: "timeout",
            StartDate: null,
            EndDate: null,
            LogSourceId: null);

        await repo.SearchAsync(filters, 10, null);

        var body = Assert.Single(factory.RequestBodies);
        Assert.Contains("\"message\"", body);
        Assert.DoesNotContain("message.keyword", body);
    }
}
