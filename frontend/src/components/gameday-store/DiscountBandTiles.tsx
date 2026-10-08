import { BUNDLE_DISCOUNT_BANDS, getBundleDiscountBand } from "../../utils";

type Props = {
  gamedayCount: number;
  nextBandAt: number | null;
  nextBandPercent: number | null;
};

/** The 2-3 / 4-5 / 6+ gameday discount bands, with the currently applicable one highlighted. */
export const DiscountBandTiles = ({ gamedayCount, nextBandAt, nextBandPercent }: Props) => {
  const activeBand = getBundleDiscountBand(gamedayCount);
  const gamedaysToGo = nextBandAt !== null ? nextBandAt - gamedayCount : 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {BUNDLE_DISCOUNT_BANDS.map((band) => {
          const isActive = activeBand === band;
          const label =
            band.max === Infinity ? `${band.min}+ gamedays` : `${band.min}-${band.max} gamedays`;
          return (
            <div
              key={label}
              className={`border p-3 text-center ${
                isActive
                  ? "border-sffl-navy bg-sffl-navy text-white"
                  : "border-gray-200 bg-white text-sffl-navy dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              }`}
            >
              <div className="text-lg font-black">{band.percent}%</div>
              <div
                className={`text-[10px] font-bold uppercase tracking-wide ${
                  isActive ? "text-white/70" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                off {label}
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
