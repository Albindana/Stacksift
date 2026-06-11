# Secret Scanning (gitleaks)

Satisfies **FS-5** ("secrets check"). gitleaks is the modern equivalent of the
git-secrets/truffleHog tools named in the brief — GitHub-native, multi-provider,
scans git history and PR diffs.

## What runs where

| Layer | Tool | Scope |
|---|---|---|
| CI (PR) | `gitleaks/gitleaks-action@v2` (`secret-scan` job in `ci.yml`) | the PR's commits/diff |
| CI (push) | same job | the pushed commits (full history with `fetch-depth: 0` on scheduled/dispatch runs) |
| CI (targeted) | `secrets-guard` job (`ci.yml`) | working-tree grep for real-looking **Stripe** keys + wildcard ES index — kept as a complementary belt |
| Local (optional) | `.husky/pre-commit` → `gitleaks protect --staged` | staged changes; **only if `gitleaks` is installed** (skips silently otherwise) |

Config + allowlist live in `.gitleaks.toml` (`extend.useDefault = true` + the
project allowlist).

## Allowlist policy

`.gitleaks.toml` allowlists only **known-safe** sources, never blanket-disables:
- Placeholders: `REPLACE_AT_RUNTIME`, `REPLACE_ME`.
- Documented local dev defaults: `minioadmin`, `stacksift_secret`, `admin_secret`.
- The canonical AWS example key `AKIAIOSFODNN7EXAMPLE` (used in docs/this file).
- Paths: `.env.example`, `docs/`, `zhelpers/`, frontend `coverage/`,
  `CURRENTSTATE.md`, and test fixtures (`__tests__/`, `__mocks__/`, `*.test.*`,
  `*.spec.*`) — these legitimately carry fake high-entropy tokens (mock JWTs,
  sample ids) that the entropy-based `generic-api-key` rule flags.

A full-history scan (472 commits) is clean under this config; the three historical
`generic-api-key` hits were all mock test tokens / state-doc text now covered by
the test/CURRENTSTATE path allowlist.

## Handling a finding

1. **Real secret committed** → it is compromised. **Rotate it immediately** at the
   provider, then remove it from the codebase. For history, prefer rotation +
   allowlisting the specific old commit with a justification over a history rewrite
   (rewrites break everyone's clones); rewrite only if the secret is high-value and
   still live.
2. **False positive** → add a *narrow* allowlist entry (specific regex or path) to
   `.gitleaks.toml` with a comment explaining why. Never disable a rule wholesale.
3. Real secrets belong in `.env.local` / `dotnet user-secrets` / k8s Secrets
   (all git-ignored / out-of-band) — never in tracked files.

## Run it locally

```bash
# scan working tree:
gitleaks detect --no-git --config .gitleaks.toml --redact
# scan full history:
gitleaks detect --config .gitleaks.toml --redact
# (no local binary? the docker image works too:)
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect --source /repo --config /repo/.gitleaks.toml --redact
```
