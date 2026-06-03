import DemoVideoModal from "./DemoVideoModal";

export default function DemoVideo() {
  return (
    <section id="demo" className="container-page py-16 border-t border-line md:py-24">
      <h2 className="text-3xl md:text-4xl font-bold">
        90 seconds. The whole pitch.
      </h2>
      <p className="mt-3 text-muted max-w-2xl">
        A real local stack. Real OpenAI call. No edits, no cuts.
      </p>
      <div className="mt-8">
        <DemoVideoModal />
      </div>
      <details className="mt-8 group">
        <summary className="cursor-pointer text-muted hover:text-primary list-none flex items-center gap-2">
          <span className="text-xl group-open:rotate-90 transition-transform inline-block">
            ›
          </span>
          <span>Transcript</span>
        </summary>
        <div className="mt-4 text-muted leading-relaxed">
          The demo walks through connecting a local service, triggering a
          cascading incident, and using the AI analysis to identify the
          root-cause log line without leaving the incident view.
        </div>
      </details>
    </section>
  );
}
