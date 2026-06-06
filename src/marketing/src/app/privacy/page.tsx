import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How StackSift collects, uses, shares, and retains personal data under the GDPR.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "2 June 2026";

type DataRow = {
  category: string;
  purpose: string;
  basis: string;
  retention: string;
};

const ACCOUNT_DATA: readonly DataRow[] = [
  {
    category: "Email address",
    purpose: "Identity, sign-in, billing receipts, service notifications",
    basis: "Contract",
    retention: "Until account deletion",
  },
  {
    category: "Display name",
    purpose: "Personalising the in-app UI",
    basis: "Contract",
    retention: "Until account deletion",
  },
  {
    category: "Authentication credentials (password)",
    purpose: "Authenticating you to the platform",
    basis: "Contract",
    retention: "Until account deletion (stored Argon2-hashed in Keycloak)",
  },
  {
    category: "Last login IP address",
    purpose: "Abuse and fraud detection",
    basis: "Legitimate interests",
    retention: "90 days (rolling)",
  },
  {
    category: "Invitation email address",
    purpose: "Delivering a pending team invitation",
    basis: "Legitimate interests",
    retention: "Until accepted, or 30 days",
  },
  {
    category: "Audit log (actor email + IP)",
    purpose: "Security audit trail and forensics",
    basis: "Legal obligation / legitimate interests",
    retention: "365 days, then actor identifiers are anonymised",
  },
  {
    category: "Billing identifiers (Stripe customer + subscription)",
    purpose: "Subscription billing and reconciliation",
    basis: "Contract / legal obligation",
    retention: "7 years (statutory accounting requirement)",
  },
  {
    category: "Log-source API key (hashed)",
    purpose: "Authenticating log ingestion",
    basis: "Contract",
    retention: "Until the log source is deleted (HMAC-SHA256, never stored in clear)",
  },
];

const LOG_DATA: readonly DataRow[] = [
  {
    category: "Log entry content (message + metadata)",
    purpose: "Core product function — search, alerting, incident analysis",
    basis: "Processed on your behalf (Art. 28 processor)",
    retention: "Per plan tier — 3 days (Free), 30 days (Indie), 90 days (Team)",
  },
  {
    category: "AI-analysis input context",
    purpose: "Generating root-cause analyses (RAG embeddings + completion)",
    basis: "Processed on your behalf (Art. 28 processor)",
    retention: "Retained while your organisation is active",
  },
];

type Subprocessor = { name: string; purpose: string; region: string };

const SUBPROCESSORS: readonly Subprocessor[] = [
  {
    name: "Vercel",
    purpose: "Marketing site hosting (stacksift.io)",
    region: "Global edge",
  },
  {
    name: "Hetzner Cloud",
    purpose: "Application + database + log indexing",
    region: "EU (Falkenstein, Germany)",
  },
  {
    name: "OpenAI",
    purpose:
      "Embeddings (text-embedding-3-small) and chat completion (gpt-4o-mini) for AI root-cause analyses",
    region: "US",
  },
  {
    name: "Stripe",
    purpose:
      "Subscription billing, payment processing, hosted customer portal. Card data never reaches StackSift servers.",
    region: "US (with EU data-residency option)",
  },
  {
    name: "Plausible",
    purpose: "Privacy-friendly site analytics (self-hosted at plausible.stacksift.io)",
    region: "EU",
  },
];

const RIGHTS: readonly string[] = [
  "Access — request a copy of the personal data we hold about you.",
  "Rectification — correct inaccurate or incomplete data.",
  "Erasure — delete your account and associated data (subject to the legal retention floors below).",
  "Portability — export your data in a machine-readable format.",
  "Restriction — ask us to limit how we process your data.",
  "Objection — object to processing based on legitimate interests.",
  "Withdraw consent — where processing relies on consent, withdraw it at any time.",
  "Complaint — lodge a complaint with your local supervisory authority.",
];

