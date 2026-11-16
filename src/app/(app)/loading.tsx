/** Instant skeleton shown while any (app) route streams in. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-6 py-8" role="status" aria-label="Loading">
      <div className="h-7 w-64 rounded-lg bg-slate-200" />
      <div className="mb-6 mt-3 h-4 w-96 max-w-full rounded bg-slate-200/70" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl glass" />
        ))}
      </div>
      <div className="rounded-2xl glass p-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 py-3 last:border-0">
            <div className="h-4 w-1/4 rounded bg-slate-200" />
            <div className="h-4 w-1/5 rounded bg-slate-200/70" />
            <div className="ml-auto h-6 w-24 rounded-full bg-slate-200/70" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
