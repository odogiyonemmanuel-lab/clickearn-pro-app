import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Mail, ArrowLeft, ArrowRight, AlertCircle, CheckCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * ForgotPasswordPage — request a password reset link.
 *
 * Triggers Convex Auth's password "reset" flow, which emails the user a
 * secure reset link. On success we show a confirmation state telling the
 * user to check their inbox.
 */
export default function ForgotPasswordPage() {
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await signIn("password", {
        email: email.trim(),
        flow: "reset",
      });
      setSubmitted(true);
      toast.success("Reset link sent! Check your email.");
    } catch (err: any) {
      const message =
        err?.message ?? err?.toString?.() ?? "Failed to send reset link. Please try again.";
      // Many password providers return a generic error or no-op for unknown
      // emails to avoid account enumeration. We still show the success
      // state so the UX is consistent.
      if (
        typeof message === "string" &&
        /not found|no account|doesn't exist|invalid/i.test(message)
      ) {
        setSubmitted(true);
        toast.success("If that email exists, a reset link has been sent.");
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------- Success state ---------- */
  if (submitted) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Check your email</h2>
          <p className="mt-1.5 text-sm text-dark-400">
            We've sent a password reset link to your inbox.
          </p>
        </div>

        <div className="card p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-500/15 ring-1 ring-secondary-500/20">
            <CheckCircle className="h-7 w-7 text-secondary-400" />
          </div>
          <p className="text-sm text-dark-300">
            If an account exists for{" "}
            <span className="font-semibold text-white">{email.trim()}</span>, you'll
            receive an email with instructions to reset your password.
          </p>
          <p className="mt-3 text-xs text-dark-500">
            Didn't get the email? Check your spam folder, or try again in a few minutes.
          </p>
        </div>

        <Link
          to="/login"
          className="btn btn-secondary mt-6 w-full"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </Link>

        <p className="mt-6 text-center text-sm text-dark-400">
          Still need help?{" "}
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="font-semibold text-primary-400 transition-colors hover:text-primary-300"
          >
            Try a different email
          </button>
        </p>
      </div>
    );
  }

  /* ---------- Form state ---------- */
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Forgot password?</h2>
        <p className="mt-1.5 text-sm text-dark-400">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="forgot-email" className="label">
            Email Address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={cn("input pl-10", error && "input-error")}
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          {error && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-error-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
        </div>

        {/* Submit */}
        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Sending link…
            </>
          ) : (
            <>
              Send Reset Link
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <Link
        to="/login"
        className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-dark-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Sign In
      </Link>
    </div>
  );
}
