import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { usePrivacyPolicyNotice } from "../../hooks";
import { Button, ButtonLink, Modal } from "../ui";

/** One-time notice that the Privacy Policy has changed. No onClose: the
 *  footer buttons call `dismiss` directly, so backdrop click, Escape and
 *  the X icon can't close it — only "Not now" or "View Privacy Policy" can. */
export const PrivacyPolicyUpdateModal = () => {
  const { isOpen, dismiss } = usePrivacyPolicyNotice();

  return (
    <Modal
      open={isOpen}
      title="Privacy Policy Updated"
      subtitle="Please take a moment to review the changes."
      maxWidth="md"
      footer={
        <>
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
          <ButtonLink to="/about/privacy" onClick={dismiss}>
            View Privacy Policy
          </ButtonLink>
        </>
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
    </Modal>
  );
};
