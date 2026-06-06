import Link from "next/link";
import { ctaUrl } from "../_lib/cta";

const NAV_LINKS = [
  { label: "Demo", href: "/#demo" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  {
    label: "Docs",
    href: "https://github.com/drdtrn/StackSift/tree/main/docs/integrate",
  },
] as const;

function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="container-page flex min-h-16 items-center justify-between gap-4">
        <Link href="/" className="text-base font-bold tracking-tight">
          StackSift
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted hover:text-primary"
              {...(isExternal(link.href)
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {link.label}
            </a>
          ))}
          <Link
            href={ctaUrl("free", "header")}
            className="plausible-event-name=cta-click plausible-event-tier=free rounded-lg bg-low px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Start free
          </Link>
        </nav>

        <details className="group relative md:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-line px-3 text-sm font-semibold text-primary">
            Menu
          </summary>
          <div className="absolute right-0 top-13 w-[calc(100vw-3rem)] rounded-lg border border-line bg-canvas p-3 shadow-xl">
            <nav aria-label="Mobile primary" className="grid gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="rounded-md px-3 py-3 text-sm font-medium text-primary hover:bg-surface"
                  {...(isExternal(link.href)
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {link.label}
                </a>
              ))}
              <Link
                href={ctaUrl("free", "mobile-header")}
                className="plausible-event-name=cta-click plausible-event-tier=free mt-2 rounded-lg bg-low px-3 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
              >
                Start free
              </Link>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
