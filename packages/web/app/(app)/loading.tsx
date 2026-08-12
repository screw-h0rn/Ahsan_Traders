export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading page">
      <div className="flex flex-col gap-3">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[26px] border border-white/80 bg-white/55 p-6 shadow-[0_18px_44px_-20px_rgba(40,70,60,0.3)] backdrop-blur-2xl"
          >
            <div className="skeleton h-4 w-24" />
            <div className="skeleton mt-4 h-8 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-[26px] border border-white/80 bg-white/55 p-6 shadow-[0_18px_44px_-20px_rgba(40,70,60,0.3)] backdrop-blur-2xl">
        <div className="skeleton h-5 w-40" />
        <div className="mt-5 flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