function DataTable({ rows }: { rows: readonly DataRow[] }) {
  return (
    <div className="mt-6">
      <div className="grid gap-4 md:hidden">
        {rows.map((r) => (
          <div key={r.category} className="rounded-lg border border-line bg-surface p-4">
            <div className="font-semibold">{r.category}</div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="font-semibold text-primary">Purpose</dt>
                <dd className="mt-1 text-muted">{r.purpose}</dd>
              </div>
              <div>
                <dt className="font-semibold text-primary">Legal basis</dt>
                <dd className="mt-1 text-muted">{r.basis}</dd>
              </div>
              <div>
                <dt className="font-semibold text-primary">Retention</dt>
                <dd className="mt-1 text-muted">{r.retention}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <table className="hidden w-full text-left border border-line rounded-lg overflow-hidden md:table">
        <thead className="bg-surface">
          <tr>
            <th scope="col" className="p-4 font-semibold">
              Data
            </th>
            <th scope="col" className="p-4 font-semibold">
              Purpose
            </th>
            <th scope="col" className="p-4 font-semibold">
              Legal basis
            </th>
            <th scope="col" className="p-4 font-semibold">
              Retention
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category} className="border-t border-line align-top">
              <th scope="row" className="p-4 font-medium text-left">
                {r.category}
              </th>
              <td className="p-4 text-muted">{r.purpose}</td>
              <td className="p-4 text-muted">{r.basis}</td>
              <td className="p-4 text-muted">{r.retention}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <main id="main" className="container-page py-16 max-w-3xl md:py-24">
      <h1 className="text-4xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {LAST_UPDATED}</p>

      <p className="mt-6 text-muted leading-relaxed">
        This policy explains what personal data StackSift collects, why we
        collect it, who we share it with, and the rights you have under the EU
        General Data Protection Regulation (GDPR). It is written to satisfy the
        information requirements of GDPR Article 13.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">1. Who we are</h2>
      <p className="mt-4 text-muted leading-relaxed">
        StackSift is an AI-powered log-analysis and SRE platform. For questions
        about this policy or to exercise any of your rights, contact us at{" "}
        <a
          href="mailto:dardan.ternava@gjirafa.com"
          className="text-primary underline"
        >
          dardan.ternava@gjirafa.com
        </a>
        .
      </p>

      <h2 className="mt-12 text-2xl font-semibold">
        2. Controller vs. processor
      </h2>
      <p className="mt-4 text-muted leading-relaxed">
        For your <strong>account data</strong> (your email, name, billing
        details, and audit trail), StackSift is the <strong>controller</strong>{" "}
        and decides why and how it is processed.
      </p>
      <p className="mt-4 text-muted leading-relaxed">
        For the <strong>log data you send us</strong> — the contents of your
        log entries and any context fed into an AI analysis — StackSift is a{" "}
        <strong>processor</strong> acting on your instructions under GDPR
        Article 28. You are the controller of any personal data your logs may
        contain about your own end-users. We do not redact log content
        server-side by default; controlling what your applications log is your
        responsibility. We provide guidance and a sample redaction enricher to
        help.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">
        3. Account data we collect
      </h2>
      <p className="mt-4 text-muted leading-relaxed">
        The following data is collected when you create an account, join a
        team, or subscribe to a paid plan.
      </p>
      <DataTable rows={ACCOUNT_DATA} />

      <h2 className="mt-12 text-2xl font-semibold">
        4. Log data processed on your behalf
      </h2>
      <p className="mt-4 text-muted leading-relaxed">
        Log entries are indexed in Elasticsearch hosted on Hetzner (EU,
        Germany), isolated per organisation. AI analyses send a relevant slice
        of your log context to OpenAI for embedding and completion (see
        international transfers below).
      </p>
      <DataTable rows={LOG_DATA} />

      <h2 className="mt-12 text-2xl font-semibold">5. Subprocessors</h2>
      <p className="mt-4 text-muted leading-relaxed">
        We rely on the following third-party processors to operate the service.
        This list is kept consistent with our{" "}
        <Link href="/subprocessors" className="text-primary underline">
          subprocessors page
        </Link>
        .
      </p>
      <div className="mt-6">
        <div className="grid gap-4 md:hidden">
          {SUBPROCESSORS.map((s) => (
            <div key={s.name} className="rounded-lg border border-line bg-surface p-4">
              <div className="font-semibold">{s.name}</div>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="font-semibold text-primary">Purpose</dt>
                  <dd className="mt-1 text-muted">{s.purpose}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-primary">Region</dt>
                  <dd className="mt-1 text-muted">{s.region}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <table className="hidden w-full text-left border border-line rounded-lg overflow-hidden md:table">
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="p-4 font-semibold">
                Service
              </th>
              <th scope="col" className="p-4 font-semibold">
                Purpose
              </th>
              <th scope="col" className="p-4 font-semibold">
                Region
              </th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name} className="border-t border-line align-top">
                <th scope="row" className="p-4 font-medium text-left">
                  {s.name}
                </th>
                <td className="p-4 text-muted">{s.purpose}</td>
                <td className="p-4 text-muted">{s.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-2xl font-semibold">
        6. International data transfers
      </h2>
      <p className="mt-4 text-muted leading-relaxed">
        Your account data and log indices are stored in the EU (Hetzner,
        Germany). AI root-cause analysis sends log context to OpenAI in the
        United States. That transfer is governed by the EU Standard Contractual
        Clauses (SCCs). Stripe processes billing data in the US with an EU
        data-residency option. We use no other transfer outside the EEA.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">7. How long we keep data</h2>
      <p className="mt-4 text-muted leading-relaxed">
        Retention periods are listed in the tables above. Log retention follows
        your plan tier (3 / 30 / 90 days). Two categories are subject to a
        regulatory floor that overrides account deletion: audit events are kept
        for 365 days and Stripe billing records for 7 years. When you delete
        your account, those rows are retained for the floor period but the
        actor identifiers are anonymised.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">8. Security</h2>
      <p className="mt-4 text-muted leading-relaxed">
        All data is encrypted in transit (TLS) and at rest. Passwords are stored
        Argon2-hashed by Keycloak; log-source API keys are stored as
        HMAC-SHA256 hashes with a server-side pepper and are never logged.
        Access is gated behind authenticated, per-organisation API calls.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">9. Your rights</h2>
      <p className="mt-4 text-muted leading-relaxed">
        Under the GDPR you have the following rights:
      </p>
      <ul className="mt-4 space-y-2 text-muted leading-relaxed list-disc pl-6">
        {RIGHTS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-4 text-muted leading-relaxed">
        You can exercise access, portability, and erasure directly from your
        account settings: request a data export, or delete your account. Account
        deletion starts a 30-day grace period (during which you can restore the
        account with a one-time token); after the grace period your
        organisation data is permanently removed, except the
        regulatory-floor records described in section 7.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">
        10. Cookies and analytics
      </h2>
      <p className="mt-4 text-muted leading-relaxed">
        The marketing site uses no advertising or cross-site tracking cookies,
        so no consent banner is required. When site analytics are enabled we use
        Plausible, a privacy-friendly, cookieless analytics tool that collects
        only aggregate, non-identifying metrics and sets no cookies. The
        application itself uses a single strictly-necessary, HTTP-only session
        cookie to keep you signed in.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">11. Changes</h2>
      <p className="mt-4 text-muted leading-relaxed">
        We will update this policy as the service evolves and revise the “last
        updated” date above. Material changes will be communicated in-app or by
        email.
      </p>

      <p className="mt-12 text-sm text-muted">
        <Link href="/" className="hover:text-primary">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
