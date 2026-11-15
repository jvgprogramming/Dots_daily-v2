"use client";

import { useState, useEffect, FormEvent } from "react";
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
      err.errors?.email?.[0] ??
      err.message ??
      "Failed to send reset link. Please try again."
    );
  }

  return err instanceof Error && err.message
    ? err.message
    : "Failed to send reset link. Please try again.";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      await api.post("/forgot-password", { email });
      setSent(true);
    } catch (err: unknown) {
      setError(resolveErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-text-primary">Reset password</h1>
        <p className="mt-2 text-[14px] text-text-secondary">
          {sent
            ? "Check your email for the reset link"
            : "Enter your email and we'll send you a reset link"}
        </p>
      </div>

      {sent ? (
        <Alert variant="success">
          If an account with that email exists, we&apos;ve sent a password reset link.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <Alert variant="danger">{error}</Alert>}

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-[13px] font-semibold text-text-primary"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="admin@dotsdaily.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <Button type="submit" className="h-11 w-full text-[14px]" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>
      )}

      {/* Back link */}
      <div className="mt-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
