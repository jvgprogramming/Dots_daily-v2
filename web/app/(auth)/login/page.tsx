"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/store/auth";
import { ApiError } from "@/lib/services/api";
import { Loader2, Eye, EyeOff, User, Lock } from "lucide-react";

/** Pull the field-level validation text out of a failed API call. */
function resolveErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return (
      err.errors?.email?.[0] ??
      err.errors?.password?.[0] ??
      err.message ??
      "Unable to sign in. Please try again."
    );
  }

  return err instanceof Error && err.message
    ? err.message
    : "Unable to sign in. Please try again.";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-dismiss the message after 5 seconds so it never lingers on screen.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({ email: username, password });
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(resolveErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="auth-panel px-8 pb-8 pt-9 sm:px-10">
          {/* Logo */}
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center overflow-hidden rounded-[12px] border border-border-light bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/imports/image-2.png"
              alt="Capiz Emmanuel Hospital logo"
              className="h-11 w-11 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          {/* Hospital badge */}
          <div className="mb-6 flex justify-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Capiz Emmanuel Hospital –{" "}
              <span className="text-primary-900">TB DOTS Center</span>
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-center text-[26px] font-semibold leading-tight tracking-[-0.025em] text-text-primary">
            Welcome Back!
          </h1>
          <p className="mt-2 text-center text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-secondary">
            TB Treatment Monitoring · DOTS Daily
          </p>

          <div className="my-7 h-px bg-border-light" />

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div
                role="alert"
                className="rounded-[8px] border border-danger/20 bg-danger-bg px-3 py-2.5 text-[12.5px] leading-relaxed text-danger-text"
              >
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-[12px] font-medium tracking-[0.01em] text-text-body"
              >
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  className="login-input w-full bg-transparent py-2 pr-9 text-[13.5px] text-text-primary placeholder:text-text-muted focus:outline-none"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
                <User className="pointer-events-none absolute right-1 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[12px] font-medium tracking-[0.01em] text-text-body"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="login-input w-full bg-transparent py-2 pr-9 text-[13.5px] text-text-primary placeholder:text-text-muted focus:outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-text-muted transition-colors hover:text-text-body"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-[15px] w-[15px]" strokeWidth={1.75} />
                  ) : (
                    <Eye className="h-[15px] w-[15px]" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="-mt-1 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-[12px] font-medium text-primary-700 transition-colors hover:text-primary-900"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[9px] bg-brand-action py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition-colors duration-150 hover:bg-brand-action-hover disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-canvas flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400 [animation-delay:-0.3s]" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500 [animation-delay:-0.15s]" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-600" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
