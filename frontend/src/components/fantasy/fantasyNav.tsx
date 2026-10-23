export type FantasyNavItem = {
  to: string;
  /** Nav pill label. */
  label: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Extra route patterns (matched via react-router-dom's matchPath) that
   * should resolve to this entry's banner/active-pill even though the
   * current pathname isn't an exact match on `to` — e.g. a step nested
   * inside this page's own flow. */
  matchPaths?: string[];
  /** false = exists for title/subtitle resolution only, never rendered as
   * a pill in the nav strip. Default true. */
  pill?: boolean;
};

const EYEBROW = "Fantasy Football";

export const FANTASY_NAV: FantasyNavItem[] = [
  {
    to: "/fantasy/dashboard",
    label: "Dashboard",
    eyebrow: EYEBROW,
    title: "DASHBOARD",
    subtitle: "Your weekly home for progress, deadlines and league standings.",
  },
  {
    to: "/fantasy/build",
    label: "Build Squad",
    eyebrow: EYEBROW,
    title: "BUILD YOUR SQUAD",
    subtitle:
      "Pick your 14 players, make transfers and set your lineup before the deadline.",
  },
  {
    to: "/fantasy/my-team",
    label: "My Team",
    eyebrow: EYEBROW,
    title: "MY TEAM",
    subtitle: "See your current lineup, this gameweek's score and your squad's value.",
  },
  {
    to: "/fantasy/points",
    label: "Points",
    eyebrow: EYEBROW,
    title: "POINTS",
    subtitle: "Your score every gameweek, against the average and where you ranked.",
  },
  {
    to: "/fantasy/leagues",
    label: "Leagues",
    eyebrow: EYEBROW,
    title: "LEAGUES & PRIZE POOLS",
    subtitle: "Join private leagues with friends or official cash-prize competitions.",
    matchPaths: ["/fantasy/leagues/confirm"],
  },
  {
    to: "/fantasy/wallet",
    label: "Prize Wallet",
    eyebrow: EYEBROW,
    title: "PRIZE WALLET",
    subtitle: "See what you've won and request a payout to your bank account.",
  },
  {
    to: "/fantasy/analytics",
    label: "Weekly Report",
    eyebrow: EYEBROW,
    title: "WEEKLY REPORT",
    subtitle: "Who's in form, who everyone's picking and this gameweek's dream team.",
  },
  {
    to: "/fantasy/players",
    label: "Player Leaderboard",
    eyebrow: EYEBROW,
    title: "PLAYER LEADERBOARD",
    subtitle: "Every player ranked by fantasy points, price and ownership.",
  },
  // Flow-only: reached via in-page links (Dashboard's "Full Table", a
  // league's leaderboard link), never navigated to directly, and genuinely
  // ambiguous which single pill it "belongs to" — resolved for title/subtitle
  // via matchPaths, but never shown as a pill and never lights up another pill.
  {
    to: "/fantasy/leaderboard",
    pill: false,
    label: "Leaderboard",
    eyebrow: EYEBROW,
    title: "LEADERBOARD",
    subtitle: "See how every manager and league ranks this season.",
    matchPaths: ["/fantasy/leaderboard/:id"],
  },
];
