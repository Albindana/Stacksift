import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of service for StackSift.",
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <main id="main" className="container-page py-16 max-w-3xl md:py-24">
      <h1 className="text-4xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 2 June 2026</p>
      <p className="mt-6 text-muted leading-relaxed">
        These terms describe the basic rules for using StackSift while the
        service is in early access. Please email{" "}
        <a
          href="mailto:dardan.ternava@gjirafa.com"
          className="text-primary underline"
        >
          dardan.ternava@gjirafa.com
        </a>{" "}
        with any legal, billing, or account questions.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">1. Service use</h2>
      <p className="mt-4 text-muted leading-relaxed">
        StackSift provides log ingestion, incident grouping, alerting, and
        AI-assisted root-cause analysis. You are responsible for the
        applications, systems, logs, and account users you connect to the
        service.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">2. Log content</h2>
      <p className="mt-4 text-muted leading-relaxed">
        Do not intentionally send secrets, payment card data, credentials, or
        data you are not allowed to process. You control what your applications
        log before that data reaches StackSift.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">3. Availability</h2>
      <p className="mt-4 text-muted leading-relaxed">
        StackSift is provided as an early-stage service. We work to keep it
        available and reliable, but no service-level agreement is offered unless
        we agree one separately in writing.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">4. Billing</h2>
      <p className="mt-4 text-muted leading-relaxed">
        Paid plans are billed through Stripe. You can cancel a paid plan from
        the hosted billing portal or by contacting us. Plan limits and pricing
        are shown on the pricing page and may change with notice.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">5. Termination</h2>
      <p className="mt-4 text-muted leading-relaxed">
        You may stop using StackSift at any time. We may suspend or terminate
        access for abuse, security risk, unpaid invoices, or use that violates
        these terms.
      </p>
      <p className="mt-12 text-sm text-muted">
        <Link href="/" className="hover:text-primary">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
