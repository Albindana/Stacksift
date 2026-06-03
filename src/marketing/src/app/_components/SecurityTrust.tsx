type Point = { title: string; body: string };

const POINTS: readonly Point[] = [
  {
    title: "EU-hosted log storage",
    body: "Application data, databases, and log indexes run on Hetzner in Germany. Log data is isolated per organisation.",
  },
  {
    title: "No server agent",
    body: "Send logs through open-source SDKs or plain HTTP. You do not install a privileged daemon or give StackSift shell access.",
  },
  {
    title: "HTTP-only sessions",
    body: "Authentication is handled through OIDC + PKCE, and browser sessions use HTTP-only cookies rather than JavaScript-readable tokens.",
  },
];

export default function SecurityTrust() {
  return (
    <section className="container-page py-16 border-t border-line md:py-24">
      <h2 className="text-3xl md:text-4xl font-bold">Trust, by design.</h2>
      <div className="mt-10 grid md:grid-cols-3 gap-6">
        {POINTS.map((p) => (
          <div
            key={p.title}
            className="p-6 bg-surface border border-line rounded-lg"
          >
            <div className="text-lg font-semibold">{p.title}</div>
            <p className="mt-2 text-muted">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
