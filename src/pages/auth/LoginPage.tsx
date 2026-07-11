import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * LoginPage — email + password sign in.
 *
 * On success the user is redirected to /dashboard.
 * A "Forgot password?" link routes to /forgot-password and a
 * "Don't have an account?" link routes to /register.
 */
export default function LoginPage() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (!password) {
      next.password = "Password is required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await signIn("password", {
        email: email.trim(),
        password,
        flow: "signIn",
      });
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err: any) {
      const message =
        err?.message ?? err?.toString?.() ?? "Sign in failed. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Welcome back</h2>
        <p className="mt-1.5 text-sm text-dark-400">
          Sign in to your ClickEarn Pro account to continue earning.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="login-email" className="label">
            Email Address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              id="login-email"
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
          <label htmlFor="login-password" className="label">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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

        {/* Forgot password */}
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary-400 transition-colors hover:text-primary-300"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Signing in…
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" fill="currentColor" />
              Sign In
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-8 text-center text-sm text-dark-400">
        Don't have an account?{" "}
        <Link
          to="/register"
          className="inline-flex items-center gap-1 font-semibold text-primary-400 transition-colors hover:text-primary-300"
        >
          Sign up
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </div>
  );
}
