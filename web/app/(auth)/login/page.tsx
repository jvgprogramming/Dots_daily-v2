"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/store/auth";
import { ApiError } from "@/lib/services/api";
import { safeRedirect } from "@/lib/access";
import { Loader2, Eye, EyeOff, User, Lock, AlertCircle } from "lucide-react";

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
      const user = await login({ email: username, password });
      router.push(safeRedirect(user.role, searchParams.get("redirect")));
    } catch (err: unknown) {
      setError(resolveErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
          {/* Heading */}
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-text-primary">
            Welcome Back!
          </h1>
          <p className="mt-2 text-[14px] text-text-secondary">
            TB Treatment Monitoring · DOTS Daily
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[10px] border border-danger/25 bg-danger-bg px-3.5 py-3 text-[13px] leading-relaxed text-danger-text"
              >
                <AlertCircle className="mt-[2px] h-4 w-4 shrink-0" strokeWidth={2} />
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-[13px] font-semibold text-text-primary"
              >
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  className="login-input w-full bg-bg-card py-2 pl-10 pr-10 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" strokeWidth={1.9} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[13px] font-semibold text-text-primary"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="login-input w-full bg-bg-card py-2 pl-10 pr-10 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" strokeWidth={1.9} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[6px] p-1 text-text-muted transition-colors hover:text-text-body"
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
                className="text-[13px] font-semibold text-primary-700 transition-colors hover:text-primary-900"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-[10px] bg-brand-action text-[14px] font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-action-hover disabled:cursor-not-allowed disabled:opacity-60"
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
