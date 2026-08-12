"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-primary-hover">
        Bloom Szépségszalon
      </p>
      <h1 className="mt-2 text-xl font-semibold text-ink">Admin belépés</h1>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded-xl border border-border bg-card px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Jelszó</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-xl border border-border bg-card px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>

        {state?.error && (
          <p role="alert" className="rounded-xl bg-danger-soft text-danger text-sm p-3">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-xl bg-primary text-white font-semibold py-3 disabled:opacity-50 hover:bg-primary-hover transition-colors"
        >
          {pending ? "Belépés…" : "Belépés"}
        </button>
      </form>
    </main>
  );
}
