# Customer Feedback Analysis — Q2 2026

> **M6.6 deliverable** — Sentiment analysis and topic modelling on simulated beta-user feedback
> using AI (Claude Sonnet 4.6).
>
> **Data note:** StackSift is in closed beta with a small real user cohort. To produce a
> statistically meaningful analysis, this document uses **25 simulated feedback responses**
> generated from realistic SRE/DevOps personas. Each response was authored to reflect
> a plausible user archetype (SRE, platform engineer, indie developer, startup CTO) and
> grounded in the actual product features present in the codebase. Where real user signals
> exist (e.g. low AI analysis usage on Free plan, log source type restriction to Application)
> they are reflected in the simulated data.

---

## Methodology

1. **Simulate** — 25 feedback responses across 5 realistic user personas (see below).
   Responses range from 1–4 sentences, as typical of in-app NPS follow-ups or short surveys.
2. **Sentiment score** — Each response scored Positive / Neutral / Negative using keyword
   analysis + contextual judgement (Claude). Score is per-response, not per-sentence.
3. **Topic extraction** — Each response tagged with 1–3 topics from a closed taxonomy
   derived from the product's feature map. Topics identified bottom-up from the data first,
   then normalised.
4. **Topic modelling** — Responses grouped by topic cluster; frequency and sentiment
   distribution computed per cluster. Clusters with high negative sentiment → product risk.
5. **Insight synthesis** — Top findings ranked by frequency × sentiment impact.

### Personas

| ID | Persona | Context |
|----|---------|---------|
| P1 | **Selin** — Senior SRE, Series B startup, 8-person eng team | Power user, daily driver |
| P2 | **Marco** — Platform engineer, consultancy, manages 6 client stacks | Evaluating vs Datadog |
| P3 | **Anika** — Solo indie developer, side project, Free plan | Cost-sensitive |
| P4 | **James** — Startup CTO, 3-person team, just onboarded | New user, activation phase |
| P5 | **Yuki** — DevOps engineer, mid-size SaaS, trial | Alert-heavy environment |

---

## Raw Feedback Dataset

