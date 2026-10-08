import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, ThemeProvider, FontProvider, CartProvider } from "./contexts";
import { ProtectedRoute, FeatureGuard, Layout, StoreLayout, GamedayStoreLayout, ScrollToTop, Loader, ErrorBoundary, AdSenseScript, BrevoTracker } from "./components";
import {
  Landing,
  AboutShowtimeFlag,
  MediaGuidelines,
  GameplayRules,
  ShowtimeByelaws,
  ShowtimeArena,
  Education,
  FAQ,
  Whistleblower,
  OurTeam,
  Sponsorships,
  PrivacyPolicy,
  NewsList,
  NewsDetail,
  MatchHub,
  MatchDetail,
  Standings,
  Stats,
  Tickets,
  TicketConfirmation,
  ReferralGenerator,
  Login,
  Signup,
  ForgotPassword,
  Players,
  PlayerDetail,
  Teams,
  TeamDetail,
} from "./pages";

// Lazy load Store Pages
const Store = lazy(() =>
  import("./pages/store/Store").then((m) => ({ default: m.Store })),
);
const ProductDetail = lazy(() =>
  import("./pages/store/ProductDetail").then((m) => ({
    default: m.ProductDetail,
  })),
);
const Checkout = lazy(() =>
  import("./pages/store/Checkout").then((m) => ({ default: m.Checkout })),
);
const OrderConfirmation = lazy(() =>
  import("./pages/store/OrderConfirmation").then((m) => ({
    default: m.OrderConfirmation,
  })),
);
const MyOrders = lazy(() =>
  import("./pages/store/MyOrders").then((m) => ({ default: m.MyOrders })),
);
const MyProfile = lazy(() =>
  import("./pages/account/MyProfile").then((m) => ({ default: m.MyProfile })),
);
const ProductReviews = lazy(() =>
  import("./pages/store/ProductReviews").then((m) => ({
    default: m.ProductReviews,
  })),
);
const Cart = lazy(() =>
  import("./pages/store/Cart").then((m) => ({ default: m.Cart })),
);
const GamePass = lazy(() =>
  import("./pages/tickets/GamePass").then((m) => ({ default: m.GamePass })),
);

// Lazy load Fantasy Pages
const FantasyHub = lazy(() =>
  import("./pages/fantasy/FantasyHub").then((m) => ({ default: m.FantasyHub })),
);
const FantasyDashboard = lazy(() =>
  import("./pages/fantasy/FantasyDashboard").then((m) => ({
    default: m.FantasyDashboard,
  })),
);
const FantasySquadBuilder = lazy(() =>
  import("./pages/fantasy/FantasySquadBuilder").then((m) => ({
    default: m.FantasySquadBuilder,
  })),
);
const FantasyMyTeam = lazy(() =>
  import("./pages/fantasy/FantasyMyTeam").then((m) => ({
    default: m.FantasyMyTeam,
  })),
);
const FantasyLeagues = lazy(() =>
  import("./pages/fantasy/FantasyLeagues").then((m) => ({
    default: m.FantasyLeagues,
  })),
);
const FantasyLeagueConfirm = lazy(() =>
  import("./pages/fantasy/FantasyLeagueConfirm").then((m) => ({
    default: m.FantasyLeagueConfirm,
  })),
);
const FantasyLeaderboard = lazy(() =>
  import("./pages/fantasy/FantasyLeaderboard").then((m) => ({
    default: m.FantasyLeaderboard,
  })),
);
const FantasyWallet = lazy(() =>
  import("./pages/fantasy/FantasyWallet").then((m) => ({
    default: m.FantasyWallet,
  })),
);
const FantasyAnalytics = lazy(() =>
  import("./pages/fantasy/FantasyAnalytics").then((m) => ({
    default: m.FantasyAnalytics,
  })),
);
const TeamOfTheWeek = lazy(() =>
  import("./pages/totw/TeamOfTheWeek").then((m) => ({
    default: m.TeamOfTheWeek,
  })),
);
const PlayerOfTheWeek = lazy(() =>
  import("./pages/potw/PlayerOfTheWeek").then((m) => ({
    default: m.PlayerOfTheWeek,
  })),
);

