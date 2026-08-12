import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-primary-hover">Bloom Szépségszalon</p>
      <h1 className="mt-4 max-w-md text-3xl font-semibold text-ink sm:text-4xl">
        Foglalj időpontot percek alatt
      </h1>
      <p className="mt-4 max-w-sm text-ink-soft">
        Hajvágás, festés, manikűr és még sok más — válaszd ki, mire van szükséged, és mi
        összehangoljuk a többit.
      </p>
      <Link
        href="/foglalas"
        className="mt-8 rounded-xl bg-primary px-8 py-3.5 font-semibold text-white shadow-soft transition-colors hover:bg-primary-hover"
      >
        Időpont foglalása
      </Link>
    </main>
  );
}
