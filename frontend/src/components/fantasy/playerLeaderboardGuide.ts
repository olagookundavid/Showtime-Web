/** One column of the player leaderboard, explained. */
export interface LeaderboardGuideEntry {
  label: string;
  /** Which stretch of the season the figure covers. */
  scope: string;
  /** One line, shown as the header's hover hint. */
  summary: string;
  /** The full explanation, shown in the legend. */
  detail: string;
}

export type LeaderboardGuideKey =
  | "rank"
  | "player"
  | "points"
  | "gameweekPoints"
  | "form"
  | "ppg"
  | "apps"
  | "value"
  | "price"
  | "selected"
  | "started"
  | "in"
  | "out";

/**
 * What every column of the player leaderboard means. The table headers take
 * their hover hints from `summary` and the legend prints `detail`, so the two
 * cannot drift apart. `gwLabel` is the gameweek the per-gameweek columns
 * describe ("GW4"), and `isGameweekView` is true when one was picked at the top.
 */
export function playerLeaderboardGuide(
  gwLabel: string,
  isGameweekView: boolean,
): Record<LeaderboardGuideKey, LeaderboardGuideEntry> {
  return {
    rank: {
      label: "Rank",
      scope: isGameweekView ? `${gwLabel} only` : "Whole season",
      summary: `Position in the table by ${isGameweekView ? `${gwLabel} ` : ""}points.`,
      detail: `The number in the coloured circle is the player's position by points${isGameweekView ? ` in ${gwLabel}` : " this season"}. Players level on points share a rank, so two players tied at the top are both 1 and the next is 3. Searching or filtering never renumbers anyone: a player's rank is always their rank among every player, not among the ones on screen.`,
    },
    player: {
      label: "Player",
      scope: "Profile",
      summary: "The player, their position and their club.",
      detail:
        "Tap the photo to see it full size, the name to open their player profile, or anywhere else on the row to open their fantasy card with price history. Under the name are their position and club. An amber tag (Club reserve, Club inactive or Deactivated) means they are still ranked on what they scored but cannot be started in a lineup.",
    },
    points: {
      label: isGameweekView ? `${gwLabel} pts` : "Pts",
      scope: isGameweekView ? `${gwLabel} only` : "Whole season",
      summary: isGameweekView
        ? `Fantasy points scored in ${gwLabel}.`
        : "Fantasy points scored this season.",
      detail: `Total fantasy points, worked out from the player's own match stats with exactly the same scoring rules your lineup uses. Every match counts, whether or not anyone picked them, so a player nobody owns still shows what they earned. All-Rounders are shown for their full game (in a lineup they only score offence or defence, depending on the slot you use them in). ${isGameweekView ? `You are looking at ${gwLabel} only.` : "Pick a gameweek at the top to see just that one."} This is the figure the table is ranked by.`,
    },
    gameweekPoints: {
      label: `${gwLabel} pts`,
      scope: `${gwLabel} only`,
      summary: `Fantasy points scored in the latest played gameweek (${gwLabel}).`,
      detail: `Points scored in the most recent gameweek that has been played (${gwLabel}), shown next to the season total so you can see who has just scored. Pick a different gameweek at the top to see any other.`,
    },
    form: {
      label: "Form",
      scope: "Last 3 gameweeks",
      summary: "Average points per gameweek over the last three played gameweeks.",
      detail:
        "Average points per gameweek across the last three gameweeks that have been played. A gameweek where the player did not play counts as zero, so someone who has been missing games shows a lower form. Use it to spot who is hot right now, as opposed to who scored a lot early in the season.",
    },
    ppg: {
      label: "PPG",
      scope: "Whole season",
      summary: "Points per game: season points divided by matches played.",
      detail:
        "Points per game: season points divided by the number of matches the player actually played in. It rewards players who score big every time they take the field, even if they miss games. Unlike Form, it ignores the games they were absent for.",
    },
    apps: {
      label: "Apps",
      scope: "Whole season",
      summary: "Appearances: matches played this season.",
      detail:
        "Appearances: the number of matches this season in which the player has a recorded stat line. It tells you how much to trust the other figures, since 20 points over four games means more than 20 points from one.",
    },
    value: {
      label: "Value",
      scope: "Season points, today's price",
      summary: "Season points per ₦1m of the player's current price.",
      detail:
        "Season points for every ₦1m of the player's price today. Higher means more points for the money, so a cheap player with a high Value is a bargain, and an expensive player with a low one is costing you more than they return. Compare players in the same position for the fairest read.",
    },
    price: {
      label: "Price",
      scope: "Right now",
      summary: "What it costs to sign them today, and how it has moved since the season opened.",
      detail:
        "The live price a manager pays to sign the player today, the same price shown in the transfer market. The small arrow underneath shows how much it has moved since the season opened: green and up means it has risen, red and down means it has fallen, and no arrow means it is unchanged. Prices are recalculated after each gameweek from how players perform.",
    },
    selected: {
      label: "Selected",
      scope: "Right now",
      summary: "Share of all squads that own this player today.",
      detail:
        "The percentage of every squad in the season that owns the player right now, whether they are in the starting 14 or on the bench. Hover over a figure for the actual number of squads. A high number is a popular pick. A low number next to a high Pts is a differential: someone scoring well whom few managers have.",
    },
    started: {
      label: `Started ${gwLabel}`,
      scope: `${gwLabel} only`,
      summary: `Share of locked lineups that started them in ${gwLabel}.`,
      detail: `The percentage of locked lineups that had the player in the starting 14 in ${gwLabel}. Owning a player is not the same as starting them, so this shows who managers actually trusted that week. Hover over a figure for the number of lineups and how many times the player has been started across the season. It follows the gameweek chosen at the top, or the latest played gameweek when you are looking at the whole season.`,
    },
    in: {
      label: "In",
      scope: "Whole season",
      summary: "Times managers have signed this player this season.",
      detail:
        "How many times managers have signed the player this season, adding up every manager. It is a running total, not net of sales, so it shows how much demand the player has had.",
    },
    out: {
      label: "Out",
      scope: "Whole season",
      summary: "Times managers have sold this player this season.",
      detail:
        "How many times managers have sold the player this season, adding up every manager. Read it beside In: lots of In and few Out means a player being bought and kept, lots of Out means managers are dumping them, and a lot of both means a divisive player.",
    },
  };
}
