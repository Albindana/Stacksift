using System.Text;
using Elastic.Clients.Elasticsearch;
using Elastic.Transport;

namespace StackSift.Tests.Helpers;

/// <summary>
/// Builds an ElasticsearchClient backed by an in-memory invoker that returns a
/// canned response and records every serialized request body, so tests can
/// assert on the exact query JSON sent to Elasticsearch.
/// </summary>
public sealed class CapturingEsClientFactory
{
    private readonly List<string> _requestBodies = [];

    public IReadOnlyList<string> RequestBodies => _requestBodies;

    public const string EmptySearchResponse =
        """
        {"took":1,"timed_out":false,"_shards":{"total":1,"successful":1,"skipped":0,"failed":0},
         "hits":{"total":{"value":0,"relation":"eq"},"hits":[]}}
        """;

    public ElasticsearchClient Create(string cannedResponseJson = EmptySearchResponse)
    {
        var invoker = new InMemoryRequestInvoker(
            Encoding.UTF8.GetBytes(cannedResponseJson), 200, null, "application/json",
            new Dictionary<string, IEnumerable<string>>
            {
                ["x-elastic-product"] = ["Elasticsearch"],
            });
        var pool = new SingleNodePool(new Uri("http://localhost:9200"));
        var settings = new ElasticsearchClientSettings(pool, invoker)
            .DisableDirectStreaming()
            .OnRequestCompleted(details =>
            {
                if (details.RequestBodyInBytes is { } bytes)
                    _requestBodies.Add(Encoding.UTF8.GetString(bytes));
            });
        return new ElasticsearchClient(settings);
    }
}
