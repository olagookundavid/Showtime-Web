import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCardIcon, LockClosedIcon, SparklesIcon, TicketIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Checkbox,
  ConfirmDialog,
  ConfirmSummary,
  Field,
  Input,
  Modal,
} from "../../components";
import type { EventDayResponse } from "../../types";
import type { GamePassTotals } from "../../utils";
import { getApiErrorMessage } from "../../utils";
import { checkoutGamePass } from "../../services/api";
import {
  newsletterEnabled,
  subscribeToNewsletter,
  toFirstName,
} from "../../services/newsletter";

interface Props {
  open: boolean;
  onClose: () => void;
  tierId: string;
  tierName: string;
  gamedays: EventDayResponse[];
  holders: number;
  totals: GamePassTotals;
}

export const GamePassReviewModal = ({
  open,
  onClose,
  tierId,
  tierName,
  gamedays,
  holders,
  totals,
}: Props) => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [joinNewsletter, setJoinNewsletter] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClose = () => {
    setError("");
    onClose();
  };

  const canSubmit = !!name && !!email && !!phone.trim();

  const handleCheckout = async () => {
    setError("");
    setPurchasing(true);

    try {
      const result = await checkoutGamePass({
        name,
        email,
        phone,
        tier_id: tierId,
        gameday_ids: gamedays.map((d) => d.id),
        holders,
      });

      // Fire-and-forget, same as the single-ticket flow: never awaited, so a
      // failure here is invisible to the buyer rather than costing them their pass.
      if (joinNewsletter) {
        void subscribeToNewsletter(
          { firstName: toFirstName(name), email },
          { keepalive: true },
        );
      }

      if (result.authorization_url) {
        window.location.href = result.authorization_url;
      } else if (result.paystack_reference) {
        navigate(`/tickets/game-pass/confirm?reference=${result.paystack_reference}`);
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to start Game Pass checkout. Please try again."));
      setPurchasing(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Review your Game Pass"
        maxWidth="lg"
        shape="square"
        footer={
          <>
            <Button
              variant="secondary"
              shape="square"
              size="lg"
              className="flex-1"
              disabled={purchasing}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              shape="square"
              size="lg"
              className="flex-1"
              loading={purchasing}
              icon={totals.total === 0 ? TicketIcon : CreditCardIcon}
              disabled={!canSubmit || purchasing}
              onClick={() => setConfirmOpen(true)}
            >
              {purchasing
                ? "Processing…"
                : totals.total === 0
                  ? "Get Free Game Pass"
                  : "Pay with Paystack"}
            </Button>
          </>
        }
      >
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
            hint="Your Game Pass confirmation will be sent to this email"
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

          {error && (
            <div className="bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

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
            {totals.total === 0 ? (
              <SparklesIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <LockClosedIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {totals.total === 0
              ? "Your free Game Pass will be issued instantly"
              : "You will be redirected to Paystack for secure payment"}
          </p>
        </div>
      </Modal>

      {/* Sits outside the Modal, so its backdrop clicks don't close the review. */}
      <ConfirmDialog
        open={confirmOpen}
        title={totals.total === 0 ? "Get this free Game Pass?" : "Pay for this Game Pass?"}
        description={
          totals.total === 0
            ? "Your tickets will be emailed to you straight away."
            : "You will be taken to Paystack to complete payment."
        }
        confirmLabel={totals.total === 0 ? "Get free Game Pass" : "Pay now"}
        tone="info"
        icon={TicketIcon}
        pending={purchasing}
        body={
          <ConfirmSummary
            rows={[
              ["Tier", tierName],
              ["Gamedays", String(gamedays.length)],
              ["Pass holders", String(holders)],
              ["Total", `₦${totals.total.toLocaleString()}`],
            ]}
          />
        }
        onConfirm={async () => {
          await handleCheckout();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};
