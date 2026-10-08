import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate, useOutletContext } from "react-router-dom";
import {
  getEventDays,
  getEventDayByDate,
  purchaseTicket,
  getUserProfile,
} from "../../services/api";
import type {
  AuthUser,
  EventDayResponse,
  TicketTierResponse,
  PurchaseTicketPayload,
  DiscountPreview,
} from "../../types";
import {
  DiscountCodeInput,
  Button,
  ButtonLink,
  Checkbox,
  Field,
  IconButton,
  Input,
  Modal,
  ConfirmDialog,
  ConfirmSummary,
  Spinner,
  FootballIcon,
  AdmissionTierPicker,
  GamedayPickerGrid,
  OrderSummarySidebar,
  StepSectionHeader,
  type GamedayStoreContext,
} from "../../components";
import {
  CreditCardIcon,
  LockClosedIcon,
  MinusIcon,
  PlusIcon,
  SparklesIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import {
  newsletterEnabled,
  subscribeToNewsletter,
  toFirstName,
} from "../../services/newsletter";

import { getRepresentativeTierRates, getGamedaySelectionStatus } from "../../utils";

export const Tickets = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const { appliedCode } = useOutletContext<GamedayStoreContext>();

  const { data: specificDay, isError: specificDayError } = useQuery({
    queryKey: ["publicEventDay", dateParam, appliedCode],
    queryFn: () => getEventDayByDate(dateParam!, appliedCode),
    enabled: !!dateParam,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const fetchAllDays = !dateParam || specificDayError;
  const fellBackFromMissingDate = !!dateParam && specificDayError;

  const { data: allDaysData, isLoading: loadingAll } = useQuery({
    queryKey: ["publicEventDays", appliedCode],
    queryFn: () => getEventDays(appliedCode),
    enabled: fetchAllDays,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const [selectedEventDay, setSelectedEventDay] =
    useState<EventDayResponse | null>(null);
  const [selectedTier, setSelectedTier] = useState<TicketTierResponse | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);
  // Server-priced preview of an applied discount code. Display only — the
  // server re-prices the code at purchase time.
  const [discount, setDiscount] = useState<DiscountPreview | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [useAccountEmail, setUseAccountEmail] = useState(false);
  const [userProfile, setUserProfile] = useState<AuthUser | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState("");
  // Consent must be given actively, so this starts unticked and stays out of
  // the purchase validation — it can never block or fail a ticket sale.
  const [joinNewsletter, setJoinNewsletter] = useState(false);
  // A purchase creates a ticket order, so it waits for an explicit confirm.
  const [confirmPurchase, setConfirmPurchase] = useState(false);

  // Builder selection: tier first, then one gameday that actually offers it.
  const [selectedTierName, setSelectedTierName] = useState<string | null>(null);
  const [selectedGamedayId, setSelectedGamedayId] = useState<string | null>(null);
  const [builderQuantity, setBuilderQuantity] = useState(1);

  const eventDays = useMemo(
    () => (specificDay && !specificDayError ? [specificDay] : allDaysData || []),
    [specificDay, specificDayError, allDaysData],
  );
  const loading =
    (!!dateParam && specificDay === undefined && !specificDayError) ||
    (fetchAllDays && loadingAll);

  const representativeRates = useMemo(
    () => getRepresentativeTierRates(eventDays),
    [eventDays],
  );
  const selectedRate =
    representativeRates.find((r) => r.name === selectedTierName) ?? null;

  const handleSelectTier = (tierName: string) => {
    setSelectedTierName(tierName);
    // A different tier can be offered on different gamedays, so the pick resets.
    setSelectedGamedayId(null);
  };

  const builderEventDay = selectedGamedayId
    ? (eventDays.find((d) => d.id === selectedGamedayId) ?? null)
    : null;
  const resolvedTier =
    builderEventDay && selectedRate
      ? getGamedaySelectionStatus(builderEventDay, selectedRate.name, selectedRate.rate)
          .tier
      : null;
  const resolvedTierSoldOut =
    !!resolvedTier && resolvedTier.capacity > 0 && resolvedTier.available <= 0;

  useEffect(() => {
    if (specificDay && !specificDayError) {
      setSelectedEventDay(specificDay);
    }
  }, [specificDay, specificDayError]);

  // Check auth status on mount
  useEffect(() => {
    const token = localStorage.getItem("showtime_access_token");
    if (token) {
      getUserProfile()
        .then((profile) => {
          setUserProfile(profile);
          setUseAccountEmail(true);
          setEmail(profile.email);
          setName(profile.full_name);
          if (profile.phone) setPhone(profile.phone);
        })
        .catch(() => {
          // Not logged in or expired
          setUserProfile(null);
        });
    }
  }, []);

  // Sync email and name when toggle changes
  useEffect(() => {
    if (useAccountEmail && userProfile) {
      setEmail(userProfile.email);
      setName(userProfile.full_name);
    } else if (!useAccountEmail && userProfile) {
      // Optional: could clear if they want to override
    }
  }, [useAccountEmail, userProfile]);

  // Sync referral code from URL if present
  useEffect(() => {
    const refParam = searchParams.get("ref");
    if (refParam) {
      setReferralCode(refParam);
    }
  }, [searchParams]);

  // Lock body scroll while purchase modal is open on mobile
  useEffect(() => {
    if (selectedTier && selectedEventDay) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [selectedTier, selectedEventDay]);

  const handlePurchase = async () => {
    if (
      !selectedEventDay ||
      !selectedTier ||
      !email ||
      !name ||
      !phone.trim()
    ) {
      setError("Full Name, Email and Phone Number are required");
      return;
    }
    setError("");
    setPurchasing(true);

    try {
      const payload: PurchaseTicketPayload = {
        event_day_id: selectedEventDay.id,
        tier_id: selectedTier.id,
        email,
        name,
        phone,
        quantity,
        referral_code: referralCode.trim() || undefined,
        // Send the code, not the amount — the server recomputes it.
        discount_code: discount?.code || undefined,
      };

      const result = await purchaseTicket(payload);

      // Fire-and-forget, deliberately after the sale succeeded and never
      // awaited: `keepalive` lets it complete even though the next line
      // navigates away to Paystack, and a failure here is invisible to
      // the buyer rather than costing them their ticket.
      if (joinNewsletter) {
        void subscribeToNewsletter(
          { firstName: toFirstName(name), email },
          { keepalive: true },
        );
      }

      if (result.authorization_url) {
        window.location.href = result.authorization_url;
      } else if (result.paystack_reference) {
        // Free ticket case - redirect to success page
        navigate(`/tickets/confirm?reference=${result.paystack_reference}`);
      }
    } catch (err: unknown) {
      const errorResponse = err as {
        response?: { data?: { error?: string } };
      };
      setError(
        errorResponse.response?.data?.error ||
          "Failed to initiate purchase. Please try again.",
      );
    } finally {
      setPurchasing(false);
    }
  };

  const openPurchaseModal = (
    eventDay: EventDayResponse,
    tier: TicketTierResponse,
    initialQuantity = 1,
  ) => {
    setSelectedEventDay(eventDay);
    setSelectedTier(tier);
    setQuantity(initialQuantity);
    setError("");
    // Fresh purchase, fresh consent — never carry a previous tick over.
    setJoinNewsletter(false);
    // Likewise for a code applied to a tier the buyer has moved on from.
    setDiscount(null);
  };

  const closePurchaseModal = () => {
    setSelectedTier(null);
    setQuantity(1);
    setError("");
    setDiscount(null);
  };

  // Totals for the purchase modal. selectedTier is null while the modal is
  // closed, which just makes these zero.
  const ticketSubtotal = (selectedTier?.price ?? 0) * quantity;
  const ticketDiscount = discount?.discount_amount ?? 0;
  const ticketTotal = Math.max(0, ticketSubtotal - ticketDiscount);

  return (
    <div className="space-y-8 md:space-y-12">
      {fellBackFromMissingDate && (
        <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <strong className="font-bold">No event found for {dateParam}.</strong>{" "}
          Showing all upcoming events instead.
        </div>
      )}

      <div className="flex flex-col gap-3 border border-red-500/20 bg-linear-to-r from-red-600/10 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:text-gray-200">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-bold">
            <FootballIcon
              className="h-4 w-4 shrink-0 text-sffl-red"
              aria-hidden="true"
            />
            Earn rewards by inviting friends!
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Generate a referral code and get payouts for every ticket sold.
          </p>
        </div>
        <ButtonLink
          to="/tickets/referrals"
          variant="primary"
          shape="square"
          className="shrink-0"
        >
          Get referral link
        </ButtonLink>
      </div>

      {loading ? (
        <Spinner size="lg" className="py-16" label="Loading events…" />
      ) : eventDays.length === 0 ? (
        <div className="border border-gray-200 bg-white px-4 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
          <TicketIcon
            className="mx-auto mb-4 h-16 w-16 text-gray-400"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-2xl font-black uppercase tracking-tight text-sffl-navy dark:text-white">
            No upcoming events
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Check back soon for new gameday schedules.
          </p>
          <ButtonLink
            to="/matches"
            variant="navy"
            shape="square"
            className="mt-6"
          >
            View matches
          </ButtonLink>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div className="space-y-4">
              <StepSectionHeader step={1} title="Choose your admission tier" />
              <AdmissionTierPicker
                rates={representativeRates}
                selectedTierName={selectedTierName}
                onSelect={handleSelectTier}
              />
            </div>

            {selectedRate && (
              <div className="space-y-4">
                <StepSectionHeader step={2} title="Choose one gameday" />
                <GamedayPickerGrid
                  eventDays={eventDays}
                  tierName={selectedRate.name}
                  representativeRate={selectedRate.rate}
                  mode="single"
                  selectedIds={selectedGamedayId ? [selectedGamedayId] : []}
                  onToggle={(id) =>
                    setSelectedGamedayId((prev) => (prev === id ? null : id))
                  }
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  One ticket covers the selected gameday.
                </p>

                <Field label="Number of tickets">
                  <div className="flex items-center gap-4">
                    <IconButton
                      variant="secondary"
                      shape="square"
                      icon={MinusIcon}
                      label="Decrease number of tickets"
                      onClick={() =>
                        setBuilderQuantity((q) => Math.max(1, q - 1))
                      }
                    />
                    <span
                      className="w-12 text-center text-xl font-bold dark:text-white"
                      aria-live="polite"
                    >
                      {builderQuantity}
                    </span>
                    <IconButton
                      variant="secondary"
                      shape="square"
                      icon={PlusIcon}
                      label="Increase number of tickets"
                      onClick={() =>
                        setBuilderQuantity((q) => Math.min(10, q + 1))
                      }
                    />
                  </div>
                </Field>
              </div>
            )}
          </div>

          <OrderSummarySidebar
            title="Your tickets"
            rows={[
              {
                label: "Gameday",
                value: builderEventDay ? builderEventDay.title : "Not selected",
              },
              {
                label: "Tier",
                value: selectedRate ? selectedRate.name : "Not selected",
              },
              { label: "Tickets", value: String(builderQuantity) },
              {
                label: "Per ticket",
                value: selectedRate
                  ? `₦${selectedRate.rate.toLocaleString()}`
                  : "—",
              },
            ]}
            total={selectedRate ? selectedRate.rate * builderQuantity : 0}
            ctaLabel={resolvedTierSoldOut ? "Sold out" : "Review tickets"}
            ctaDisabled={!resolvedTier || resolvedTierSoldOut}
            onCtaClick={() => {
              if (builderEventDay && resolvedTier) {
                openPurchaseModal(builderEventDay, resolvedTier, builderQuantity);
              }
            }}
            smallPrint={[
              "Admission to the selected tier for this gameday.",
              "Illustrative pricing. Any applicable fees or taxes must be disclosed before payment.",
            ]}
          />
        </div>
      )}

      {/* Purchase Modal */}
      {selectedTier && selectedEventDay && (
        <Modal
          open
          onClose={closePurchaseModal}
          title="Purchase Tickets"
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
                onClick={closePurchaseModal}
              >
                Cancel
              </Button>
              <Button
                shape="square"
                size="lg"
                className="flex-1"
                loading={purchasing}
                icon={ticketTotal === 0 ? TicketIcon : CreditCardIcon}
                disabled={purchasing || !email || !name || !phone.trim()}
                onClick={() => setConfirmPurchase(true)}
              >
                {purchasing
                  ? "Processing…"
                  : ticketTotal === 0
                    ? "Get Free Ticket"
                    : "Pay with Paystack"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Event Info */}
            <div className="bg-gray-50 p-4 dark:bg-gray-700">
              <div className="font-bold text-sffl-navy wrap-break-word dark:text-white">
                {selectedEventDay.title}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {new Date(
                  selectedEventDay.date + "T00:00:00",
                ).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                {selectedEventDay.venue && ` • ${selectedEventDay.venue}`}
              </div>
              <div className="mt-2 inline-block bg-sffl-navy px-3 py-1 text-xs font-bold text-white">
                {selectedTier.name} — ₦{selectedTier.price.toLocaleString()}
                /ticket
              </div>
            </div>

            {/* Auth Toggle */}
            {userProfile && (
              <div className="border border-blue-100 bg-blue-50 px-3 py-1 dark:border-blue-800 dark:bg-blue-900/30">
                <Checkbox
                  label={<span className="text-blue-800 dark:text-blue-300">Use my account information</span>}
                  checked={useAccountEmail}
                  onChange={(e) => setUseAccountEmail(e.target.checked)}
                />
              </div>
            )}

            {/* Full Name */}
            <Field
              label={<>Full Name <span className="text-red-500">*</span></>}
              htmlFor="ticket-name"
            >
              <Input
                id="ticket-name"
                type="text"
                shape="square"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                required
                disabled={useAccountEmail}
              />
            </Field>

            {/* Email */}
            <Field
              label={<>Email Address <span className="text-red-500">*</span></>}
              htmlFor="ticket-email"
              hint="Your ticket will be sent to this email"
            >
              <Input
                id="ticket-email"
                type="email"
                shape="square"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. example@mail.com"
                required
                disabled={useAccountEmail}
              />
            </Field>

            {/* Phone */}
            <Field
              label={<>Phone Number <span className="ml-1 text-sffl-red">*</span></>}
              htmlFor="ticket-phone"
              hint="We may call you regarding your ticket"
            >
              <Input
                id="ticket-phone"
                type="tel"
                shape="square"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +234..."
                required
              />
            </Field>

            {/* Referral Code */}
            <Field
              label={<>Referral Code <span className="ml-1 font-normal text-gray-500">(optional)</span></>}
              htmlFor="ticket-referral"
              hint="If you were referred, enter the referrer's code"
            >
              <Input
                id="ticket-referral"
                type="text"
                shape="square"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="SFFL-XXXX"
              />
            </Field>

            {/* Quantity */}
            <Field label="Quantity">
              <div className="flex items-center gap-4">
                <IconButton
                  variant="secondary"
                  shape="square"
                  icon={MinusIcon}
                  label="Decrease quantity"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                />
                <span
                  className="w-12 text-center text-xl font-bold dark:text-white"
                  aria-live="polite"
                >
                  {quantity}
                </span>
                <IconButton
                  variant="secondary"
                  shape="square"
                  icon={PlusIcon}
                  label="Increase quantity"
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                />
              </div>
            </Field>

            {/* Discount code — hidden on free tiers, where
                                there is nothing left to take off. */}
            {selectedTier.price > 0 && (
              <div className="border-t pt-4 dark:border-gray-700">
                <DiscountCodeInput
                  tierId={selectedTier.id}
                  quantity={quantity}
                  onChange={setDiscount}
                  disabled={purchasing}
                />
              </div>
            )}

            {/* Total */}
            <div className="space-y-1.5 border-t pt-4 dark:border-gray-700">
              {ticketDiscount > 0 && (
                <>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Subtotal
                    </span>
                    <span className="text-gray-500 line-through dark:text-gray-400">
                      ₦{ticketSubtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 break-all text-gray-500 dark:text-gray-400">
                      Discount ({discount?.code})
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      −₦{ticketDiscount.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Total:
                </span>
                <span className="text-2xl font-black text-sffl-red sm:text-3xl">
                  ₦{ticketTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Optional newsletter opt-in. Unticked by default —
                                a pre-ticked box isn't consent. */}
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
                  Fixtures, match news and ticket drops. Unsubscribe any
                  time.
                </span>
              </label>
            )}
            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-500">
              {ticketTotal === 0 ? (
                <SparklesIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <LockClosedIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {ticketTotal === 0
                ? "Your free ticket will be sent instantly"
                : "You will be redirected to Paystack for secure payment"}
            </p>
          </div>
        </Modal>
      )}

      {/* Sits outside the Modal, so its backdrop clicks don't close the purchase. */}
      {selectedTier && selectedEventDay && (
        <ConfirmDialog
          open={confirmPurchase}
          title={ticketTotal === 0 ? "Get this free ticket?" : "Pay for these tickets?"}
          description={
            ticketTotal === 0
              ? "Your ticket will be emailed to you straight away."
              : "You will be taken to Paystack to complete payment."
          }
          confirmLabel={ticketTotal === 0 ? "Get free ticket" : "Pay now"}
          tone="info"
          icon={TicketIcon}
          pending={purchasing}
          body={
            <ConfirmSummary
              rows={[
                ["Event", selectedEventDay.title],
                ["Ticket", selectedTier.name],
                ["Quantity", String(quantity)],
                ["Total", `₦${ticketTotal.toLocaleString()}`],
              ]}
            />
          }
          onConfirm={async () => {
            await handlePurchase();
            setConfirmPurchase(false);
          }}
          onCancel={() => setConfirmPurchase(false)}
        />
      )}
    </div>
  );
};