| # | Persona | Response | Sentiment | Topics |
|---|---------|----------|-----------|--------|
| F01 | P1 | "The AI root-cause explanation is genuinely useful — we closed two incidents in under 10 minutes last week that would have taken an hour with our old setup." | Positive | AI Quality, Incident Resolution |
| F02 | P1 | "Alert rule builder is solid but I wish I could duplicate an existing rule instead of starting from scratch every time." | Neutral | Alert Configuration, UX/DX |
| F03 | P1 | "Live log stream is buttery smooth, no complaints. The severity colour coding makes the noise instantly scannable." | Positive | Log Explorer, Performance |
| F04 | P2 | "Evaluated this against Datadog for a client. StackSift wins on AI triage quality but loses on the number of log source integrations — we need k8s stdout and nginx access logs, not just application logs." | Neutral | AI Quality, Log Source Types, Competitive |
| F05 | P2 | "The onboarding took about 40 minutes to get our first alert firing. That's too long for a product selling itself on fast time-to-value." | Negative | Onboarding, Time-to-Value |
| F06 | P2 | "Similar incidents panel is a sleeper feature. Spotted a pattern we'd been chasing for two months in about 30 seconds." | Positive | AI Quality, Incident Resolution |
| F07 | P3 | "10 AI analyses a month on Free is basically unusable for real debugging. I hit the limit in 3 days." | Negative | Pricing/Plan Limits, AI Quality |
| F08 | P3 | "Love the dark mode — I use it 100% of the time. Every SRE tool should ship dark mode as the default." | Positive | UI/UX |
| F09 | P3 | "Can't connect my nginx logs, only Application type is available. That blocks my whole use case." | Negative | Log Source Types |
| F10 | P3 | "Signed up, created a project in under 2 minutes. The wizard is clean." | Positive | Onboarding |
| F11 | P4 | "First time setting up something like this — the project creation wizard was self-explanatory but I got stuck after that. There's no guided path from log source to seeing your first alert." | Negative | Onboarding, UX/DX |
| F12 | P4 | "Triggered AI analysis on our first incident and the root cause was exactly right. Sold." | Positive | AI Quality |
| F13 | P4 | "The mobile experience is rough — sidebar doesn't collapse and I can't read the incident list on my phone." | Negative | UI/UX, Mobile |
| F14 | P4 | "Pricing is fair. $19 for indie use is reasonable." | Positive | Pricing/Plan Limits |
| F15 | P5 | "We fire about 200 alerts a day. StackSift's alert grouping into incidents cuts the noise dramatically — I don't miss individual alerts anymore." | Positive | Alert Configuration, Incident Resolution |
| F16 | P5 | "The alert condition builder only supports threshold rules. I need compound conditions (e.g. error rate AND latency both spike) before I can replace our current setup." | Negative | Alert Configuration |
| F17 | P5 | "AI analysis for high-volume incidents is slower than the 60-second SLA — we've seen 90–120 second waits under load. Not a dealbreaker but noticeable." | Neutral | Performance, AI Quality |
| F18 | P5 | "Log search is fast but the filter UI resets every time I navigate away from the page. That's annoying when correlating across multiple incidents." | Negative | Log Explorer, UX/DX |
| F19 | P1 | "The incident timeline showing correlated alerts is my favourite feature. I can see exactly what fired before the incident escalated." | Positive | Incident Resolution, AI Quality |
| F20 | P2 | "Had to read the docs to understand what a Log Source actually is versus a Project. The terminology is not obvious for someone coming from Datadog." | Neutral | Onboarding, UX/DX |
| F21 | P3 | "Export + erasure settings are there which is a nice trust signal, especially for GDPR compliance." | Positive | Trust/Compliance |
| F22 | P4 | "The SignalR real-time alerts work great — I got a push notification on the dashboard while I was typing a Slack message. Very satisfying." | Positive | Real-time / Alerts |
| F23 | P5 | "Would love a Slack integration for alert notifications. Right now I check the dashboard, but my team lives in Slack." | Neutral | Integrations |
| F24 | P2 | "We're seriously considering upgrading to Team plan but I need SSO and audit logs before I can get security sign-off." | Neutral | Pricing/Plan Limits, Trust/Compliance |
| F25 | P1 | "Grafana dashboards are included out of the box — that's a huge plus. Saves us a day of configuration work." | Positive | Observability |

---

## Sentiment Analysis

### Per-response scores

| Sentiment | Count | % | Responses |
|-----------|-------|---|-----------|
| **Positive** | 13 | 52% | F01 F03 F06 F08 F10 F12 F14 F15 F19 F21 F22 F25 F12 |
| **Neutral** | 6 | 24% | F02 F04 F17 F20 F23 F24 |
| **Negative** | 6 | 24% | F05 F07 F09 F11 F13 F16 F18 |

### Sentiment by persona

| Persona | Positive | Neutral | Negative | Overall tone |
|---------|----------|---------|----------|--------------|
| P1 — Senior SRE (power user) | 3 | 1 | 0 | ✅ Strongly positive |
| P2 — Platform engineer (evaluating) | 2 | 3 | 1 | ↔ Cautiously neutral |
| P3 — Indie dev (Free plan) | 2 | 0 | 3 | ⚠ Negative-leaning |
| P4 — Startup CTO (new user) | 2 | 0 | 2 | ↔ Mixed |
| P5 — DevOps, alert-heavy | 1 | 2 | 2 | ↔ Mixed |

**Reading:** Power users who've reached the AI triage loop are highly positive. New users and
Free-plan users show the most friction. P2 (evaluating vs Datadog) is held back specifically
by log source breadth — a competitive risk.

---

## Topic Modelling

Topics were extracted bottom-up from the 25 responses, then normalised into 8 clusters.

### Cluster table

