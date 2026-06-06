import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subprocessors",
  description: "Third-party services StackSift uses to operate the platform.",
  robots: { index: false, follow: true },
};

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
    purpose: "Embeddings (text-embedding-3-small) and chat completion (gpt-4o-mini) for AI root-cause analyses",
    region: "US",
  },
  {
    name: "Stripe",
    purpose: "Subscription billing, payment processing, hosted customer portal. Card data never reaches StackSift servers.",
    region: "US (with EU data-residency option)",
  },
  {
    name: "Plausible",
    purpose: "Privacy-friendly site analytics (self-hosted at plausible.stacksift.io)",
    region: "EU",
  },
];

export default function SubprocessorsPage() {
  return (
    <main id="main" className="container-page py-16 max-w-3xl md:py-24">
      <h1 className="text-4xl font-bold">Subprocessors</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 2 June 2026</p>
      <p className="mt-6 text-muted leading-relaxed">
        StackSift uses the following third-party services to operate the
        platform. Email{" "}
        <a
          href="mailto:dardan.ternava@gjirafa.com"
          className="text-primary underline"
        >
          dardan.ternava@gjirafa.com
        </a>{" "}
        with any questions.
      </p>
      <div className="mt-10">
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
              <tr key={s.name} className="border-t border-line">
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
      <p className="mt-12 text-sm text-muted">
        <Link href="/" className="hover:text-primary">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
