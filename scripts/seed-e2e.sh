#!/usr/bin/env bash
#
# Provision the real-stack e2e fixture, idempotently and non-destructively:
#   1. a Keycloak user (via the admin API) with the org_id + role claims, and
#   2. the matching app-DB Organization + User rows (User.Id == Keycloak id).
#
# Why the admin API and not realm-import credentials:
#   - Realm import is skipped when the realm already exists (dev volumes), so
#     JSON-seeded users/passwords never land without a destructive `down -v`.
#   - The realm enforces a password policy; admin reset-password bypasses it.
#   This script works whether the realm is freshly imported or already present,
#   and never wipes existing data.
#
# Run AFTER keycloak is healthy and migrations are applied (compose `migrate`):
#   ./scripts/seed-e2e.sh
#
# Env (CI/compose defaults shown):
set -euo pipefail

KC_URL="${KC_URL:-http://localhost:8080}"
KC_REALM="${KC_REALM:-stacksift}"
KC_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KC_ADMIN_PW="${KEYCLOAK_ADMIN_PASSWORD:-dev_only_admin_secret_DO_NOT_USE_IN_PROD}"
E2E_USER="${E2E_USER:-e2e@stacksift.local}"
E2E_PASSWORD="${E2E_PASSWORD:-E2eRunner!23}"
ORG_ID="${E2E_ORG_ID:-11111111-1111-1111-1111-111111111111}"
POSTGRES_USER="${POSTGRES_USER:-stacksift}"
POSTGRES_DB="${POSTGRES_DB:-stacksift}"

# Compose commands run from infrastructure/docker (resolve relative to this file).
cd "$(dirname "$0")/../infrastructure/docker"

jqpy() { python3 -c "import sys,json; $1"; }

admin_token() {
  curl -fsS -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=admin-cli -d username="$KC_ADMIN" \
    --data-urlencode "password=$KC_ADMIN_PW" \
    | jqpy 'print(json.load(sys.stdin)["access_token"])'
}

ADMIN="$(admin_token)"
auth=(-H "Authorization: Bearer $ADMIN")

user_id() {
  curl -fsS "${auth[@]}" "$KC_URL/admin/realms/$KC_REALM/users?email=$E2E_USER&exact=true" \
    | jqpy 'u=json.load(sys.stdin); print(u[0]["id"] if u else "")'
}

ATTRS='{"stacksift_role":["owner"],"organization_id":["'"$ORG_ID"'"]}'

uid="$(user_id)"
if [ -z "$uid" ]; then
  echo "Creating Keycloak user $E2E_USER ..."
  curl -fsS "${auth[@]}" -X POST "$KC_URL/admin/realms/$KC_REALM/users" \
    -H 'Content-Type: application/json' \
    -d '{"username":"'"$E2E_USER"'","email":"'"$E2E_USER"'","emailVerified":true,"enabled":true,"firstName":"E2E","lastName":"Runner","attributes":'"$ATTRS"'}'
  uid="$(user_id)"
else
  echo "Keycloak user $E2E_USER already exists; ensuring claims ..."
  curl -fsS "${auth[@]}" -X PUT "$KC_URL/admin/realms/$KC_REALM/users/$uid" \
    -H 'Content-Type: application/json' \
    -d '{"emailVerified":true,"enabled":true,"attributes":'"$ATTRS"'}'
fi
[ -n "$uid" ] || { echo "ERROR: could not resolve Keycloak user id" >&2; exit 1; }
echo "Keycloak e2e user id: $uid"

# Non-temporary password (admin reset bypasses the realm password policy).
curl -fsS "${auth[@]}" -X PUT "$KC_URL/admin/realms/$KC_REALM/users/$uid/reset-password" \
  -H 'Content-Type: application/json' \
  -d '{"type":"password","value":"'"$E2E_PASSWORD"'","temporary":false}'

# App DB: Organization + User (User.Id == Keycloak id). Enum columns store the
# .NET enum NAME (HasConversion<string>()): Plan=Free, SubscriptionStatus=None,
# Role=Owner. Run as the bootstrap superuser so RLS is bypassed. Idempotent.
echo "Seeding app DB org $ORG_ID + user $uid ..."
docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  -v uid="$uid" -v org="$ORG_ID" <<'SQL'
INSERT INTO "Organizations"
  ("Id","Name","Slug","Plan","SubscriptionStatus","CancelAtPeriodEnd","IsDeleted","CreatedAt","UpdatedAt")
VALUES (:'org', 'E2E Test Org', 'e2e-test-org', 'Free', 'None', false, false, now(), now())
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "Users"
  ("Id","Email","DisplayName","Role","OrganizationId","IsDeleted","CreatedAt","UpdatedAt")
VALUES (:'uid', 'e2e@stacksift.local', 'E2E Runner', 'Owner', :'org', false, now(), now())
ON CONFLICT ("Id") DO NOTHING;
SQL

echo "e2e seed complete."
