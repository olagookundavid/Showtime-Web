import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CheckCircleIcon, ExclamationTriangleIcon, SignalIcon } from "@heroicons/react/24/outline";
import { ButtonLink, Button, ConfirmDialog, ConfirmSummary } from "../../components";
import { useBroadcastScenes } from "../../hooks";
import { getBroadcastDay, setBroadcastDayOnAir } from "../../services/broadcastApi";
import { formatMatchDate, getApiErrorMessage } from "../../utils";

/**
 * The match day's stream, from the single-match studio. vMix usually runs the
 * day links, which show only the match put on air for that day, so a producer
 * driving this match must be able to see whether the day stream carries it and
 * put it on air in one click.
 */
export function DayStreamBanner({ matchId, title }: { matchId: string; title: string }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  // The match's date comes with its scene data (shared with the scenes card).
  const { data: scenes } = useBroadcastScenes(matchId, true);
  const date = scenes?.match.date ?? "";
  const { data: dayData } = useQuery({
    queryKey: ["broadcastDay", date],
    queryFn: () => getBroadcastDay(date),
    enabled: !!date,
    refetchInterval: 15000,
  });

  const putOnAir = useMutation({
    mutationFn: () => setBroadcastDayOnAir(date, matchId),
    onSuccess: () => {
      toast.success(`${title} is on the day stream`);
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["broadcastDay", date] });
      queryClient.invalidateQueries({ queryKey: ["broadcastDays"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not put this match on air")),
  });

  if (!date || !dayData) return null;

  const dayLabel = formatMatchDate(date, { weekday: "short", day: "numeric", month: "short" });
  const onAirId = dayData.day.on_air_match_id || "";
  const onAir = dayData.matches.find((m) => m.id === onAirId);
  const onAirTitle = onAir ? `${onAir.home_team.name} vs ${onAir.away_team.name}` : "";
  const isThis = onAirId === matchId;

  return (
    <>
      <div
        className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
          isThis
            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
            : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
        }`}
      >
        <div className="flex items-start gap-2 min-w-0 text-sm">
          {isThis ? (
            <CheckCircleIcon className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          )}
          <p className="min-w-0 text-gray-800 dark:text-gray-100">
            <b>Day stream ({dayLabel}):</b>{" "}
            {isThis
              ? "this match is on air, so the day links show everything you do here."
              : onAir
                ? `showing ${onAirTitle}. The day links won't show this match until you put it on air.`
                : "nothing is on air, so the day links are blank. Put this match on air to show it there."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {!isThis && (
            <Button size="sm" variant="danger" icon={SignalIcon} onClick={() => setConfirming(true)}>
              {onAir ? "Put this match on air instead" : "Put this match on air"}
            </Button>
          )}
          <ButtonLink to={`/admin/broadcast/day/${date}`} size="sm" variant="secondary">
            Open day studio
          </ButtonLink>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Put this match on the day stream?"
        description="The day links in vMix switch to this match straight away. Any lower-third or scene on screen is cleared."
        body={
          <ConfirmSummary
            rows={[
              ["Day", dayLabel],
              ["Now on air", onAirTitle || "Nothing"],
              ["After", title],
            ]}
          />
        }
        confirmLabel="Put on air"
        tone="info"
        icon={SignalIcon}
        pending={putOnAir.isPending}
        onConfirm={() => putOnAir.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
