import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts";
import { useReturnUrl, withReturnUrl } from "../../hooks";
import { Button, Field, Input } from "../../components";

export const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const returnUrl = useReturnUrl();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const result = await signup(name, email, password);

    if (result.success) {
      navigate(returnUrl, { replace: true });
    } else {
      setError(result.error || "Signup failed. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-[80dvh] flex items-center justify-center bg-transparent transition-colors">
      <div className="max-w-md w-full bg-white/10 dark:bg-slate-900/50 backdrop-blur-sm border border-white/10 dark:border-white/10 rounded-2xl shadow-xl p-5 sm:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/images/branding/showtime-logo.png"
            alt="SFFL Logo"
            className="w-20 h-20 mx-auto mb-4 bg-white rounded-full p-2"
          />
          <h1 className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white">
            Join SFFL
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create your fan account for exclusive discounts
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full Name" htmlFor="signup-name">
            <Input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="John Doe"
            />
          </Field>

          <Field label="Email Address" htmlFor="signup-email">
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" htmlFor="signup-password">
            <Input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </Field>

          <Field label="Confirm Password" htmlFor="signup-confirm-password">
            <Input
              id="signup-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </Field>

          <Button type="submit" fullWidth size="lg" loading={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </Button>
        </form>

        {/* Benefits */}
        <div className="mt-6 p-4 bg-linear-to-r from-sffl-navy to-sffl-red text-white rounded-lg">
          <p className="font-bold mb-2">Fan Benefits:</p>
          <ul className="text-sm space-y-1">
            {[
              "Exclusive ticket discounts",
              "Early access to match tickets",
              "Special fan zone content",
            ].map((benefit) => (
              <li key={benefit} className="flex items-center gap-1.5">
                <CheckIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Login Link */}
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Already have an account?{" "}
          <Link
            to={withReturnUrl("/login", returnUrl)}
            state={{ returnUrl }}
            className="relative after:absolute after:-inset-y-3 after:inset-x-0 text-sffl-red font-bold hover:text-red-600 dark:hover:text-red-400 hover:underline transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
