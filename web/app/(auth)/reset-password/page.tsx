"use client";

import { useState, useEffect, Suspense, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Loader2, ArrowLeft } from "lucide-react";

/** Pull the field-level validation text out of a failed API call. */
function resolveErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return (
      err.errors?.password?.[0] ??
      err.errors?.token?.[0] ??
      err.errors?.email?.[0] ??
      err.message ??
      "Unable to reset your password. Please try again."
    );
  }

  return err instanceof Error && err.message
    ? err.message
    : "Unable to reset your password. Please try again.";
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Auto-dismiss the message after 5 seconds so it never lingers on screen.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/reset-password", {
        token,
        email,
        password,
        password_confirmation: confirmation,
      });
      setDone(true);
    } catch (err: unknown) {
      setError(resolveErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const linkBroken = !token || !email;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-text-primary">Set a new password</h1>
        <p className="mt-2 text-[14px] text-text-secondary">
          {done
            ? "Your password has been updated"
            : "Choose a new password for your account"}
        </p>
      </div>

      {linkBroken ? (
        <Alert variant="danger">
          This reset link is incomplete or has expired. Request a new one from the
          forgot password page.
        </Alert>
      ) : done ? (
        <div className="space-y-5">
          <Alert variant="success">
            Your password has been reset. Sign in with your new password.
          </Alert>
          <Link href="/login" className="block">
            <Button className="h-11 w-full text-[14px]">Back to sign in</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <Alert variant="danger">{error}</Alert>}

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-[13px] font-semibold text-text-primary">
              New password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password_confirmation" className="block text-[13px] font-semibold text-text-primary">
              Confirm new password
            </label>
            <Input
              id="password_confirmation"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="h-11 w-full text-[14px]" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>
      )}

      {/* Back link */}
      <div className="mt-8">
        <Link
          href={linkBroken ? "/forgot-password" : "/login"}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {linkBroken ? "Request a new link" : "Back to sign in"}
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
