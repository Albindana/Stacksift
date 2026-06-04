import Link from "next/link";
import { ctaUrl } from "../_lib/cta";
import HeroMockup from "./HeroMockup";

export default function Hero() {
  return (
    <section className="container-page pt-12 pb-16 md:pt-28 md:pb-32">
      <div className="grid min-w-0 gap-10 md:grid-cols-2 md:gap-12 items-center">
        <div className="min-w-0">
          <h1 className="max-w-full text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-6xl md:leading-[1.05]">
            Tell me what <span className="text-critical">just broke</span>.
            <br />
            In plain English. In seconds.
          </h1>
          <p className="mt-6 text-lg text-muted max-w-xl">
            StackSift watches your logs, fires alerts when something cascades,
            and explains the root cause with AI — built for solo devs and small
            teams, priced for them too.
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
            <Link
              href={ctaUrl("free", "hero-primary")}
              className="plausible-event-name=cta-click plausible-event-tier=free rounded-lg bg-low px-6 py-3 text-center font-medium text-white hover:opacity-90"
            >
              Start free →
            </Link>
            <a
              href="#demo"
              data-plausible-event-name="demo-modal-cta"
              className="rounded-lg border border-line px-6 py-3 text-center text-primary hover:bg-elevated"
            >
              Watch the 90-second demo
            </a>
            <a
              href="#pricing"
              className="rounded-lg px-6 py-3 text-center text-muted hover:text-primary"
            >
              See pricing
            </a>
          </div>
        </div>
        <HeroMockup />
      </div>
    </section>
  );
}
