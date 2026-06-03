import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "StackSift is built by three engineers as their LIFE Fellows 2026 capstone — an AI-powered SRE platform priced for solo devs and small teams.",
};

export default function AboutPage() {
  return (
    <main id="main" className="container-page py-16 md:py-24">
      <h1 className="text-4xl font-bold">About StackSift</h1>
      <p className="mt-6 text-lg text-muted max-w-2xl">
        StackSift is built by three engineers — Dardan, Jona, and Albin — as
        their LIFE Fellows 2026 capstone. The mission is simple: every solo dev
        running production code deserves a 2 AM safety net that doesn’t cost
        $500/month.
      </p>
      <p className="mt-4 text-muted max-w-2xl">
        We built it for the kind of team that owns production without owning a
        full observability department: small product teams, capstone projects,
        indie SaaS apps, and internal tools that still need fast answers when
        logs start cascading.
      </p>
      <p className="mt-4 text-muted max-w-2xl">
        The product is intentionally narrow: ingest logs, group incidents, and
        explain the likely root cause in plain English. The goal is not to
        replace every observability suite. It is to make the first hour of an
        incident shorter.
      </p>
      <p className="mt-12 text-sm text-muted">
        <Link href="/" className="hover:text-primary">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
