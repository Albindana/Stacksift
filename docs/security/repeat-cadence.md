# Security repeat cadence (Plan 08 §16.3)

Ongoing assurance after the pre-launch pen test.

| Cadence | Activity |
|---|---|
| Continuous | Dependabot PRs; Trivy + Dockle on every image build; GHAS code + secret scanning. |
| Weekly | OWASP ZAP passive baseline DAST against the beta (`zap-dast` workflow; report-only). See `docs/security/dast-zap.md`. |
| Monthly | Triage Dependabot/Trivy findings; clear or justify `.trivyignore` entries; review the latest ZAP `WARN` backlog. |
| Quarterly | Internal review against the OWASP ASVS L2 checklist; lockfile audit (`docs/security/lockfile-audit.md`); `nuclei` sweep against staging. |
| Semi-annual | Restore drill (see `docs/runbooks/restore-drill-tabletop.md`). |
| Annual | External re-test (repeat of the pre-launch pen-test scope). |

Each review is logged in `docs/security/log.md` with the date, who ran it, and
the findings/actions.

## Bug bounty (v1)

Self-hosted via `SECURITY.md` (report channel + scope + safe harbor). Upgrade to
a managed program (e.g. HackerOne) once MRR exceeds the threshold in the
PRE-DEPLOY plan §16.2.
