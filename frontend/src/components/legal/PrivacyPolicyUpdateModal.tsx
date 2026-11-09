import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { usePrivacyPolicyNotice } from "../../hooks";
import { Button, Checkbox, Modal } from "../ui";

/** One-time notice that the Privacy Policy has changed. No onClose: the
 *  footer button calls `dismiss` directly, so backdrop click, Escape and
 *  the X icon can't close it — only ticking the checkbox and hitting
 *  "Continue" can. */
export const PrivacyPolicyUpdateModal = () => {
  const { isOpen, dismiss } = usePrivacyPolicyNotice();
  const [accepted, setAccepted] = useState(false);

  return (
    <Modal
      open={isOpen}
      title="Privacy Policy Updated"
      subtitle="Please take a moment to review the changes."
      maxWidth="md"
      footer={
        <Button disabled={!accepted} onClick={dismiss}>
          Continue
        </Button>
      }
    >
      <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
        <ShieldCheckIcon
          className="w-6 h-6 text-sffl-red shrink-0"
          aria-hidden="true"
        />
        <p>
          Our Privacy Policy explains the processing of personal data in
          connection with Showtime's digital services, competitions,
          ticketing, venue activities, media and commercial relationships —
          including the applicable purposes, lawful grounds, safeguards,
          retention arrangements and your rights.
        </p>
      </div>

      <div className="mt-4">
        <Checkbox
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          label={
            <span>
              I accept the{" "}
              <Link
                to="/about/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-sffl-red font-bold hover:underline"
              >
                Terms and Conditions
              </Link>
            </span>
          }
        />
      </div>
    </Modal>
  );
};