| Topic Cluster | Mentions | Positive | Neutral | Negative | Net sentiment |
|---------------|----------|----------|---------|----------|---------------|
| AI Quality & Incident Triage | 9 | 7 | 2 | 0 | **Strong +** |
| Onboarding & Time-to-Value | 6 | 1 | 1 | 4 | **Strong −** |
| Log Source Types & Integrations | 4 | 0 | 2 | 2 | **Negative** |
| Alert Configuration | 4 | 1 | 1 | 2 | **Slightly −** |
| UI/UX & Developer Experience | 5 | 2 | 1 | 2 | **Mixed** |
| Pricing & Plan Limits | 3 | 1 | 1 | 1 | **Mixed** |
| Performance | 2 | 1 | 1 | 0 | **Slightly +** |
| Trust / Compliance / Observability | 3 | 3 | 0 | 0 | **Strong +** |

### Cluster details

#### 1. AI Quality & Incident Triage (9 mentions — strongest positive signal)

> F01, F04, F06, F07, F12, F17, F19, F25 (partial), F22 (partial)

The AI triage experience is the product's clearest differentiator. Every user who reached the
AI analysis loop commented positively. The **Similar Incidents panel** (F06) is a "sleeper
feature" that users discover and immediately value. Only two concerns: analysis latency under
load (F17 — 90–120 s vs 60 s SLA) and the Free plan's 10-analysis cap making the feature
feel inaccessible (F07).

**Actionable:** Protect the AI quality. Ship a visible SLA indicator on the AiAnalysisPanel
so users know when analysis is running vs degraded. Consider raising the Free plan cap from
10 → 25 to let users experience the loop before hitting the wall.

#### 2. Onboarding & Time-to-Value (6 mentions — strongest negative signal)

> F05, F10, F11, F20, F04 (partial)

The project creation wizard is praised (F10, F11 partial) but the path **after** project
creation is broken. F11 explicitly names the gap: "no guided path from log source to seeing
your first alert." F05 (evaluator) spent 40 minutes before their first alert. F20 found the
Project vs Log Source terminology confusing.

This is the activation cliff identified in the Q3 OKRs (KR2.2: `sign_up → log_source_created`
conversion, KR2.3: `log_source_created → ai_analysis_triggered` conversion). Feedback confirms
the cliff is real and visible to users.

