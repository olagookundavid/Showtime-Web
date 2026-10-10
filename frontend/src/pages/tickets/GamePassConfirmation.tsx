import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { verifyGamePassPayment } from "../../services/api";
import { Loader } from "../../components";
import type { GamePassOrderTicket } from "../../types";
import { formatMatchDate } from "../../utils";

export const GamePassConfirmation = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");

  // VerifyPayment settles with Paystack synchronously, so (unlike the plain
  // ticket confirmation page) there's no webhook race to wait out here.
  const {
    data: order,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["publicGamePassOrder", reference],
    queryFn: () => verifyGamePassPayment(reference!),
    enabled: !!reference,
    retry: 1,
  });

  const gamedayGroups = useMemo(() => {
    const groups = new Map<string, { title: string; date: string; venue?: string; tickets: GamePassOrderTicket[] }>();
    (order?.tickets ?? []).forEach((t) => {
      const group = groups.get(t.event_day_id) ?? {
        title: t.event_title,
        date: t.event_date,
        venue: t.event_venue,
        tickets: [],
      };
      group.tickets.push(t);
      groups.set(t.event_day_id, group);
    });
    return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [order]);

  const error = !reference
    ? "No payment reference found."
    : isError
      ? "Could not find your Game Pass. Please check your email or contact support."
      : "";

  if (!!reference && isLoading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div className="text-center py-16 sm:py-24">
        <XCircleIcon className="w-16 h-16 mx-auto mb-4 text-red-600" aria-hidden="true" />
        <h2 className="text-2xl font-black text-red-600 mb-2">Something Went Wrong</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link
          to="/tickets/game-pass"
          className="inline-flex items-center justify-center min-h-11 bg-sffl-navy text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-900 transition"
        >
          Back to Game Pass
        </Link>
      </div>
    );
  }

  const isPaid = order?.payment_status === "paid";
  const isPending = order?.payment_status === "pending";

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-12 space-y-8">
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
          {isPaid ? "Payment Successful!" : isPending ? "Payment Pending" : "Payment Failed"}
        </h1>
        <p className="text-base sm:text-lg opacity-90">
          {isPaid
            ? "Your Game Pass is confirmed"
            : isPending
              ? "Your payment is being processed"
              : "Your payment could not be completed"}
        </p>
      </div>

      {order && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">Tier</span>
                <p className="font-bold text-sffl-navy dark:text-white">{order.tier_name}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">Pass holders</span>
                <p className="font-bold text-sffl-navy dark:text-white">{order.holders}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">Gamedays</span>
                <p className="font-bold text-sffl-navy dark:text-white">{order.gameday_count}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">Bundle discount</span>
                <p className="font-bold text-sffl-navy dark:text-white">
                  {order.discount_percent > 0 ? `${order.discount_percent}%` : "—"}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">Name</span>
                <p className="font-bold text-sffl-navy dark:text-white wrap-break-word">
                  {order.name}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">Email</span>
                <p className="font-bold text-sffl-navy dark:text-white break-all">{order.email}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-gray-500 uppercase font-bold">Total Paid</span>
                <p className="font-black text-sffl-red text-xl">
                  ₦{order.total.toLocaleString()}
                </p>
              </div>
            </div>

            {isPaid && gamedayGroups.length > 0 && (
              <div className="border-t dark:border-gray-700 pt-4 space-y-4">
                <span className="text-xs text-gray-500 uppercase font-bold">Your ticket codes</span>
                {gamedayGroups.map((g) => (
                  <div key={g.title + g.date} className="bg-sffl-navy text-white p-4">
                    <p className="font-bold">{g.title}</p>
                    <p className="text-xs text-gray-300">
                      {formatMatchDate(g.date, { weekday: "long", month: "long", day: "numeric" })}
                      {g.venue && ` • ${g.venue}`}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {g.tickets.map((t) => (
                        <li
                          key={t.id}
                          className="font-mono text-lg font-black tracking-wider break-all"
                        >
                          {t.ticket_code}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Show the matching code at the venue for each gameday's check-in.
                </p>
              </div>
            )}

            <div className="border-t dark:border-gray-700 pt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-500 min-w-0 break-all">
                Reference: {order.paystack_reference}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${isPaid ? "bg-green-100 text-green-700" : isPending ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
              >
                {order.payment_status}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <Link
          to="/tickets/game-pass"
          className="inline-flex items-center gap-1.5 min-h-11 text-blue-600 dark:text-blue-400 font-bold hover:underline"
        >
          <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
          Back to Game Pass
        </Link>
      </div>
    </div>
  );
};
