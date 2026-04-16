const highlights = [
  "Marketplace-first modular monolith",
  "SEO-ready storefront + seller/admin surfaces",
  "Checkout, payments, chat, and promotions roadmap"
];

export function HeroShell() {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-8 rounded-[2rem] bg-slate-950 px-6 py-10 text-slate-50 shadow-2xl shadow-orange-200/60 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
        <div className="space-y-6">
          <span className="inline-flex rounded-full border border-orange-300/30 bg-orange-500/10 px-3 py-1 text-sm text-orange-200">
            Phase 1 foundation in progress
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              Build a Shopee-inspired marketplace without collapsing the domain boundaries.
            </h1>
            <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
              This workspace bootstraps the storefront, API, and shared contracts so core commerce
              modules can grow on a stable foundation.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[1.5rem] bg-gradient-to-br from-orange-500 via-red-500 to-amber-300 p-[1px]">
          <div className="flex h-full flex-col justify-between rounded-[calc(1.5rem-1px)] bg-slate-950 p-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-orange-200">Current Slice</p>
              <h2 className="mt-3 text-2xl font-bold">Foundation</h2>
            </div>
            <dl className="space-y-4 text-sm text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <dt>Frontend shell</dt>
                <dd>Next.js App Router</dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <dt>Backend shell</dt>
                <dd>NestJS + Prisma</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Local infra</dt>
                <dd>Postgres + Redis</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
