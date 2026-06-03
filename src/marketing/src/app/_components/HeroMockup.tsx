export default function HeroMockup() {
  return (
    <div
      role="img"
      aria-label="StackSift incident detail panel showing an AI root-cause analysis in progress."
      className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-xl md:p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-critical/15 text-critical border border-critical/30">
          OPEN
        </span>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-high/15 text-high border border-high/30">
          HIGH
        </span>
        <span className="ml-auto text-xs text-muted font-mono">INC-4821</span>
      </div>

      <div className="text-lg font-semibold">
        Redis connection timeout cascade
      </div>
      <div className="text-sm text-muted mt-1">5 alerts · started 2 min ago</div>

      <div className="mt-5 min-w-0 space-y-2">
        <div className="flex min-w-0 items-center gap-3 text-xs font-mono">
          <span className="shrink-0 text-muted">02:14:33</span>
          <span className="shrink-0 text-critical">ERROR</span>
          <span className="min-w-0 truncate">NullReferenceException at UserService.cs:142</span>
        </div>
        <div className="flex min-w-0 items-center gap-3 text-xs font-mono">
          <span className="shrink-0 text-muted">02:14:33</span>
          <span className="shrink-0 text-high">WARN</span>
          <span className="min-w-0 truncate">Redis connection timeout after 30000ms</span>
        </div>
        <div className="flex min-w-0 items-center gap-3 text-xs font-mono">
          <span className="shrink-0 text-muted">02:14:34</span>
          <span className="shrink-0 text-critical">ERROR</span>
          <span className="min-w-0 truncate">Database query exceeded timeout (pool exhausted)</span>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-lg bg-elevated border border-line">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-low opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-low" />
          </span>
          <span className="text-xs font-mono text-low uppercase tracking-wider">
            AI · analysing
          </span>
        </div>
        <div className="mt-3 text-sm text-muted leading-relaxed">
          Embedding incident context · searching pgvector for past resolutions
          · generating root-cause summary…
        </div>
      </div>
    </div>
  );
}
