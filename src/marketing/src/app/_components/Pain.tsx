export default function Pain() {
  const rows = [
    ["ERROR", "NullReferenceException at UserService.cs:142", "02:14:33"],
    ["WARN", "Redis connection timeout after 30000ms", "02:14:33"],
    ["ERROR", "Database query exceeded timeout (pool exhausted)", "02:14:34"],
  ] as const;

  return (
    <section className="container-page py-16 border-t border-line md:py-20">
      <div className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-4 md:hidden">
        <div className="space-y-3">
          {rows.map(([level, message, time]) => (
            <div key={`${level}-${message}`} className="grid min-w-0 gap-1">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span
                  className={
                    level === "ERROR" ? "text-critical" : "text-high"
                  }
                >
                  {level}
                </span>
                <span className="text-muted">{time}</span>
              </div>
              <div className="break-words text-sm font-mono text-primary">
                {message}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-md bg-elevated px-3 py-2 text-sm font-mono text-muted">
          395 more lines grouped into one incident
        </div>
      </div>

      <pre className="hidden font-mono text-sm md:block md:text-base overflow-x-auto p-6 bg-surface border border-line rounded-lg leading-relaxed">
{`[ERROR] 2026-03-27 02:14:33  NullReferenceException at UserService.cs:142
[WARN]  2026-03-27 02:14:33  Redis connection timeout after 30000ms
[ERROR] 2026-03-27 02:14:34  Database query exceeded timeout (pool exhausted)
[ERROR] 2026-03-27 02:14:34  NullReferenceException at UserService.cs:142
[ERROR] 2026-03-27 02:14:34  NullReferenceException at UserService.cs:142
... 395 more lines ...`}
      </pre>
      <p className="mt-6 text-2xl md:text-3xl font-semibold">
        45 minutes to 3 hours.{" "}
        <span className="text-muted">
          Average time to root cause. At 2 AM. On a Tuesday.
        </span>
      </p>
    </section>
  );
}
