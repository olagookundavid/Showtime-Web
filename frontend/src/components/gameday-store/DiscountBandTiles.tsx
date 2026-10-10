import type { GamePassDiscountBandResponse } from "../../types";
import { getBundleDiscountBand } from "../../utils";

type Props = {
  gamedayCount: number;
  bands: GamePassDiscountBandResponse[];
  nextBandAt: number | null;
  nextBandPercent: number | null;
};

const bandLabel = (band: GamePassDiscountBandResponse) =>
  band.max_gamedays === null
    ? `${band.min_gamedays}+ gamedays`
    : `${band.min_gamedays}-${band.max_gamedays} gamedays`;

/** The admin-configured gameday discount bands, with the currently applicable one highlighted. */
export const DiscountBandTiles = ({ gamedayCount, bands, nextBandAt, nextBandPercent }: Props) => {
  const sortedBands = [...bands]
    .filter((b) => b.is_active)
    .sort((a, b) => a.min_gamedays - b.min_gamedays);
  const activeBand = getBundleDiscountBand(gamedayCount, sortedBands);
  const gamedaysToGo = nextBandAt !== null ? nextBandAt - gamedayCount : 0;

  if (sortedBands.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {sortedBands.map((band) => {
          const isActive = activeBand?.id === band.id;
          return (
            <div
              key={band.id}
              className={`min-w-26 flex-1 border p-3 text-center ${
                isActive
                  ? "border-sffl-navy bg-sffl-navy text-white"
                  : "border-gray-200 bg-white text-sffl-navy dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              }`}
            >
              <div className="text-lg font-black">{band.discount_percent}%</div>
              <div
                className={`text-[10px] font-bold uppercase tracking-wide ${
                  isActive ? "text-white/70" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                off {bandLabel(band)}
              </div>
            </div>
          );
        })}
      </div>
      {nextBandAt !== null && nextBandPercent !== null && (
        <p className="text-xs font-bold text-sffl-red">
          Add {gamedaysToGo} more gameday{gamedaysToGo === 1 ? "" : "s"} to unlock {nextBandPercent}% off.
        </p>
      )}
    </div>
  );
};
