import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { claimApi } from "../../services/api";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { Spinner } from "../../components";

/**
 * Landing page for the confirm-your-email link. Verification is informational: it proves
 * the account is recoverable, not that the claimant is who they say. The team manager is
 * what proves identity, so nothing here gates approval.
 */
export const ClaimVerifyEmail: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [result, setResult] = useState<{
    state: "done" | "failed";
    message?: string;
  } | null>(null);
  const state = !token ? "failed" : (result?.state ?? "working");
  const message = !token
    ? "This link is missing its confirmation code."
    : (result?.message ?? "");
  const attempted = useRef(false);

  useEffect(() => {
    document.title = "Confirm your email — Showtime";

    // Guard against React's double-invoked effects in development consuming the
    // single-use token twice, which would show a spurious failure.
    if (attempted.current) return;
    attempted.current = true;

    if (!token) return;

    claimApi
      .verifyEmail(token)
      .then(() => setResult({ state: "done" }))
      .catch((err: unknown) => {
        const apiError = (err as {
          response?: { data?: { error?: unknown } };
        }).response?.data?.error;
        setResult({
          state: "failed",
          message:
            typeof apiError === "string"
              ? apiError
              : "This link is invalid or has expired.",
        });
      });
  }, [token]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md text-center">
        {state === "working" && (
          <Spinner label="Confirming your email…" />
        )}

        {state === "done" && (
          <>
            <CheckCircleIcon
              className="w-12 h-12 mx-auto mb-3 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
            <h1 className="text-xl font-black text-gray-900 dark:text-white">
              Email confirmed
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Thanks. Your team manager still needs to approve your claim — you
              will be notified once they do.
            </p>
            <Link
              to="/claim/status"
              className="inline-flex items-center justify-center min-h-11 mt-6 px-5 py-3 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg"
            >
              View my claim status
            </Link>
          </>
        )}

        {state === "failed" && (
          <>
            <XCircleIcon
              className="w-12 h-12 mx-auto mb-3 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <h1 className="text-xl font-black text-gray-900 dark:text-white">
              Could not confirm
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {message}
            </p>
            <p className="mt-4 text-xs text-gray-400">
              You can request a fresh link from your claim status page. This
              does not affect your manager's ability to approve you.
            </p>
            <Link
              to="/claim/status"
              className="inline-flex items-center justify-center min-h-11 mt-6 px-5 py-3 bg-sffl-red hover:bg-red-700 text-white font-bold rounded-lg"
            >
              Go to my claim status
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimVerifyEmail;