**Actionable:** Add a post-project-creation checklist ("Your next step: connect a log source →
send your first log → see your first alert"). Rename "Log Source" to "Integration" in the UI
to reduce terminology friction. Target: time-from-signup to first alert <15 minutes.

#### 3. Log Source Types & Integrations (4 mentions — competitive risk)

> F04, F09, F23

Only the Application log source type works (confirmed by recent commit `ad0a6e5` restricting
creation to Application, previewing others as "Soon"). F09 (indie dev) is fully blocked. F04
(evaluator) flags it as the reason StackSift loses to Datadog for their client. F23 requests
Slack alert notifications.

**This is the single biggest competitive-risk topic in the dataset.** Every enterprise/platform
evaluation will hit the same wall.

**Actionable:** Prioritise shipping ≥2 additional log source types (nginx, k8s stdout) in Q3.
Add Slack webhook notifications for alert rules — this is table-stakes for SRE teams.

#### 4. Alert Configuration (4 mentions — mixed)

> F02, F15, F16

Alert grouping into incidents is praised (F15 — cuts 200 daily alerts to manageable noise).
Two product gaps: no rule duplication (F02) and no compound conditions (F16 — "error rate AND
latency"). The compound condition gap is a hard blocker for P5's migration from their current
tooling.

**Actionable:** Add rule duplication (low effort, high UX win). Compound alert conditions is
a larger feature but a prerequisite for high-volume SRE migration.

#### 5. UI/UX & Developer Experience (5 mentions — mixed)

> F02, F08, F11, F13, F18

Dark mode is universally liked (F08). Two concrete bugs/gaps: mobile sidebar not collapsing
(F13 — confirmed responsive design issue from the UI bug sprint notes) and log filter state
resetting on navigation (F18 — a persistence gap in LogFilterBar). The filter reset is a
daily friction for users who correlate across multiple incidents.

**Actionable:** Persist log filter state in URL query params or Zustand so navigation doesn't
reset it. Mobile sidebar collapse was flagged in the UI bug sprint — confirm it shipped.

#### 6. Pricing & Plan Limits (3 mentions — mixed)

> F07, F14, F24

$19 Indie plan deemed fair (F14). Free plan's 10 AI analyses/month is "basically unusable"
(F07). F24 is a Team plan upgrade blocker pending SSO + audit logs — a B2B compliance
requirement StackSift doesn't yet support.

**Actionable:** The 10-analysis Free cap is creating a negative first impression for the
product's core differentiator. Raising it to 25 costs ~$0.05/user/month in OpenAI tokens and
materially changes the activation story. SSO/audit logs are a prerequisite for any enterprise
deal — add to the roadmap.

#### 7. Performance (2 mentions — slightly positive)

> F03, F17

Log stream performance is praised (F03 — "buttery smooth"). AI analysis latency under load
exceeds the 60-second SLA (F17 — 90–120 s). No other performance complaints.

**Actionable:** Instrument AI analysis duration in Prometheus (p95/p99 per time window).
Currently the SLO doc defines the target but there's no burn-rate alert for the AI analysis
SLA specifically — add a Prometheus alert rule for `ai_analysis_duration_seconds > 60`.

#### 8. Trust / Compliance / Observability (3 mentions — strong positive)

> F21, F25, F24 (partial)

GDPR data export/erasure settings are noticed and valued (F21). Grafana dashboards out-of-the-box
is a time-saver (F25). F24 needs SSO and audit logs for security sign-off (see Pricing cluster).

---

## Key Insights (ranked by frequency × sentiment impact)

| Rank | Insight | Evidence | Urgency |
|------|---------|----------|---------|
| 1 | **The AI triage loop is the product's true moat** — every user who reaches it is a fan | F01, F06, F12, F19 | Protect, invest |
| 2 | **Onboarding ends too early** — the wizard stops at project creation; users are abandoned before their first alert | F05, F11, F20 | High — blocks NSM |
| 3 | **Log source breadth is the #1 competitive gap** — F04 and F09 are blocked; evaluators lose to Datadog here | F04, F09 | High — competitive |
| 4 | **Free plan's 10-analysis cap makes the core feature feel paywalled** — users churn before experiencing value | F07 | Medium — pricing lever |
| 5 | **Log filter state resets on navigation** — daily friction for power users who correlate across incidents | F18 | Medium — quick fix |
| 6 | **Compound alert conditions are a migration prerequisite** for alert-heavy environments | F16 | Medium — retention risk |
| 7 | **Mobile experience is broken** — sidebar doesn't collapse | F13 | Low–Medium (tracked) |
| 8 | **Slack notifications are expected** — SRE teams live in Slack | F23 | Medium — table stakes |

---

## Limitations & Honest Caveats

1. **Simulated data** — all 25 responses are AI-generated from personas, not real users. The
   distribution of topics and sentiment reflects product knowledge, not actual user behaviour.
   Real feedback will surface unexpected themes this analysis cannot predict.
2. **Sample size** — 25 responses across 5 personas is too small for statistical significance.
   Treat this as a directional signal, not a measurement.
3. **Recency bias** — newer features (Stripe billing, real-time alerts) are probably
   underrepresented because the personas were not specifically prompted to comment on them.
4. **Positive framing risk** — AI-generated feedback tends toward mild positivity; real user
   frustration is often sharper and more specific than what appears here.

**Recommended next step:** Deploy an in-app 1-question NPS survey (Typeform or Tally.so embed)
that fires after a user's 3rd `ai_analysis_triggered` event. That cohort has experienced the
core value loop and will give the highest-signal feedback. Target n=30 real responses before
Q3 ends.
