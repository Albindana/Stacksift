import Image from "next/image";

type Link = { label: string; href: string };
type Column = { title: string; links: readonly Link[] };

const COLS: readonly Column[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#how-it-works" },
      { label: "Pricing", href: "/#pricing" },
      {
        label: "Changelog",
        href: "https://github.com/drdtrn/StackSift/releases",
      },
    ],
  },
  {
    title: "Docs",
    links: [
      {
        label: "Quickstart",
        href: "https://github.com/drdtrn/StackSift/tree/main/docs/integrate",
      },
      {
        label: "Serilog sink (.NET)",
        href: "https://github.com/drdtrn/StackSift/tree/main/src/backend/StackSift.Serilog.Sink",
      },
      {
        label: "Winston transport (Node)",
        href: "https://github.com/drdtrn/StackSift/tree/main/sdks/winston-transport",
      },
      {
        label: "API reference",
        href: "https://github.com/drdtrn/StackSift/blob/main/docs/integrate/api-reference.md",
      },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      {
        label: "Capstone (LIFE Fellows 2026)",
        href: "https://github.com/drdtrn/StackSift",
      },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Subprocessors", href: "/subprocessors" },
    ],
  },
];

function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export default function Footer() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

  return (
    <footer className="border-t border-line py-12 md:py-16">
      <div className="container-page grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <Image
              src="/stacksifticon.png"
              alt=""
              width={40}
              height={40}
              className="h-9 w-auto shrink-0 rounded"
            />
            <Image
              src="/namestacksifticon.png"
              alt="StackSift"
              width={120}
              height={28}
              className="h-5 w-auto shrink-0"
            />
          </div>
          <p className="mt-3 text-sm text-muted">
            AI-powered SRE & log-analysis platform.
          </p>
        </div>
        {COLS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <div className="text-sm font-semibold uppercase tracking-wider text-muted">
              {col.title}
            </div>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="block py-1 text-sm hover:text-primary"
                    {...(isExternal(l.href)
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="container-page mt-12 flex flex-col md:flex-row md:justify-between gap-2 text-xs text-muted">
        <span>© 2026 StackSift</span>
        <span className="font-mono">build {commit}</span>
      </div>
    </footer>
  );
}
