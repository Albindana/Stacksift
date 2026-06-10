using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;
using StackSift.Domain.Entities;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Queries.Members;

public record GetMembersQuery(Guid OrgId) : IRequest<IReadOnlyList<MemberDto>>;

public sealed class GetMembersQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetMembersQuery, IReadOnlyList<MemberDto>>
{
    public async Task<IReadOnlyList<MemberDto>> Handle(GetMembersQuery query, CancellationToken ct)
    {
        if (query.OrgId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Organization), query.OrgId);

        var members = await uow.Users.GetByOrganizationIdAsync(query.OrgId, ct);
        if (members.Count == 0) return Array.Empty<MemberDto>();

        var inviterIds = members
            .Select(m => m.InvitedByUserId)
            .Where(id => id is not null)
            .Select(id => id!.Value)
            .Distinct()
            .ToHashSet();

        var inviterList = inviterIds.Count > 0
            ? await uow.Users.GetManyByIdAsync(inviterIds, ct)
            : [];
        var inviters = inviterList.ToDictionary(u => u.Id, u => u.DisplayName);

        return members
            .Select(m =>
            {
                var inviterName = m.InvitedByUserId is { } iid && inviters.TryGetValue(iid, out var n)
                    ? n
                    : null;
                return m.ToMemberDto(inviterName);
            })
            .ToArray();
    }
}
