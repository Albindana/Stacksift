import Link from "next/link";
import { ctaUrl } from "../_lib/cta";

export default function FinalCTA() {
  return (
    <section className="container-page py-20 border-t border-line text-center md:py-32">
      <h2 className="text-3xl md:text-5xl font-bold max-w-3xl mx-auto leading-tight">
        You are one ingest call away from never{" "}
        <span className="text-low">grepping log files at 2 AM</span> again.
      </h2>
      <Link
        href={ctaUrl("free", "final-cta")}
        className="plausible-event-name=cta-click plausible-event-tier=free mt-10 inline-block w-full rounded-lg bg-low px-8 py-4 text-lg font-medium text-white hover:opacity-90 sm:w-auto"
      >
        Start free →
      </Link>
    </section>
  );
}
