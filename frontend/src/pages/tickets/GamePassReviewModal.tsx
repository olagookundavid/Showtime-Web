import { useState } from "react";
import { CheckCircleIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Button, Checkbox, Field, Input, Modal } from "../../components";
import type { EventDayResponse } from "../../types";
import type { GamePassTotals } from "../../utils";
import {
  newsletterEnabled,
  subscribeToNewsletter,
  toFirstName,
} from "../../services/newsletter";

interface Props {
  open: boolean;
  onClose: () => void;
  tierName: string;
  gamedays: EventDayResponse[];
  holders: number;
  totals: GamePassTotals;
}

/**
 * There is no Game Pass backend yet, so this is a review + lead-capture form,
 * not a checkout. Submitting shows a confirmation state — it never pretends
 * to take payment. The optional newsletter opt-in reuses real infrastructure;
 * the Game Pass interest itself has nowhere to persist until a waitlist
 * endpoint exists (see the backend handoff notes).
 */
export const GamePassReviewModal = ({
  open,
  onClose,
  tierName,
  gamedays,
  holders,
  totals,
}: Props) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [joinNewsletter, setJoinNewsletter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Every close path (X button, backdrop, Escape, Cancel, Done) resets the
  // confirmation state, so re-opening on this same selection shows the form
  // again rather than the stale "thanks" screen.
  const handleClose = () => {
    setSubmitted(false);
    onClose();
  };

  const canSubmit = !!name && !!email && !!phone.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    if (joinNewsletter) {
      void subscribeToNewsletter({ firstName: toFirstName(name), email });
    }
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Review your Game Pass"
      maxWidth="lg"
      shape="square"
      footer={
        submitted ? (
          <Button fullWidth shape="square" size="lg" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              shape="square"
              size="lg"
              className="flex-1"
              disabled={submitting}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              shape="square"
              size="lg"
              className="flex-1"
              loading={submitting}
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              Notify me
            </Button>
          </>
        )
      }
    >
      {submitted ? (
        <div className="space-y-3 py-6 text-center">
          <CheckCircleIcon
            className="mx-auto h-12 w-12 text-emerald-500"
            aria-hidden="true"
          />
          <h3 className="text-lg font-black text-sffl-navy dark:text-white">
            Thanks — we&apos;ll be in touch
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Game Pass purchases are launching soon. We&apos;ll email you the moment
            they&apos;re available.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2 bg-gray-50 p-4 dark:bg-gray-700">
            <div className="inline-block bg-sffl-navy px-3 py-1 text-xs font-bold text-white">
              {tierName} — {gamedays.length} gamedays — {holders} pass holder
              {holders === 1 ? "" : "s"}
            </div>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
              {gamedays.map((d) => (
                <li key={d.id} className="wrap-break-word">
                  {d.title}
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t pt-2 text-sm dark:border-gray-600">
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>Standard total</span>
                <span>₦{totals.standardTotal.toLocaleString()}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Bundle discount ({totals.discountPercent}%)</span>
                  <span>−₦{totals.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-sffl-navy dark:text-white">
                <span>Total</span>
                <span className="text-sffl-red">₦{totals.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300">
            Game Pass purchases are launching soon. Leave your details and
            we&apos;ll notify you the moment they&apos;re available.
          </p>

          <Field
            label={<>Full Name <span className="text-red-500">*</span></>}
            htmlFor="gamepass-name"
          >
            <Input
              id="gamepass-name"
              type="text"
              shape="square"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              required
            />
          </Field>

          <Field
            label={<>Email Address <span className="text-red-500">*</span></>}
            htmlFor="gamepass-email"
            hint="We'll email you when Game Pass launches"
          >
            <Input
              id="gamepass-email"
              type="email"
              shape="square"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. example@mail.com"
              required
            />
          </Field>

          <Field
            label={<>Phone Number <span className="ml-1 text-sffl-red">*</span></>}
            htmlFor="gamepass-phone"
          >
            <Input
              id="gamepass-phone"
              type="tel"
              shape="square"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +234..."
              required
            />
          </Field>

          {newsletterEnabled && (
            <label className="flex cursor-pointer items-start gap-3 border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/40">
              <Checkbox
                className="mt-0.5"
                checked={joinNewsletter}
                onChange={(e) => setJoinNewsletter(e.target.checked)}
              />
              <span className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                <span className="font-bold text-gray-800 dark:text-white">
                  Send me the Showtime newsletter
                </span>
                <br />
                Fixtures, match news and ticket drops. Unsubscribe any time.
              </span>
            </label>
          )}

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-500">
            <SparklesIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            No payment is taken now — this just registers your interest.
          </p>
        </div>
      )}
    </Modal>
  );
};
