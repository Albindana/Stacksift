using System.Net;
using FluentAssertions;

namespace StackSift.Tests.Integration;

/// <summary>
/// Pins the CORS preflight contract for the SignalR hub. The SignalR JS client
/// sends x-requested-with and x-signalr-user-agent on negotiate; if the policy
/// stops allowing any requested header, the browser fails the preflight and
/// never issues the POST — silently killing every real-time feature.
/// </summary>
[Collection("Integration")]
public class CorsPreflightTests(StackSiftWebApplicationFactory factory)
{
    private const string AllowedOrigin = "http://localhost:3000";

    [Fact]
    public async Task HubNegotiatePreflight_AllowsAllSignalRRequestHeaders()
    {
        using var client = factory.CreateClient();
        var requestedHeaders = new[] { "authorization", "x-requested-with", "x-signalr-user-agent" };

        using var request = new HttpRequestMessage(
            HttpMethod.Options, "/hubs/stacksift/negotiate?negotiateVersion=1");
        request.Headers.Add("Origin", AllowedOrigin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", string.Join(",", requestedHeaders));

        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        response.Headers.GetValues("Access-Control-Allow-Origin")
            .Should().ContainSingle().Which.Should().Be(AllowedOrigin);

        var allowed = response.Headers.GetValues("Access-Control-Allow-Headers")
            .SelectMany(v => v.Split(','))
            .Select(h => h.Trim().ToLowerInvariant())
            .ToList();
        foreach (var header in requestedHeaders)
            allowed.Should().Contain(header,
                $"the SignalR JS client sends '{header}' — dropping it from the CORS policy breaks all real-time features");
    }

    [Fact]
    public async Task ApiPreflight_AllowsAxiosRequestHeaders()
    {
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/incidents");
        request.Headers.Add("Origin", AllowedOrigin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        request.Headers.Add("Access-Control-Request-Headers", "authorization,x-correlation-id");

        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var allowed = response.Headers.GetValues("Access-Control-Allow-Headers")
            .SelectMany(v => v.Split(','))
            .Select(h => h.Trim().ToLowerInvariant())
            .ToList();
        allowed.Should().Contain("authorization");
        allowed.Should().Contain("x-correlation-id");
    }
}
