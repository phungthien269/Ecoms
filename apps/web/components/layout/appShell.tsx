import type { Route } from "next";
import Link from "next/link";
import { loginBuyerDemo, loginSellerDemo, logoutDemo } from "@/app/actions/auth";
import type { DemoSession } from "@/lib/session";

export function AppShell({
  children,
  session
}: {
  children: React.ReactNode;
  session: DemoSession | null;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7f3_0%,#ffffff_28%,#fffaf5_100%)]">
      <header className="sticky top-0 z-20 border-b border-orange-100/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href={"/" as Route} className="text-xl font-black tracking-tight text-slate-950">
              Ecoms
            </Link>
            <nav className="hidden items-center gap-4 text-sm font-medium text-slate-600 md:flex">
              <Link href={"/products" as Route} className="transition hover:text-orange-600">
                Products
              </Link>
              <Link href={"/cart" as Route} className="transition hover:text-orange-600">
                Cart
              </Link>
              <Link href={"/checkout" as Route} className="transition hover:text-orange-600">
                Checkout
              </Link>
              <Link href={"/orders" as Route} className="transition hover:text-orange-600">
                Orders
              </Link>
              {session?.role === "SELLER" ? (
                <Link href={"/seller" as Route} className="transition hover:text-orange-600">
                  Seller Center
                </Link>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <>
                <div className="hidden rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700 sm:block">
                  {session.email}
                </div>
                <form action={logoutDemo}>
                  <button
                    type="submit"
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                  >
                    Logout demo
                  </button>
                </form>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <form action={loginBuyerDemo}>
                  <button
                    type="submit"
                    className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    Buyer demo
                  </button>
                </form>
                <form action={loginSellerDemo}>
                  <button
                    type="submit"
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                  >
                    Seller demo
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
