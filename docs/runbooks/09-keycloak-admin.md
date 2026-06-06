# Runbook 09 — Keycloak administration

> Common Keycloak admin tasks for the `project-07` beta. Keycloak runs `start --import-realm`, shares
> the `stacksift` Postgres DB, and is the **sole** identity provider (realm `stacksift`). Admin console:
> `https://auth.dmdailydeals.com/admin/` (bootstrap admin from `stacksift-secrets` keys
> `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`).

> ⚠️ **Realm re-import caveat (read first).** The realm is imported from the `stacksift-realm` Secret
> only on **first import** (or `--import-realm` against an empty realm). Editing the realm JSON does
> **not** change a running realm. Make day-to-day changes in the **admin console** (they persist in
> Postgres). To change the *imported baseline*, edit the JSON, then either re-import into a fresh realm
> or apply the change in the console too. Registration is **invite-only** at the app layer
> (`Registration__InviteOnly=true`) — `registrationAllowed:false` in the realm only blocks Keycloak's
> own page.

## Get in

```bash
export KUBECONFIG=~/Downloads/project-07.kubeconfig
# console (browser): https://auth.dmdailydeals.com/admin/  → realm `stacksift`
# or kcadm from inside the pod:
KC=$(kubectl -n project-07 get pod -l app.kubernetes.io/component=keycloak -o name | head -1)
kubectl -n project-07 exec "$KC" -- /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master \
  --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD"
```

## Add a user manually
Normally users self-register via an invitation. To add one by hand:
- **Console:** realm `stacksift` → Users → Add user (set email, **Email verified = on** if skipping the
  verify flow) → Credentials → set password (toggle **Temporary** off for a permanent one).
- **Note:** the .NET side keys users by the Keycloak UUID (`Users.Id == sub`). A user created *only* in
  Keycloak won't have a StackSift row/org until they go through registration/onboarding. For beta
  access prefer sending an **invitation** from the app (Settings → Members) so the org auto-attaches.

## Reset a user's password
- Console → Users → (select) → Credentials → **Reset password**. Toggle Temporary as needed.
- Or let the user self-serve: the app's **Forgot password?** → `/api/auth/forgot` → Keycloak's hosted
  reset-credentials flow (needs SMTP/Resend working).

## Unlock a brute-force-locked user
Realm has brute-force detection enabled (temporary lockouts).
- Console → Users → (select) → see "Temporary locked"; **Realm settings → Security defenses →
  Brute force detection** to inspect. Unlock a single user from their user page, or:
```bash
kubectl -n project-07 exec "$KC" -- /opt/keycloak/bin/kcadm.sh \
  update users/<userId>/disable-credential-types -r stacksift   # (or use the console "Unlock user")
```
- To clear all lockouts: Realm settings → Security defenses → **Brute force detection → Clear** (or
  temporarily toggle detection off, then back on). Investigate *why* it locked (credential stuffing?).

## Rotate the `stacksift-backend-admin` client secret
The API's admin client (service account; used for user create/attribute updates). To rotate:
1. Console → Clients → `stacksift-backend-admin` → **Credentials → Regenerate Secret**. Copy it.
2. Update the app Secret and restart the API:
   ```bash
   kubectl -n project-07 patch secret stacksift-secrets --type merge \
     -p "{\"stringData\":{\"Keycloak__Admin__AdminClientSecret\":\"<new-secret>\"}}"
   kubectl -n project-07 rollout restart deploy/api
   ```
3. Persist the new value into `~/.config/stacksift-deploy/secrets.env` (source of truth; **not** git).
> The realm JSON ships the literal `REPLACE_AT_RUNTIME` placeholder; the live secret is whatever was
> substituted at deploy / regenerated here — never the placeholder.

## Export the realm (backup of the IdP config)
```bash
kubectl -n project-07 exec "$KC" -- /opt/keycloak/bin/kc.sh export \
  --realm stacksift --dir /tmp/realm-export --users realm_file
kubectl -n project-07 cp "${KC#pod/}:/tmp/realm-export" ./realm-export-$(date +%F)
```
Keep exports out of git if they contain secrets/users. (Keycloak's own data also lives in the
`stacksift` Postgres DB, which is covered by the DB backup story once enabled.)

## Add Google as an Identity Provider (login with Google)
The legacy SSO redirect path exists in the app, but no broker is configured yet.
1. Google Cloud console → OAuth client (Web) → Authorized redirect URI:
   `https://auth.dmdailydeals.com/realms/stacksift/broker/google/endpoint`.
2. Keycloak console → realm `stacksift` → **Identity providers → Add → Google** → paste Client ID +
   Secret → save. Map the email/name claims as needed.
3. Test the "Continue with Google" path end-to-end (account linking on first login).
> Persist the IdP config in the realm JSON / Terraform if it should survive a fresh re-import.

## Health
- Management/health is on port **9000**: `/health/live`, `/health/ready`, `/health/started`.
- If Keycloak won't start, check `KC_DB_URL` reachability (shared Postgres) and the realm import logs
  (`kubectl logs <kc-pod>`); a malformed `stacksift-realm` Secret fails the import.

## Realm SMTP (verify-email + forgot-password)

Keycloak sends its own emails (verify-email, reset-credentials) through the **realm SMTP
config** — NOT through the app's MailKit/Resend path. If `smtpServer` is empty, those flows
fail silently (registration verify mails never arrive; password reset is dead).

- **Beta (project-07):** configured 2026-06-06 against Resend (`smtp.resend.com:2465`, ssl,
  user `resend`, password = the `Smtp__Password` API key from `stacksift-secrets`,
  from `noreply@dmdailydeals.com`). Also baked into the `stacksift-realm` Secret so
  re-imports keep it. Local dev realm JSON points at Mailpit.
- **Verify:** Realm settings → Email → Test connection, or
  `kcadm.sh update users/<id>/send-verify-email -r stacksift -n`.
- **Gotcha:** `kcadm.sh get realms/stacksift --fields smtpServer` always prints `{}` —
  the fields filter is broken for map attributes. Use the full realm GET and grep.
- **Rotation:** new Resend key → update `stacksift-secrets` (app), the realm via
  kcadm/console (live), and the `stacksift-realm` Secret (import baseline).
