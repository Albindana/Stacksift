using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackSift.Application.Interfaces;
using StackSift.Domain;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Commands.Auth;

public record RegisterUserCommand(
    string Email,
    string Password,
    string DisplayName,
    bool IsOwner,
    string? CaptchaToken = null,
    string? Honeypot = null,
    string? RemoteIp = null,
    string? InvitationToken = null) : IRequest<RegisterUserResult>;

public record RegisterUserResult(
    Guid UserId,
    string Email,
    string Role,
    Guid? OrganizationId,
    bool AttachedViaInvitation,
    bool EmailVerified,
    bool VerificationEmailSent);

public sealed class RegisterUserCommandHandler(
    IKeycloakAdminClient keycloak,
    IUnitOfWork uow,
    ICaptchaVerifier captcha,
    IOptions<RegistrationOptions> registrationOptions,
    ILogger<RegisterUserCommandHandler> logger)
    : IRequestHandler<RegisterUserCommand, RegisterUserResult>
{
    public async Task<RegisterUserResult> Handle(RegisterUserCommand cmd, CancellationToken ct)
    {
        var normalized = cmd.Email.Trim().ToLowerInvariant();

        // Honeypot: bots fill the hidden field. Return a synthetic success so the
        // attacker cannot distinguish a rejection — no user is created.
        if (!string.IsNullOrWhiteSpace(cmd.Honeypot))
        {
            logger.LogInformation("Register honeypot tripped for {Email}; silently dropped", normalized);
            return new RegisterUserResult(Guid.Empty, normalized, "viewer", null, false,
                EmailVerified: false, VerificationEmailSent: true);
        }

        if (captcha.Enabled && !await captcha.VerifyAsync(cmd.CaptchaToken, cmd.RemoteIp, ct))
            throw new ValidationException("Captcha verification failed.");

        var pending = await uow.Invitations.FindPendingByEmailAsync(normalized, ct);

        // An invitation token carried through the register link proves the caller
        // received the invite email — the same trust basis as /accept-invitation.
        // Such users are created already-verified; a bare email match is NOT proof
        // (anyone who learns an invited address could otherwise claim the seat).
        Invitation? tokenInvitation = null;
        if (!string.IsNullOrWhiteSpace(cmd.InvitationToken))
        {
            tokenInvitation = await uow.Invitations.FindByTokenAsync(cmd.InvitationToken, ct);
            if (tokenInvitation is null
                || tokenInvitation.AcceptedAt is not null
                || tokenInvitation.ExpiresAt <= DateTimeOffset.UtcNow)
                throw new ConflictException("Invitation is invalid, expired, or already used.");

            if (!string.Equals(tokenInvitation.Email, normalized, StringComparison.OrdinalIgnoreCase))
                throw new ValidationException("This invitation was issued for a different email address.");

            pending = tokenInvitation;
        }

        if (registrationOptions.Value.InviteOnly && pending is null)
        {
            logger.LogInformation(
                "Registration is invite-only; rejecting {Email} with no pending invitation", normalized);
            throw new RegistrationClosedException(
                "Registration is currently invite-only. Ask an organisation owner to invite you.");
        }

        var role = pending?.Role ?? (cmd.IsOwner ? UserRole.Owner : UserRole.Viewer);
        var orgId = pending?.OrganizationId;
        var roleSlug = role.ToString().ToLowerInvariant();

        if (pending is not null)
        {
            var org = await uow.Organizations.GetByIdAsync(pending.OrganizationId, ct)
                ?? throw new NotFoundException(nameof(Organization), pending.OrganizationId);
            var planLimit = PlanLimits.Map[org.Plan];
            if (planLimit.MaxUsers != int.MaxValue)
            {
                var active = await uow.Users.CountActiveMembersAsync(org.Id, ct);
                var pendingCount = await uow.Invitations.CountPendingByOrgAsync(org.Id, ct);
                if (active + pendingCount - 1 >= planLimit.MaxUsers)
                    throw new PlanLimitExceededException("members", planLimit.MaxUsers, org.Plan);
            }
        }

        // Token-bearing registrations are verified by construction; bare self-service
        // registration carries no proof of email ownership, so the user is created
        // unverified and must complete the Keycloak verify-email flow below.
        var emailVerified = tokenInvitation is not null;
        var keycloakUserId = await keycloak.CreateUserAsync(
            normalized, cmd.Password, cmd.DisplayName, roleSlug, orgId, emailVerified, ct);

        try
        {
            var user = new User
            {
                Id = keycloakUserId,
                Email = normalized,
                DisplayName = cmd.DisplayName,
                Role = role,
                OrganizationId = orgId,
                InvitedByUserId = pending?.InvitedByUserId,
            };
            await uow.Users.AddAsync(user, ct);

            if (pending is not null)
            {
                pending.AcceptedAt = DateTimeOffset.UtcNow;
                await uow.Invitations.UpdateAsync(pending, ct);
            }

            await uow.SaveChangesAsync(ct);

            // Realm policy requires email verification before login. Trigger the
            // Keycloak verify-email here (skipped for token-verified users); a mail
            // failure must not fail (or roll back) registration — the account is
            // committed and the user can request a resend / be re-verified by an
            // admin — but the caller is told so the UI doesn't claim a mail was sent.
            var verificationEmailSent = false;
            if (!emailVerified)
            {
                try
                {
                    await keycloak.SendVerifyEmailAsync(user.Id, ct);
                    verificationEmailSent = true;
                }
                catch (Exception emailEx)
                {
                    logger.LogWarning(emailEx,
                        "Failed to send verification email to {UserId}; account created without it", user.Id);
                }
            }

            if (pending is not null)
            {
                logger.LogInformation(
                    "Registered user {UserId} auto-attached to org {OrgId} via invitation {InvId}",
                    user.Id, orgId, pending.Id);
            }
            else
            {
                logger.LogInformation(
                    "Registered user {UserId} ({Email}) as {Role}",
                    user.Id, user.Email, roleSlug);
            }

            return new RegisterUserResult(
                user.Id, user.Email, roleSlug, user.OrganizationId,
                AttachedViaInvitation: pending is not null,
                EmailVerified: emailVerified,
                VerificationEmailSent: verificationEmailSent);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "DB insert failed after Keycloak user creation. Rolling back Keycloak user {UserId}",
                keycloakUserId);

            try
            {
                await keycloak.DeleteUserAsync(keycloakUserId, CancellationToken.None);
            }
            catch (Exception deleteEx)
            {
                logger.LogError(deleteEx,
                    "Compensating Keycloak delete failed for {UserId}; user is now orphaned",
                    keycloakUserId);
            }

            throw;
        }
    }
}
