export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Carregando conteúdo</span>
      <div className="skeleton mb-8 h-9 w-64 rounded-lg" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-xl"
            style={{ border: "1px solid var(--card-border)" }}
            aria-hidden="true"
          >
            <div className="skeleton aspect-[16/10]" />
            <div className="space-y-3 p-5">
              <div className="skeleton h-5 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-4 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
