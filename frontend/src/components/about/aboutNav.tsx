export type AboutNavItem = {
  to: string;
  /** Nav pill label — matches Footer.tsx's existing wording for these links. */
  label: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Real local photo only — no stock imagery. */
  backgroundImage?: string;
  /** `width` scales the photo to span the hero's full width instead of
   * cropping it to fill (the default `cover`) — for photos like a group
   * shot where cropping cuts people off. */
  backgroundFit?: "cover" | "width";
};

const LEAGUE_EYEBROW = "The league";
const RULES_EYEBROW = "Rules & policy";

export const ABOUT_NAV: AboutNavItem[] = [
  {
    to: "/about/showtime-flag",
    label: "About Showtime",
    eyebrow: LEAGUE_EYEBROW,
    title: "ABOUT SHOWTIME",
    subtitle: "The standard of co-ed flag football.",
    backgroundImage:
      "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop",
  },
  {
    to: "/about/our-team",
    label: "Our Team",
    eyebrow: LEAGUE_EYEBROW,
    title: "OUR TEAM",
    subtitle: "Showtime Leadership & Sporting Operations",
    backgroundImage: "/images/team/team-photo-cropped.webp",
    backgroundFit: "width",
  },
  {
    to: "/about/arena",
    label: "Showtime Arena",
    eyebrow: LEAGUE_EYEBROW,
    title: "SHOWTIME ARENA",
    subtitle: "The Premium Hub of the SFFL",
    backgroundImage: "/images/branding/showtime-arena-main.webp",
    backgroundFit: "width",
  },
  // Education page taken out of the About nav for now — see
  // pages/about/Education.tsx, App.tsx and Footer.tsx for the rest of it.
  // {
  //   to: "/about/education",
  //   label: "Education",
  //   eyebrow: LEAGUE_EYEBROW,
  //   title: "FLAG FOOTBALL EDUCATION",
  //   subtitle: "Master the game",
  // },
  {
    to: "/about/rules",
    label: "Gameplay Rules",
    eyebrow: RULES_EYEBROW,
    title: "GAMEPLAY RULES",
    subtitle: "Official Showtime Flag Football League rules",
  },
  {
    to: "/about/byelaws",
    label: "Showtime Byelaws",
    eyebrow: RULES_EYEBROW,
    title: "SHOWTIME BYELAWS & CONSTITUTION",
    subtitle: "League governance and regulations",
  },
  {
    to: "/about/faq",
    label: "FAQs",
    eyebrow: "Help Center",
    title: "FREQUENTLY ASKED QUESTIONS",
    subtitle: "Everything you need to know about Showtime Flag Football.",
  },
  {
    to: "/about/media-guidelines",
    label: "Media Guidelines",
    eyebrow: RULES_EYEBROW,
    title: "MEDIA ACCREDITATION",
    subtitle: "Guidelines for Content Creators & Journalists",
  },
  {
    to: "/about/whistleblower",
    label: "Whistleblower",
    eyebrow: RULES_EYEBROW,
    title: "POLICIES & CONDUCT",
    subtitle: "Ensuring a safe environment for all",
  },
  {
    to: "/about/privacy",
    label: "Privacy Policy",
    eyebrow: RULES_EYEBROW,
    title: "PRIVACY POLICY",
    subtitle: "How we collect, use, and protect your information",
  },
  {
    to: "/about/sponsorships",
    label: "Sponsorships",
    eyebrow: LEAGUE_EYEBROW,
    title: "PARTNERSHIPS & SPONSORSHIPS",
  },
];
