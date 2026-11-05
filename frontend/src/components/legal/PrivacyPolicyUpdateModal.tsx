import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { usePrivacyPolicyNotice } from "../../hooks";
import { Button, ButtonLink, Modal } from "../ui";

/** One-time notice for returning visitors that the Privacy Policy has
 *  changed. Dismissible — unlike CompleteProfileModal, there's nothing
 *  blocking about this. */
export const PrivacyPolicyUpdateModal = () => {
  const { isOpen, dismiss } = usePrivacyPolicyNotice();

  return (
    <Modal
      open={isOpen}
      onClose={dismiss}
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
          We've updated our Privacy Policy to reflect how we collect, use,
          and protect your information. We recommend reviewing the latest
          version.
        </p>
      </div>
    </Modal>
  );
};