// Lazy load Admin Pages
const AdminLayout = lazy(() =>
  import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const Dashboard = lazy(() =>
  import("./pages/admin/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const AdminMatches = lazy(() =>
  import("./pages/admin/AdminMatches").then((m) => ({
    default: m.AdminMatches,
  })),
);
const AdminPlayByPlay = lazy(() =>
  import("./pages/admin/AdminPlayByPlay").then((m) => ({
    default: m.AdminPlayByPlay,
  })),
);
const AdminBroadcastPicker = lazy(() =>
  import("./pages/admin/AdminBroadcastPicker").then((m) => ({
    default: m.AdminBroadcastPicker,
  })),
);
const AdminBroadcastStudio = lazy(() =>
  import("./pages/admin/AdminBroadcastStudio").then((m) => ({
    default: m.AdminBroadcastStudio,
  })),
);
const AdminBroadcastDay = lazy(() =>
  import("./pages/admin/AdminBroadcastDay").then((m) => ({
    default: m.AdminBroadcastDay,
  })),
);
const BroadcastOverlay = lazy(() =>
  import("./pages/BroadcastOverlay").then((m) => ({
    default: m.BroadcastOverlay,
  })),
);
const AdminNews = lazy(() =>
  import("./pages/admin/AdminNews").then((m) => ({ default: m.AdminNews })),
);
// const AdminGallery = lazy(() => import('./pages/admin/AdminGallery').then(m => ({ default: m.AdminGallery })));
const AdminHeroSlides = lazy(() =>
  import("./pages/admin/AdminHeroSlides").then((m) => ({
    default: m.AdminHeroSlides,
  })),
);
const AdminLiveStream = lazy(() =>
  import("./pages/admin/AdminLiveStream").then((m) => ({
    default: m.AdminLiveStream,
  })),
);
const AdminPlayers = lazy(() =>
  import("./pages/admin/AdminPlayers").then((m) => ({
    default: m.AdminPlayers,
  })),
);
const AdminStats = lazy(() =>
  import("./pages/admin/AdminStats").then((m) => ({ default: m.AdminStats })),
);
const AdminStandings = lazy(() =>
  import("./pages/admin/AdminStandings").then((m) => ({
    default: m.AdminStandings,
  })),
);
const AdminTickets = lazy(() =>
  import("./pages/admin/AdminTickets").then((m) => ({
    default: m.AdminTickets,
  })),
);
const AdminEventDays = lazy(() =>
  import("./pages/admin/AdminEventDays").then((m) => ({
    default: m.AdminEventDays,
  })),
);
const AdminSeasonTierRates = lazy(() =>
  import("./pages/admin/AdminSeasonTierRates").then((m) => ({
    default: m.AdminSeasonTierRates,
  })),
);
const AdminGamePassDiscounts = lazy(() =>
  import("./pages/admin/AdminGamePassDiscounts").then((m) => ({
    default: m.AdminGamePassDiscounts,
  })),
);
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminTeams = lazy(() => import("./pages/admin/AdminTeams"));
const AdminTeamDetail = lazy(() =>
  import("./pages/admin/AdminTeamDetail").then((m) => ({
    default: m.AdminTeamDetail,
  })),
);
const AdminCompetitions = lazy(() => import("./pages/admin/AdminCompetitions"));
const AdminCompetitionTeams = lazy(() =>
  import("./pages/admin/AdminCompetitionTeams").then((m) => ({
    default: m.AdminCompetitionTeams,
  })),
);
const AdminAnalytics = lazy(() =>
  import("./pages/admin/AdminAnalytics").then((m) => ({
    default: m.AdminAnalytics,
  })),
);
const AdminInventory = lazy(() =>
  import("./pages/admin/AdminInventory").then((m) => ({
    default: m.AdminInventory,
  })),
);
const AdminStore = lazy(() =>
  import("./pages/admin/AdminStore").then((m) => ({ default: m.AdminStore })),
);
const AdminReferrals = lazy(() =>
  import("./pages/admin/AdminReferrals").then((m) => ({
    default: m.AdminReferrals,
  })),
);
const AdminGiftTicket = lazy(() =>
  import("./pages/admin/AdminGiftTicket").then((m) => ({
    default: m.AdminGiftTicket,
  })),
);
const AdminOrderDetail = lazy(() =>
  import("./pages/admin/AdminOrderDetail").then((m) => ({
    default: m.AdminOrderDetail,
  })),
);
const AdminPlayerClaims = lazy(() => import("./pages/admin/AdminPlayerClaims"));
const AdminContracts = lazy(() => import("./pages/admin/AdminContracts"));
const AdminTransfers = lazy(() => import("./pages/admin/AdminTransfers"));
const AdminTransferWindows = lazy(
  () => import("./pages/admin/AdminTransferWindows"),
);
const AdminSettings = lazy(() =>
  import("./pages/admin/AdminSettings").then((m) => ({
    default: m.AdminSettings,
  })),
);
const AdminFantasy = lazy(() =>
  import("./pages/admin/AdminFantasy").then((m) => ({
    default: m.AdminFantasy,
  })),
);
const AdminTOTW = lazy(() =>
  import("./pages/admin/AdminTOTW").then((m) => ({ default: m.AdminTOTW })),
);
const AdminBadges = lazy(() =>
  import("./pages/admin/AdminBadges").then((m) => ({ default: m.AdminBadges })),
);

// Lazy load Team Head Pages
const TeamHeadLayout = lazy(() => import("./pages/team-head/TeamHeadLayout"));
const TeamHeadOverview = lazy(
  () => import("./pages/team-head/TeamHeadOverview"),
);
const TeamHeadPlayers = lazy(() => import("./pages/team-head/TeamHeadPlayers"));
const TeamHeadContracts = lazy(() =>
  import("./pages/team-head/TeamHeadContracts").then((m) => ({
    default: m.TeamHeadContracts,
  })),
);
const TeamHeadTransfers = lazy(() =>
  import("./pages/team-head/TeamHeadTransfers").then((m) => ({
    default: m.TeamHeadTransfers,
  })),
);
const TeamHeadBudget = lazy(() =>
  import("./pages/team-head/TeamHeadBudget").then((m) => ({
    default: m.TeamHeadBudget,
  })),
);
const TeamTickets = lazy(() => import("./pages/team-head/TeamTickets"));
const TeamHeadClaims = lazy(() => import("./pages/team-head/TeamHeadClaims"));
const TeamHeadTeamSheets = lazy(
  () => import("./pages/team-head/TeamHeadTeamSheets"),
);

// Lazy load Player Portal Pages
const PlayerPortalLayout = lazy(
  () => import("./pages/player-portal/PlayerPortalLayout"),
);
const PlayerPortalOverview = lazy(
  () => import("./pages/player-portal/PlayerPortalOverview"),
);
const PlayerPortalContracts = lazy(
  () => import("./pages/player-portal/PlayerPortalContracts"),
);
const PlayerPortalTransfers = lazy(() =>
  import("./pages/player-portal/PlayerPortalTransfers").then((m) => ({
    default: m.PlayerPortalTransfers,
  })),
);

// Player account claim flow. Unlisted by design: reachable by URL for players
// onboarding off the historical import, but never linked from navigation.
const ClaimAccount = lazy(() => import("./pages/claim/ClaimAccount"));
const ClaimStatus = lazy(() => import("./pages/claim/ClaimStatus"));
const ClaimVerifyEmail = lazy(() => import("./pages/claim/ClaimVerifyEmail"));

// Lazy load Seller Pages
const SellerLayout = lazy(() =>
  import("./pages/seller/SellerLayout").then((m) => ({
    default: m.SellerLayout,
  })),
);
const SellerLogSale = lazy(() =>
  import("./pages/seller/SellerLogSale").then((m) => ({
    default: m.SellerLogSale,
  })),
);
const SellerSales = lazy(() =>
  import("./pages/seller/SellerSales").then((m) => ({
    default: m.SellerSales,
  })),
);

import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";

function App() {
  return (
    <FontProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
            <BrowserRouter>
              <ScrollToTop />
              <AdSenseScript />
              {/* Visitor analytics. Both render null; see config/analytics.ts for
                  why there are two and what each one is actually good for. */}
              <Analytics />
              <BrevoTracker />
              <ErrorBoundary>
                <Suspense fallback={<Loader />}>
                  <Routes>
                    {/* Player account claim flow — standalone, no site chrome, not in nav */}
                    <Route path="/claim" element={<ClaimAccount />} />
                    <Route
                      path="/claim/verify"
                      element={<ClaimVerifyEmail />}
                    />
                    <Route
                      path="/claim/status"
                      element={
                        <ProtectedRoute>
                          <ClaimStatus />
                        </ProtectedRoute>
                      }
                    />

                    {/* Public Routes with Layout */}
                    <Route element={<Layout />}>
                      <Route path="/" element={<Landing />} />

                      {/* Auth Routes */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route
                        path="/forgot-password"
                        element={<ForgotPassword />}
                      />

                      {/* Main Features */}
                      <Route path="/matches" element={<MatchHub />} />
                      <Route path="/matches/:id" element={<MatchDetail />} />
                      <Route path="/standings" element={<Standings />} />
                      <Route path="/stats" element={<Stats />} />
                      <Route path="/totw" element={<TeamOfTheWeek />} />
                      <Route path="/totw/:id" element={<TeamOfTheWeek />} />
                      <Route path="/potw" element={<PlayerOfTheWeek />} />
                      <Route path="/potw/:id" element={<PlayerOfTheWeek />} />
                      <Route
                        path="/team-of-the-week"
                        element={<Navigate to="/totw" replace />}
                      />
                      <Route path="/news" element={<NewsList />} />
                      <Route path="/news/:slug" element={<NewsDetail />} />
                      {/* <Route path="/gallery" element={<Gallery />} /> */}
                      <Route
                        path="/tickets/confirm"
                        element={<TicketConfirmation />}
                      />
                      <Route
                        path="/tickets/referrals"
                        element={<ReferralGenerator />}
                      />

                      {/* Player Profiles */}
                      <Route path="/players" element={<Players />} />
                      <Route path="/players/:id" element={<PlayerDetail />} />

                      {/* Teams */}
                      <Route path="/teams" element={<Teams />} />
                      <Route path="/teams/:id" element={<TeamDetail />} />

                      {/* Store */}
                      <Route element={<StoreLayout />}>
                        <Route element={<GamedayStoreLayout />}>
                          <Route path="/tickets" element={<Tickets />} />
                          <Route path="/tickets/game-pass" element={<GamePass />} />
                        </Route>
                        <Route path="/store" element={<Store />} />
                        <Route
                          path="/store/products/:id"
                          element={<ProductDetail />}
                        />
                        <Route
                          path="/store/products/:id/reviews"
                          element={<ProductReviews />}
                        />
                        <Route path="/store/cart" element={<Cart />} />
                        <Route path="/store/checkout" element={<Checkout />} />
                        <Route
                          path="/store/confirm"
                          element={<OrderConfirmation />}
                        />
                        <Route path="/store/orders" element={<MyOrders />} />
                      </Route>
                      <Route path="/account" element={<MyProfile />} />

                      {/* Fantasy Flag Football */}
                      <Route path="/fantasy" element={<FantasyHub />} />
                      <Route
                        path="/fantasy/dashboard"
                        element={
                          <ProtectedRoute
                            actionText="see your fantasy dashboard"
                            fallbackPath="/fantasy"
                          >
                            <FantasyDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/fantasy/build"
                        element={
                          <ProtectedRoute
                            actionText="pick your squad"
                            fallbackPath="/fantasy"
                          >
                            <FantasySquadBuilder />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/fantasy/my-team"
                        element={
                          <ProtectedRoute
                            actionText="see your squad"
                            fallbackPath="/fantasy"
                          >
                            <FantasyMyTeam />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/fantasy/leagues"
                        element={
                          <ProtectedRoute
                            actionText="join and manage fantasy leagues"
                            fallbackPath="/fantasy"
                          >
                            <FantasyLeagues />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/fantasy/wallet"
                        element={
                          <ProtectedRoute
                            actionText="open your prize wallet"
                            fallbackPath="/fantasy"
                          >
                            <FantasyWallet />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/fantasy/trading"
                        element={<Navigate to="/fantasy/build" replace />}
                      />
                      <Route
                        path="/fantasy/leaderboard/:id"
                        element={<FantasyLeaderboard />}
                      />
                      <Route
                        path="/fantasy/analytics"
                        element={<FantasyAnalytics />}
                      />
                      <Route
                        path="/fantasy/reports"
                        element={<Navigate to="/fantasy/analytics" replace />}
                      />
                      <Route
                        path="/fantasy/leagues/confirm"
                        element={
                          <ProtectedRoute
                            actionText="confirm your league payment"
                            fallbackPath="/fantasy"
                          >
                            <FantasyLeagueConfirm />
                          </ProtectedRoute>
                        }
                      />

                      {/* About Us Pages */}
                      <Route
                        path="/about/showtime-flag"
                        element={<AboutShowtimeFlag />}
                      />
                      <Route
                        path="/about/media-guidelines"
                        element={<MediaGuidelines />}
                      />
                      <Route path="/about/rules" element={<GameplayRules />} />
                      <Route
                        path="/about/byelaws"
                        element={<ShowtimeByelaws />}
                      />
                      <Route path="/about/arena" element={<ShowtimeArena />} />
                      <Route path="/about/education" element={<Education />} />
                      <Route path="/about/faq" element={<FAQ />} />
                      <Route
                        path="/about/whistleblower"
                        element={<Whistleblower />}
                      />
                      <Route path="/about/our-team" element={<OurTeam />} />
                      <Route
                        path="/about/sponsorships"
                        element={<Sponsorships />}
                      />
                      <Route
                        path="/about/privacy"
                        element={<PrivacyPolicy />}
                      />
                    </Route>

                    {/* Admin Routes (No Layout) */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute
                          requireRole={[
                            "admin",
                            "app_admin",
                            "broadcast",
                            "ticketer",
                            "referee",
                            "stats",
                            "commissioner",
                            "fantasy_commissioner",
                            "head_referee",
                            "news_head",
                            "content_creator",
                            "store_manager",
                          ]}
                        >
                          <AdminLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route
                        index
                        element={
                          <FeatureGuard feature="dashboard">
                            <Dashboard />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="analytics"
                        element={
                          <FeatureGuard feature="dashboard">
                            <AdminAnalytics />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="matches"
                        element={
                          <FeatureGuard feature="matches">
                            <AdminMatches />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="play-by-play"
                        element={
                          <FeatureGuard feature="play_by_play">
                            <AdminPlayByPlay />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="broadcast"
                        element={
                          <FeatureGuard feature="broadcast_studio">
                            <AdminBroadcastPicker />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="broadcast/:matchId"
                        element={
                          <FeatureGuard feature="broadcast_studio">
                            <AdminBroadcastStudio />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="broadcast/day/:date"
                        element={
                          <FeatureGuard feature="broadcast_studio">
                            <AdminBroadcastDay />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="news"
                        element={
                          <FeatureGuard feature="news">
                            <AdminNews />
                          </FeatureGuard>
                        }
                      />
                      {/* <Route path="gallery" element={<AdminGallery />} /> */}
                      <Route
                        path="hero-slides"
                        element={
                          <FeatureGuard feature="hero_slides">
                            <AdminHeroSlides />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="live-stream"
                        element={
                          <FeatureGuard feature="live_stream">
                            <AdminLiveStream />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="players"
                        element={
                          <FeatureGuard feature="players">
                            <AdminPlayers />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="stats"
                        element={
                          <FeatureGuard feature="stats_edit">
                            <AdminStats />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="standings"
                        element={
                          <FeatureGuard feature="teams_standings">
                            <AdminStandings />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="totw"
                        element={
                          <FeatureGuard feature="totw">
                            <AdminTOTW />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="badges"
                        element={
                          <FeatureGuard feature="badges">
                            <AdminBadges />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="tickets"
                        element={
                          <FeatureGuard feature="tickets">
                            <AdminTickets />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="referrals"
                        element={
                          <FeatureGuard feature="referrals">
                            <AdminReferrals />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="administrator"
                        element={
                          <FeatureGuard feature="administrator_tools">
                            <AdminGiftTicket />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="event-days"
                        element={
                          <FeatureGuard feature="event_days">
                            <AdminEventDays />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="season-admission-tiers"
                        element={
                          <FeatureGuard feature="season_admission_tiers">
                            <AdminSeasonTierRates />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="game-pass/discount-bands"
                        element={
                          <FeatureGuard feature="game_pass_discounts">
                            <AdminGamePassDiscounts />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="users"
                        element={
                          <FeatureGuard feature="user_management">
                            <AdminUsers />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="teams"
                        element={
                          <FeatureGuard feature="teams_standings">
                            <AdminTeams />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="teams/:id"
                        element={
                          <FeatureGuard feature="teams_standings">
                            <AdminTeamDetail />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="competitions"
                        element={
                          <FeatureGuard feature="competitions">
                            <AdminCompetitions />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="competitions/:id/teams"
                        element={
                          <FeatureGuard feature="competitions">
                            <AdminCompetitionTeams />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="inventory"
                        element={
                          <FeatureGuard feature="inventory">
                            <AdminInventory />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="store"
                        element={
                          <FeatureGuard feature="store">
                            <AdminStore />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="store/orders/:id"
                        element={
                          <FeatureGuard feature="store">
                            <AdminOrderDetail />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="contracts"
                        element={
                          <FeatureGuard feature="contracts">
                            <AdminContracts />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="player-claims"
                        element={
                          <FeatureGuard feature="claims">
                            <AdminPlayerClaims />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="transfers"
                        element={
                          <FeatureGuard feature="transfers">
                            <AdminTransfers />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="transfer-windows"
                        element={
                          <FeatureGuard feature="transfer_windows">
                            <AdminTransferWindows />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="fantasy"
                        element={
                          <FeatureGuard feature="fantasy">
                            <AdminFantasy />
                          </FeatureGuard>
                        }
                      />
                      <Route
                        path="settings"
                        element={
                          <FeatureGuard feature="app_settings">
                            <AdminSettings />
                          </FeatureGuard>
                        }
                      />
                    </Route>

                    {/* Team Head Routes */}
                    <Route
                      path="/team-head"
                      element={
                        <ProtectedRoute requireRole={["team_head", "admin"]}>
                          <TeamHeadLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<TeamHeadOverview />} />
                      <Route path="players" element={<TeamHeadPlayers />} />
                      <Route
                        path="team-sheets"
                        element={<TeamHeadTeamSheets />}
                      />
                      <Route path="contracts" element={<TeamHeadContracts />} />
                      <Route path="transfers" element={<TeamHeadTransfers />} />
                      <Route path="budget" element={<TeamHeadBudget />} />
                      <Route path="tickets" element={<TeamTickets />} />
                      <Route path="claims" element={<TeamHeadClaims />} />
                    </Route>

                    {/* Player Portal Routes */}
                    <Route
                      path="/player-portal"
                      element={
                        <ProtectedRoute requireRole={["player", "admin"]}>
                          <PlayerPortalLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<PlayerPortalOverview />} />
                      <Route
                        path="contracts"
                        element={<PlayerPortalContracts />}
                      />
                      <Route
                        path="transfers"
                        element={<PlayerPortalTransfers />}
                      />
                    </Route>

                    {/* Seller Portal Routes */}
                    <Route
                      path="/seller"
                      element={
                        <ProtectedRoute requireRole={["admin", "seller"]}>
                          <SellerLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<SellerLogSale />} />
                      <Route path="sales" element={<SellerSales />} />
                    </Route>

                    {/* Public vMix Broadcast Overlay (Transparent, standalone) */}
                    <Route
                      path="/broadcast/:matchId/overlay"
                      element={<BroadcastOverlay />}
                    />
                    <Route
                      path="/broadcast/day/:date/overlay"
                      element={<BroadcastOverlay />}
                    />

                    {/* Catch-all route to redirect back to home automatically */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </FontProvider>
  );
}

export default App;
