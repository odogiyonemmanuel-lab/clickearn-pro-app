import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Zap, Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, Gift,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn } from "../../lib/utils";

/**
 * RegisterPage — create a new ClickEarn Pro account.
 *
 * After the Convex Auth `signIn("password", { flow: "signUp" })` call
 * succeeds, we run `api.users.initializeNewUser` to create the user's
 * wallet, referral code, welcome notification, and link any referral.
 * The optional referral code is pre-filled from the `?ref=` URL param.
 */
export default function RegisterPage() {
  const { signIn } = useAuthActions();
  const initializeNewUser = useMutation(api.users.initializeNewUser as any);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState(
    searchParams.get("ref") ?? ""
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!name.trim()) {
      next.name = "Full name is required";
    } else if (name.trim().length < 2) {
      next.name = "Name must be at least 2 characters";
    }
    if (!email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (!password) {
      next.password = "Password is required";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters";
    }
    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // 1. Create the auth account via Convex Auth.
      await signIn("password", {
        email: email.trim(),
        password,
        name: name.trim(),
        flow: "signUp",
      });

      // 2. Initialize the wallet, referral code, and referral link.
      const trimmedCode = referralCode.trim();
      try {
        await initializeNewUser({
          referralCode: trimmedCode || undefined,
        });
      } catch (initErr: any) {
        // Initialization is best-effort after auth succeeds — don't block
        // the user, but surface a warning so they can retry from profile.
        console.warn("initializeNewUser failed:", initErr);
        toast.error(
          "Account created, but profile setup needs a moment. Please refresh if something looks off."
        );
      }

      if (trimmedCode) {
        toast.success("Account created! Referral linked.");
      } else {
        toast.success("Welcome to ClickEarn Pro!");
      }
      navigate("/dashboard");
    } catch (err: any) {
      const message =
        err?.message ?? err?.toString?.() ?? "Registration failed. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Create your account</h2>
        <p className="mt-1.5 text-sm text-dark-400">
          Join ClickEarn Pro and start earning from tasks, referrals, and bonuses.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Name */}
        <div>
          <label htmlFor="register-name" className="label">
            Full Name
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className={cn("input pl-10", errors.name && "input-error")}
              disabled={isSubmitting}
            />
          </div>
          {errors.name && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-error-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.name}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="register-email" className="label">
            Email Address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={cn("input pl-10", errors.email && "input-error")}
              disabled={isSubmitting}
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-error-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="register-password" className="label">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={cn("input pl-10 pr-10", errors.password && "input-error")}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 transition-colors hover:text-dark-300"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-error-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.password}
            </p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="register-confirm" className="label">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              id="register-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className={cn("input pl-10", errors.confirmPassword && "input-error")}
              disabled={isSubmitting}
            />
          </div>
          {errors.confirmPassword && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-error-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {/* Referral code (optional) */}
        <div>
          <label htmlFor="register-ref" className="label">
            Referral Code <span className="text-dark-500">(optional)</span>
          </label>
          <div className="relative">
            <Gift className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              id="register-ref"
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="Enter a friend's referral code"
              className="input pl-10"
              disabled={isSubmitting}
            />
          </div>
          <p className="mt-1.5 text-xs text-dark-500">
            Referred by a friend? Enter their code to link your account.
          </p>
        </div>

        {/* Submit */}
        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Creating account…
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" fill="currentColor" />
              Create Account
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-8 text-center text-sm text-dark-400">
        Already have an account?{" "}
        <Link
          to="/login"
          className="inline-flex items-center gap-1 font-semibold text-primary-400 transition-colors hover:text-primary-300"
        >
          Sign in
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </div>
  );
}
