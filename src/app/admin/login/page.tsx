"use client";

import { useActionState, useRef } from "react";
import { loginAction } from "./actions";

const DEMO_EMAIL = "demo@salon.miepitettuk.hu";
const DEMO_PASSWORD = "DemoAdmin123";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fillDemoCredentials() {
    if (emailRef.current) emailRef.current.value = DEMO_EMAIL;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-primary-hover">
        Bloom Szépségszalon
      </p>
      <h1 className="mt-2 text-xl font-semibold text-ink">Admin belépés</h1>
      <p className="mt-1 text-sm text-ink-soft">Jelentkezz be a kezelőfelülethez.</p>

      <div className="mt-6 rounded-xl border border-dashed border-success/40 bg-success-soft/50 p-4 text-sm">
        <p className="font-medium text-ink">Demo admin belépés</p>
        <p className="mt-1 text-ink-soft">{DEMO_EMAIL}</p>
        <p className="text-ink-soft">{DEMO_PASSWORD}</p>
        <button
          type="button"
          onClick={fillDemoCredentials}
          className="mt-2 font-medium text-success underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          Kitöltés egy kattintással
        </button>
      </div>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            ref={emailRef}
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
            ref={passwordRef}
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
