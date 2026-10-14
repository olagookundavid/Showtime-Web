import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { getTicketByReference } from "../../services/api";
import { Loader, formatDayLong } from "../../components";

export const TicketConfirmation = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");

  // We use a small delay state for webhook processing before enabling the query
  const [delayComplete, setDelayComplete] = useState(false);

  useEffect(() => {
    if (!reference) return;
    const timer = setTimeout(() => setDelayComplete(true), 2000);
    return () => clearTimeout(timer);
  }, [reference]);

  const {
    data: ticketData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["publicTicket", reference],
    queryFn: () => getTicketByReference(reference!),
    enabled: !!reference && delayComplete,
    retry: 1, // Retry once if webhook is still processing
  });

  const ticket = ticketData || null;
  const loading = !reference ? false : !delayComplete || isLoading;
  const error = !reference
    ? "No payment reference found."
    : isError
      ? "Could not find your ticket. Please check your email or contact support."
      : "";

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div className="text-center py-16 sm:py-24">
        <XCircleIcon
          className="w-16 h-16 mx-auto mb-4 text-red-600"
          aria-hidden="true"
        />
        <h2 className="text-2xl font-black text-red-600 mb-2">
          Something Went Wrong
        </h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link
          to="/tickets"
          className="inline-flex items-center justify-center min-h-11 bg-sffl-navy text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-900 transition"
        >
          Back to Tickets
        </Link>
      </div>
    );
  }

  const isPaid = ticket?.status === "PAID";
  const isPending = ticket?.status === "PENDING";

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-12 space-y-8">
      {/* Status Header */}
      <div
        className={`text-center p-5 sm:p-8 rounded-2xl shadow-xl ${isPaid ? "bg-linear-to-r from-green-500 to-emerald-600" : isPending ? "bg-linear-to-r from-yellow-500 to-amber-500" : "bg-linear-to-r from-red-500 to-red-700"} text-white`}
      >
        {isPaid ? (
          <CheckCircleIcon className="w-16 h-16 mx-auto mb-4" aria-hidden="true" />
        ) : isPending ? (
          <ClockIcon className="w-16 h-16 mx-auto mb-4" aria-hidden="true" />
        ) : (
          <XCircleIcon className="w-16 h-16 mx-auto mb-4" aria-hidden="true" />
        )}
        <h1 className="text-2xl sm:text-3xl font-black mb-2">
          {isPaid
            ? "Payment Successful!"
            : isPending
              ? "Payment Pending"
              : "Payment Failed"}
        </h1>
        <p className="text-base sm:text-lg opacity-90">
          {isPaid
            ? "Your tickets are confirmed"
            : isPending
              ? "Your payment is being processed"
              : "Your payment could not be completed"}
        </p>
      </div>

      {/* Ticket Details */}
      {ticket && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
          {/* Ticket Code Banner */}
          {isPaid && ticket.ticket_code && (
            <div className="bg-sffl-navy text-white text-center py-6 px-4">
              <p className="text-xs uppercase tracking-wider text-gray-300 mb-2">
                Your Ticket Code
              </p>
              <p className="text-2xl sm:text-4xl font-black tracking-wider sm:tracking-widest break-all">
                {ticket.ticket_code}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Show this code at the venue for check-in on each match day
              </p>
            </div>
          )}

          {/* Details */}
          <div className="p-4 sm:p-6 space-y-4">
            {/* Every match day this ticket covers */}
            <div>
              <span className="text-xs text-gray-500 uppercase font-bold">
                {`Game Pass · ${ticket.days.length} match day${ticket.days.length === 1 ? "" : "s"}`}
              </span>
              <ul className="mt-2 space-y-2">
                {ticket.days.map((day) => (
                  <li
                    key={day.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border border-gray-100 p-3 dark:border-gray-700"
                  >
                    <span className="min-w-0">
                      <span className="block font-bold text-sffl-navy dark:text-white wrap-break-word">
                        {day.title || "—"}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {day.date ? formatDayLong(day.date) : "—"}
                        {day.venue && ` • ${day.venue}`}
                      </span>
                    </span>
                    {day.checked_in_at && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 dark:text-green-400">
                        <CheckCircleIcon
                          className="w-4 h-4"
                          aria-hidden="true"
                        />
                        Checked in
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">
                  Ticket
                </span>
                <p className="font-bold text-sffl-navy dark:text-white ">
                  {ticket.product_name || "—"}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">
                  Qty
                </span>
                <p className="font-bold text-sffl-navy dark:text-white ">
                  {ticket.quantity}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">
                  Name
                </span>
                <p className="font-bold text-sffl-navy dark:text-white wrap-break-word">
                  {ticket.name || "—"}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">
                  Email
                </span>
                <p className="font-bold text-sffl-navy dark:text-white break-all">
                  {ticket.email}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">
                  Phone
                </span>
                <p className="font-bold text-sffl-navy dark:text-white ">
                  {ticket.phone || "—"}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">
                  Total Paid
                </span>
                <p className="font-black text-sffl-red text-xl">
                  ₦{ticket.total_amount?.toLocaleString()}
                </p>
                {ticket.game_pass_discount_amount > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Includes {ticket.game_pass_discount_percent}% Game Pass
                    saving (₦
                    {ticket.game_pass_discount_amount.toLocaleString()})
                  </p>
                )}
              </div>
            </div>

            {isPaid && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                We will also email you a reminder the day before each match day.
              </p>
            )}

            <div className="border-t dark:border-gray-700 pt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-500 min-w-0 break-all">
                Reference: {ticket.paystack_reference}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${isPaid ? "bg-green-100 text-green-700" : isPending ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
              >
                {ticket.status}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1.5 min-h-11 text-blue-600 dark:text-blue-400 font-bold hover:underline"
        >
          <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
          Buy More Tickets
        </Link>
      </div>
    </div>
  );
};
