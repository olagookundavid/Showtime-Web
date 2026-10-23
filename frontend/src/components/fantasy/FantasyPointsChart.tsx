import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../contexts";
import type { TeamPointsHistoryRow } from "../../types";

// Brand red for "your points", the same validated blue TrafficChart.tsx
// already uses for its second series — sffl-navy itself is too dark/desaturated
// to read as a line on a chart surface, so this is the closest in-app stand-in.
const THEME = {
  light: { mine: "#c62828", average: "#2a78d6", grid: "#e5e7eb", axis: "#6b7280", surface: "#ffffff" },
  dark: { mine: "#eb4b4b", average: "#3987e5", grid: "#374151", axis: "#9ca3af", surface: "#1f2937" },
} as const;

interface TooltipRow {
  name?: string | number;
  value?: number | string;
  color?: string;
}

interface PointsTooltipProps {
  active?: boolean;
  payload?: readonly TooltipRow[];
  label?: string | number;
}

const PointsTooltip = ({ active, payload, label }: PointsTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Gameweek {label}</p>
      {payload.map((row) => (
        <p key={String(row.name)} className="flex items-center gap-2 text-sm">
          <span aria-hidden="true" className="h-0.5 w-4" style={{ backgroundColor: row.color }} />
          <span className="font-black text-gray-900 dark:text-white">{Number(row.value).toFixed(1)}</span>
          <span className="text-gray-600 dark:text-gray-300">{row.name}</span>
        </p>
      ))}
    </div>
  );
};

interface FantasyPointsChartProps {
  data: TeamPointsHistoryRow[];
}

export const FantasyPointsChart = ({ data }: FantasyPointsChartProps) => {
  const { isDarkMode } = useTheme();
  const c = isDarkMode ? THEME.dark : THEME.light;

  const chartData = data.map((row) => ({
    gameweek: row.gameweek_number,
    mine: row.points,
    average: row.average_points,
  }));

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700 dark:text-gray-200">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-5" style={{ backgroundColor: c.mine }} />
          Your Points
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-0.5 w-5"
            style={{ backgroundImage: `linear-gradient(to right, ${c.average} 60%, transparent 60%)`, backgroundSize: "8px 100%" }}
          />
          Average
        </li>
      </ul>
      <div className="h-72" role="img" aria-label="Line chart of your fantasy points per gameweek against the average">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} strokeWidth={1} />
            <XAxis
              dataKey="gameweek"
              tickFormatter={(v: number) => `GW${v}`}
              tick={{ fill: c.axis, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: c.grid }}
              minTickGap={20}
            />
            <YAxis
              width={36}
              allowDecimals={false}
              tick={{ fill: c.axis, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<PointsTooltip />} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="mine"
              name="Your Points"
              stroke={c.mine}
              strokeWidth={2}
              dot={chartData.length < 2}
              activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="average"
              name="Average"
              stroke={c.average}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={chartData.length < 2}
              activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
