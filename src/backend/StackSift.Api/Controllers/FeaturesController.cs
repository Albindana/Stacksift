using Microsoft.AspNetCore.Mvc;
using StackSift.Application.Features;

namespace StackSift.Api.Controllers;

/// <summary>Feature flags evaluated for the current user — read by the SPA to gate UI.</summary>
public class FeaturesController(MediatR.IMediator mediator) : BaseApiController(mediator)
{
    /// <summary>Get the known feature flags and whether each is currently enabled.</summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>A map of flag name → enabled.</returns>
    /// <response code="200">Evaluated flags (e.g. <c>{ "flags": { "ai-analysis": true } }</c>).</response>
    [HttpGet]
    [ProducesResponseType(typeof(FeatureFlagsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetFlags(CancellationToken ct)
        => Ok(await Mediator.Send(new GetFeatureFlagsQuery(), ct));
}
