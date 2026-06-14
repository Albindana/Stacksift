# M6.4 — A/B Test Design: AI Analysis Placement

## Overview

| Field | Value |
|---|---|
| Experiment name | `ai-analysis-placement` |
| Feature flag | `ab-ai-prominent` (Unleash) |
| Owner | Engineering |
| Start date | TBD |
| Planned duration | 3 weeks |
| Status | Designed — not yet launched |

---

## Hypothesis

**If** we surface the AI analysis panel as a prominent callout above the alerts timeline on the incident detail page (treatment),
**then** engineers will trigger AI analysis at a higher rate than when the panel sits in the sidebar (control),
**because** the sidebar placement requires users to scroll past the timeline and notice a passive widget, while a prominent banner is unavoidable and reduces the activation friction to a single click.

**Predicted effect:** ≥ 50% relative increase in `ai_analysis_triggered` rate per incident detail view (from ~20% to ~30%).

---

## Variants

### Control (A) — `ab-ai-prominent: false` (default)

Current layout: AI analysis panel is in the right sidebar column, below the fold on most screens. The "Analyze with AI" button is only visible after the user scrolls down.

### Treatment (B) — `ab-ai-prominent: true`

AI analysis panel is rendered as a prominent callout banner immediately below the incident header, before the alerts timeline. The "Analyze with AI" CTA is in the viewport on page load — no scrolling required.

**What does NOT change:**
- The panel content and copy are identical in both variants.
- The `ai-analysis` kill-switch still gates the button (if AI is disabled, neither variant shows the CTA).
- All other page elements remain identical.

---

## Metrics

### Primary metric

| Metric | Definition | Source |
|---|---|---|
| `ai_analysis_triggered` rate | % of incident detail page views where the user clicks "Analyze with AI" | GA4 event `ai_analysis_triggered` |

**Baseline (control):** ~20% of incident detail views trigger an analysis.
**Target (treatment):** ~30% or higher.

### Secondary metrics

| Metric | Definition | Direction |
|---|---|---|
| Median time to `incident_resolved` | From `incident.createdAt` to `status = resolved` | Decrease |
| Analysis re-trigger rate | % of analyses triggered more than once per incident | No regression |

### Guardrail metric (must not regress)

| Metric | Threshold |
|---|---|
| Incident detail page p95 load time | Must not increase by > 10% |

---

## Sample Size Calculation

**Assumptions:**
- Baseline conversion rate (control): p₁ = 0.20
- Minimum detectable effect: 50% relative lift → p₂ = 0.30
- Significance level: α = 0.05 (two-tailed)
- Statistical power: 1 − β = 0.80 → z_β = 0.842
- z_α/2 = 1.96

**Formula** (two-proportion z-test):

```
n = (z_α/2 + z_β)² × [p₁(1−p₁) + p₂(1−p₂)] / (p₁ − p₂)²
```

**Calculation:**

```
numerator   = (1.96 + 0.842)²  × [0.20 × 0.80 + 0.30 × 0.70]
            = (2.802)²          × [0.16 + 0.21]
            = 7.851             × 0.37
            = 2.905

denominator = (0.30 − 0.20)²
            = 0.01

n = 2.905 / 0.01 = 291 per variant
```

**Required sample:** 291 incident detail page views per variant (582 total).

**Estimated duration:**

| Weekly incident views (all users) | Views per variant/week | Weeks to reach 291 |
|---|---|---|
| 100 | 50 | ~6 weeks |
| 200 | 100 | ~3 weeks |
| 400 | 200 | ~1.5 weeks |

Planned at ~200 views/week → **3-week runtime**.

---

## Success Criteria

The experiment is a **win** if all of the following hold at the end of the 3-week window:

1. `ai_analysis_triggered` rate in treatment ≥ 30% (vs. ~20% control).
2. p-value < 0.05 on a two-tailed chi-square test of proportions.
3. Incident detail p95 load time has not increased by more than 10%.

The experiment is a **loss** (revert treatment) if:
- Treatment rate is lower than control with p < 0.05.
- P95 latency regression > 10%.

The experiment is **inconclusive** if the p-value ≥ 0.05 after the planned window — in which case we extend by one week or lower the MDE threshold and re-calculate.

---

## Implementation Details

### Feature flag

Flag name: `ab-ai-prominent`
Type: Boolean (on = treatment, off = control)
Split: 50/50 — configured in Unleash UI under the `stacksift` project.

Unleash delivers flags through the BFF (`GET /api/v1/features`). The frontend reads the flag via `useFeatureFlag('ab-ai-prominent')` and re-polls every 20 seconds — so a mid-experiment kill works within 20 seconds without a redeploy.

### Tracking

Every incident detail view fires:

```ts
trackEvent(AnalyticsEvent.AbVariantViewed, {
  experiment: 'ai-analysis-placement',
  variant: aiProminent ? 'treatment' : 'control',
  incident_id: id,
});
```

This event plus the existing `ai_analysis_triggered` event (fired by `useTriggerAiAnalysis` mutation) gives us the numerator and denominator for the primary metric in GA4.

**GA4 analysis query (BigQuery export):**

```sql
SELECT
  params.variant,
  COUNT(DISTINCT session_id)                            AS views,
  COUNTIF(event_name = 'ai_analysis_triggered')         AS triggers,
  SAFE_DIVIDE(
    COUNTIF(event_name = 'ai_analysis_triggered'),
    COUNT(DISTINCT session_id)
  )                                                     AS trigger_rate
FROM events
WHERE experiment = 'ai-analysis-placement'
  AND event_date BETWEEN @start AND @end
GROUP BY params.variant
```

### Rollout plan

| Day | Action |
|---|---|
| 0 | Create `ab-ai-prominent` flag in Unleash, set to 0% (off) |
| 1 | Ramp to 50/50 split, start 3-week window |
| 21 | Freeze flag (no changes), run analysis |
| 22 | Ship winner or revert |

### Stopping rules

Early stop for **harm**: if treatment shows a statistically significant decrease in trigger rate at any interim check (weekly), kill the experiment and revert.

Early stop for **success** (optional): use a sequential testing correction (e.g., O'Brien-Fleming boundary) only if the team agrees upfront — otherwise hold to the 3-week plan to avoid inflated false-positive rates.

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Flag flips mid-session pollute data | Low | GA4 events carry `variant` param — filter by session's first `ab_variant_viewed` assignment |
| Low traffic extends timeline | Medium | Extend window; do not lower α |
| AI panel prominent layout breaks mobile | Low | Existing responsive grid handles it; QA on 375px viewport before launch |
| Novelty effect inflates treatment short-term | Medium | Evaluate primary metric at week 3, not week 1 |
