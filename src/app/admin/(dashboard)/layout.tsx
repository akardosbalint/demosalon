import Link from "next/link";
import { getCurrentAdmin } from "@/lib/auth";
import { logoutAction } from "../login/actions";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="font-semibold text-ink whitespace-nowrap">Bloom · Admin</p>
          <div className="flex items-center gap-2">
            {admin && <span className="hidden md:inline text-sm text-ink-soft">{admin.name}</span>}
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-card transition-colors"
              >
                Kilépés
              </button>
            </form>
          </div>
          <nav className="flex gap-1 basis-full sm:basis-auto">
            <Link
              href="/admin/naptar"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-primary-soft hover:text-ink transition-colors"
            >
              Naptár
            </Link>
            <Link
              href="/admin/statisztika"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-primary-soft hover:text-ink transition-colors"
            >
              Statisztika
            </Link>
            <Link
              href="/admin/munkarend"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-primary-soft hover:text-ink transition-colors"
            >
              Munkarend
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
