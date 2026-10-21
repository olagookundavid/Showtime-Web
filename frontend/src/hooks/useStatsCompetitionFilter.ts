import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getCompetitions,
  getStatDates,
  sortCompetitionsBySeason,
  dropdownCompetitionsFor,
} from "../services/api";
import type { Competition } from "../types";

const COMP_STORAGE_KEY = "sffl_stats_comp";
const DATE_STORAGE_KEY = "sffl_stats_date";

/**
 * Competition + Event-Day filter shared by the Player Stats and Team Stats
 * pages — a hook rather than duplicated per page because the sessionStorage
 * keys are meant to carry the same selection across both: switching from one
 * page to the other keeps your competition/date choice.
 */
export function useStatsCompetitionFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlComp = searchParams.get("comp");
  const urlDate = searchParams.get("date");

  const [selectedCompetitionId, setSelectedCompetitionIdState] = useState<string>(
    () => urlComp || sessionStorage.getItem(COMP_STORAGE_KEY) || "",
  );
  const [selectedDate, setSelectedDateState] = useState<string>(
    () => urlDate || sessionStorage.getItem(DATE_STORAGE_KEY) || "",
  );

  // Restore state from the URL when the user navigates back/forward.
  const urlState = JSON.stringify([urlComp, urlDate]);
  const [previousUrlState, setPreviousUrlState] = useState(urlState);
  if (urlState !== previousUrlState) {
    setPreviousUrlState(urlState);
    if (urlComp && urlComp !== selectedCompetitionId) setSelectedCompetitionIdState(urlComp);
    if (urlDate !== null && urlDate !== selectedDate) setSelectedDateState(urlDate);
  }

  useEffect(() => {
    sessionStorage.setItem(COMP_STORAGE_KEY, selectedCompetitionId);
  }, [selectedCompetitionId]);

  useEffect(() => {
    sessionStorage.setItem(DATE_STORAGE_KEY, selectedDate);
  }, [selectedDate]);

  // Sync restored/default state back to the URL if it's missing there.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    let updated = false;
    if (selectedCompetitionId && !params.has("comp")) {
      params.set("comp", selectedCompetitionId);
      updated = true;
    }
    if (selectedDate && !params.has("date")) {
      params.set("date", selectedDate);
      updated = true;
    }
    if (updated) setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompetitionId, selectedDate]);

  const setSelectedCompetitionId = (compId: string) => {
    setSelectedCompetitionIdState(compId);
    setSelectedDateState("");
    const params = new URLSearchParams(searchParams);
    if (compId) params.set("comp", compId);
    else params.delete("comp");
    params.delete("date");
    setSearchParams(params, { replace: true });
  };

  const setSelectedDate = (date: string) => {
    setSelectedDateState(date);
    const params = new URLSearchParams(searchParams);
    params.set("date", date);
    setSearchParams(params, { replace: true });
  };

  const { data: competitionsData, isLoading: compLoading } = useQuery({
    queryKey: ["publicCompetitions"],
    queryFn: () => getCompetitions(1, 100),
  });
  const competitions = sortCompetitionsBySeason(
    (competitionsData?.data || []).filter((c: Competition) => c.status !== "inactive"),
  );
  const selectedComp = competitions.find((c: Competition) => c.id === selectedCompetitionId);
  const dropdownComps = dropdownCompetitionsFor(competitions, selectedComp);

  const { data: datesData, isLoading: datesLoading } = useQuery({
    queryKey: ["statDates", selectedCompetitionId],
    queryFn: () => getStatDates(selectedCompetitionId),
  });
  const statDates = datesData || [];

  return {
    competitions,
    dropdownComps,
    selectedCompetitionId,
    setSelectedCompetitionId,
    selectedDate,
    setSelectedDate,
    statDates,
    compLoading,
    datesLoading,
  };
}
