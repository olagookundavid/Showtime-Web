import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts";
import { updateOwnProfile } from "../../services";
import { getApiErrorMessage } from "../../utils";
import { Button, Field, Input, Modal } from "../ui";

/**
 * Blocking gate for accounts that predate first/last name: every signed-in
 * visit to the public site, until they save both, they see this instead of
 * being able to use the site. No onClose — there is nothing to dismiss to.
 */
export const CompleteProfileModal = () => {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setSaving(true);
    try {
      // This modal has no phone field — carry the existing phone forward
      // unchanged, since the backend always overwrites it with whatever is sent.
      await updateOwnProfile(firstName.trim(), lastName.trim(), user?.phone ?? "");
      await refreshUser();
      toast.success("Profile completed");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save your name. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Complete your profile"
      subtitle="We need your first and last name before you continue."
      maxWidth="md"
      footer={
        <Button
          type="submit"
          form="complete-profile-form"
          fullWidth
          loading={saving}
          disabled={!firstName.trim() || !lastName.trim()}
        >
          Save and continue
        </Button>
      }
    >
      <form id="complete-profile-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 text-sffl-navy dark:text-white">
          <UserCircleIcon className="w-6 h-6 text-sffl-red shrink-0" aria-hidden="true" />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Hi{user?.name && user.name !== "User" ? `, ${user.name}` : ""}! Just need your name to continue.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Field label="First Name" htmlFor="complete-profile-first-name" className="flex-1">
            <Input
              id="complete-profile-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="John"
            />
          </Field>

          <Field label="Last Name" htmlFor="complete-profile-last-name" className="flex-1">
            <Input
              id="complete-profile-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="Doe"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
};
