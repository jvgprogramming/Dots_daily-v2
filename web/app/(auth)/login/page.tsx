"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/store/auth";
import { Loader2, Eye, EyeOff, User, Lock, Plus } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({ email: username, password });
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Invalid username or password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full flex flex-col items-center px-4 py-8">

      <div className="glass-card w-full max-w-[440px] px-8 pb-8 pt-9 sm:px-10">
        {/* Logo */}
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/imports/image-2.png"
            alt="Capiz Emmanuel Hospital logo"
            className="h-16 w-16 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        {/* Hospital badge */}
        <div className="mb-5 flex justify-center">
          <span className="rounded-full border border-border-light bg-white px-4 py-1.5 text-xs font-semibold text-primary-700 shadow-sm">
            Capiz Emmanuel Hospital –{" "}
            <span className="text-primary-900">TB DOTS Center</span>
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-center font-display text-[34px] leading-tight font-semibold text-text-primary">
          Welcome Back!
        </h1>
        <p className="mt-1.5 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
          TB Treatment Monitoring · DOTS Daily
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-danger/15 bg-danger-bg px-3 py-2 text-sm text-danger-text"
            >
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Username
            </label>
            <div className="relative">
              <input
                id="username"
                name="username"
                autoComplete="username"
                className="login-input w-full bg-transparent py-2 pr-9 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
              <User className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="login-input w-full bg-transparent py-2 pr-9 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-text-muted transition-colors hover:text-text-secondary"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
            >
              Forgot Password?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-green-800 to-green-600 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[0_8px_20px_rgba(22,101,52,0.35)] transition-all hover:from-green-700 hover:to-green-500 hover:shadow-[0_10px_24px_rgba(22,101,52,0.4)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying…
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* TB information strip */}


        {/* Footer */}
     
      </div>

      {/* Small medical cross below the card */}
      <div className="mt-5 opacity-40" aria-hidden>
        <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      {/* Decorative floating medical bubbles */}
      <div className="bubble bubble-a" aria-hidden>
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <g className="icon-fill">
            <circle cx="32" cy="32" r="30" />
          </g>
          <g className="icon-stroke">
            {/* Lungs */}
            <path d="M22 18c-6 6-4 18 2 24 4 4 8 4 12 0 6-6 8-18 2-24" />
            <path d="M32 22v12" />
          </g>
        </svg>
      </div>

      <div className="bubble bubble-b" aria-hidden>
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <g className="icon-fill">
            <circle cx="32" cy="32" r="30" />
          </g>
          <g className="icon-stroke">
            {/* Heartbeat / ECG */}
            <polyline points="6,36 20,36 26,24 34,44 42,20 58,36" />
          </g>
        </svg>
      </div>

      <div className="bubble bubble-c" aria-hidden>
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <g className="icon-fill">
            <circle cx="32" cy="32" r="30" />
          </g>
          <g className="icon-stroke">
            {/* TB bacterium */}
            <circle cx="32" cy="32" r="8" />
            <path d="M12 10 L16 14" />
            <path d="M52 10 L48 14" />
            <path d="M12 54 L16 50" />
            <path d="M52 54 L48 50" />
            <path d="M32 4 L32 12" />
            <path d="M32 52 L32 60" />
          </g>
        </svg>
      </div>

      <div className="bubble bubble-d" aria-hidden>
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <g className="icon-fill">
            <circle cx="32" cy="32" r="30" />
          </g>
          <g className="icon-stroke">
            {/* Pill */}
            <rect x="14" y="26" width="36" height="12" rx="6" />
            <line x1="32" y1="26" x2="32" y2="38" />
          </g>
        </svg>
      </div>

      {/* Thin white ECG line near the bottom */}
      <svg
        className="ecg-line"
        viewBox="0 0 1440 48"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 24 H420 l18-14 14 28 12-22 10 8 h130 l16-12 12 24 10-18 8 6 H1440"
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <Suspense
        fallback={
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:-0.3s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:-0.15s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-primary-600" />
            </div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
