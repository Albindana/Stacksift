type QA = { q: string; a: readonly string[] };

const ENTRIES: readonly QA[] = [
  {
    q: "How is this different from Datadog?",
    a: [
      "Cheaper, simpler, and the AI summary is built in — not an add-on.",
      "StackSift is designed for one engineer or a small team. Datadog is designed around larger SRE organizations.",
    ],
  },
  {
    q: "How do I send logs to StackSift?",
    a: [
      "Use the official Serilog sink for .NET, the Winston transport for Node.js, or direct HTTP POST from any language.",
      "All three options hit the same /api/v1/logs/ingest endpoint and keep setup small.",
    ],
  },
  {
    q: "What happens if I exceed the AI-analysis cap?",
    a: [
      "The Analyze button returns a graceful upgrade nudge. Log ingest, search, and alerts keep working.",
      "You can upgrade in-app or wait until the month resets.",
    ],
  },
  {
    q: "Do I need to change my application code?",
    a: [
      "Yes, lightly. You add the StackSift sink or transport to your existing logger.",
      "We do not run an agent on your servers and we do not tail files from disk.",
    ],
  },
  {
    q: "How is my data isolated from other customers?",
    a: [
      "Every entity carries an OrganizationId enforced at the repository level.",
      "Elasticsearch indices, S3 keys, and SignalR groups are scoped per organization or project.",
    ],
  },
  {
    q: "Can I delete my data?",
    a: [
      "Yes. Deleting your account starts a 30-day grace period with a one-time restore token.",
      "After that, we hard-delete organisation rows, Elasticsearch indices, and S3 objects, except records with legal retention floors.",
    ],
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="container-page py-16 border-t border-line md:py-24">
      <h2 className="text-3xl md:text-4xl font-bold">
        Questions, before you start.
      </h2>
      <div className="mt-10 max-w-3xl">
        {ENTRIES.map(({ q, a }) => (
          <details key={q} className="group border-b border-line py-5">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
              <span>{q}</span>
              <span className="text-muted text-2xl transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="mt-3 space-y-3 text-muted leading-relaxed">
              {a.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
