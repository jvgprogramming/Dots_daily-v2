"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useAuth } from "@/lib/store/auth";
import { ApiError } from "@/lib/services/api";
import { safeRedirect } from "@/lib/access";
import { PageLoader } from "@/components/ui/page-loader";
import { Loader2, Eye, EyeOff, User, Lock, AlertCircle, ArrowRight } from "lucide-react";

/* Form pieces rise in one after another once the card has popped in. */
const stack: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

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
    <motion.div variants={stack} initial="hidden" animate="show">
      {/* Heading */}
      <motion.span
        variants={rise}
        className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-[12px] font-semibold text-primary-700 ring-1 ring-primary-100"
      >
        <span className="auth-live-dot" aria-hidden="true" />
        Staff portal
      </motion.span>
      <motion.h1
        variants={rise}
        className="mt-4 text-[30px] font-bold leading-tight tracking-[-0.025em] text-text-primary"
      >
        Welcome Back!
      </motion.h1>
      <motion.p variants={rise} className="mt-2 text-[14px] text-text-secondary">
        TB Treatment Monitoring · DOTS Daily
      </motion.p>

      <form onSubmit={handleSubmit} className="mt-8">
        {/* Error pops in and collapses away instead of jolting the form. */}
        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0, scale: 0.96 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="overflow-hidden"
            >
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-danger/25 bg-danger-bg px-3.5 py-3 text-[13px] leading-relaxed text-danger-text"
              >
                <AlertCircle className="mt-[2px] h-4 w-4 shrink-0" strokeWidth={2} />
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-5">
          {/* Username */}
          <motion.div variants={rise}>
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
                className="login-input peer w-full bg-bg-card py-2 pl-10 pr-10 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
              {/* `peer-focus:` recolours the icon while its sibling input has focus. */}
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary transition-colors peer-focus:text-primary-600" strokeWidth={1.9} />
            </div>
          </motion.div>

          {/* Password */}
          <motion.div variants={rise}>
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
                className="login-input peer w-full bg-bg-card py-2 pl-10 pr-10 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary transition-colors peer-focus:text-primary-600" strokeWidth={1.9} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[6px] p-1 text-text-muted transition-colors hover:text-text-body"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {/* mode="wait" lets the old icon spin out before the new one spins in. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={showPassword ? "hide" : "show"}
                    initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                    transition={{ duration: 0.18 }}
                    className="block"
                  >
                    {showPassword ? (
                      <EyeOff className="h-[15px] w-[15px]" strokeWidth={1.75} />
                    ) : (
                      <Eye className="h-[15px] w-[15px]" strokeWidth={1.75} />
                    )}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
          </motion.div>

          {/* Forgot password */}
          <motion.div variants={rise} className="-mt-1 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-[13px] font-semibold text-primary-700 transition-colors hover:text-primary-900"
            >
              Forgot Password?
            </Link>
          </motion.div>

          {/* Submit */}
          <motion.div variants={rise}>
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={loading ? undefined : { y: -2 }}
              whileTap={loading ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="auth-submit group h-11 w-full rounded-[10px] bg-brand-action text-[14px] font-semibold text-white transition-colors duration-150 hover:bg-brand-action-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  Sign In
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.2} />
                </span>
              )}
            </motion.button>
          </motion.div>
        </div>
      </form>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginForm />
    </Suspense>
  );
}
