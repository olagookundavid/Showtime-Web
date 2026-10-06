import React from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { Button, ButtonLink, Modal } from "../ui";

interface AuthRequiredDialogProps {
  open: boolean;
  /** Dismiss without going anywhere. Omit to hide the Go Back option — use
   *  that only where there is nothing behind the dialogue to go back to. */
  onClose?: () => void;
  /** Where to return after signing in. Same-origin path. */
  returnUrl: string;
  /** What they were trying to do, finishing "Log in to …". */
  actionText?: string;
  /** Overrides the heading when a feature needs to name itself. */
  title?: string;
  /** Label for the dismiss button. */
  closeLabel?: string;
}

/**
 * The single "you need an account for this" gate.
 *
 * Used two ways: as a whole-page gate on a protected route, and as a prompt
 * fired from a button on a page a signed-out visitor can otherwise browse.
 * Either way it explains itself and offers a way forward and a way back — a
 * bare redirect to /login leaves people wondering what happened.
 */
export const AuthRequiredDialog: React.FC<AuthRequiredDialogProps> = ({
  open,
  onClose,
  returnUrl,
  actionText = "use this feature",
  title = "Sign In Required",
  closeLabel = "Go Back",
}) => (
  <Modal open={open} onClose={onClose} title={title} maxWidth="md">
    <div className="flex flex-col items-center text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-sffl-red/10 dark:bg-sffl-red/20 text-sffl-red flex items-center justify-center ring-8 ring-sffl-red/5">
        <LockClosedIcon className="w-8 h-8" aria-hidden="true" />
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        You need to be logged in to {actionText}.
      </p>

      <div className="w-full space-y-2 pt-2">
        <ButtonLink
          to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
          state={{ returnUrl }}
          variant="primary"
          size="lg"
          fullWidth
        >
          Go to Login
        </ButtonLink>
        <ButtonLink
          to={`/signup?returnUrl=${encodeURIComponent(returnUrl)}`}
          state={{ returnUrl }}
          variant="navy"
          size="lg"
          fullWidth
        >
          Create an Account
        </ButtonLink>
        {onClose && (
          <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
            {closeLabel}
          </Button>
        )}
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-1">
        We'll bring you straight back here when you're done.
      </p>
    </div>
  </Modal>
);
