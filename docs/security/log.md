# Security review log

Chronological record of security reviews, audits, and sweeps. See
`docs/security/repeat-cadence.md` for what each entry should cover.

| Date | Activity | By | Findings / actions |
|---|---|---|---|
| 2026-05-30 | Plan 08 implementation (tenancy filter + RLS, SignalR/ES hardening, rate limits/CORS/headers, validation/CSRF, registration abuse, audit append-only, dependency hygiene) | Plan 08 | Shipped; see git history `feature/PD-08-security-multitenancy`. |
| 2026-06-10 | OWASP ZAP passive baseline DAST against `app.dmdailydeals.com` (FS-5 / M5.5); wired `zap-dast` workflow (weekly + dispatch) | Claude Code | 0 high/critical. 3 tracked WARN (enforce CSP, drop `X-Powered-By`, add COOP/COEP/CORP), 6 IGNORE (FP/info), 61 PASS. Report: `m5-zap-baseline.html`; triage: `.zap/rules.tsv`; details: `dast-zap.md`. |
