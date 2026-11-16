/** Skeleton for the document tools: form column + A4 preview. */
export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading">
      <div className="h-[60px] bg-navy" />
      <div className="mx-auto grid max-w-[1500px] items-start gap-5 p-5 lg:grid-cols-[460px_1fr]">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-white ring-1 ring-slate-200" />
          ))}
        </div>
        <div className="mx-auto aspect-[210/297] w-full max-w-[794px] rounded bg-white shadow ring-1 ring-slate-200" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
