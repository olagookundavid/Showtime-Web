import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { FontProvider } from './contexts/FontContext';
import { CartProvider } from './contexts/CartContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { ScrollToTop } from './components/common/ScrollToTop';
import { LandingPage } from './pages/LandingPage';
import { Loader } from './components/ui/Loader';

// Lazy load Store Pages
const StorePage = lazy(() => import('./pages/StorePage').then(m => ({ default: m.StorePage })));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage').then(m => ({ default: m.OrderConfirmationPage })));
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage').then(m => ({ default: m.MyOrdersPage })));
const ProductReviewsPage = lazy(() => import('./pages/ProductReviewsPage').then(m => ({ default: m.ProductReviewsPage })));
const CartPage = lazy(() => import('./pages/CartPage').then(m => ({ default: m.CartPage })));

// Lazy load Fantasy Pages
const FantasyHub = lazy(() => import('./pages/fantasy/FantasyHub').then(m => ({ default: m.FantasyHub })));
const FantasyDashboard = lazy(() => import('./pages/fantasy/FantasyDashboard').then(m => ({ default: m.FantasyDashboard })));
const FantasySquadBuilder = lazy(() => import('./pages/fantasy/FantasySquadBuilder').then(m => ({ default: m.FantasySquadBuilder })));
const FantasyMyTeam = lazy(() => import('./pages/fantasy/FantasyMyTeam').then(m => ({ default: m.FantasyMyTeam })));
const FantasyLeagues = lazy(() => import('./pages/fantasy/FantasyLeagues').then(m => ({ default: m.FantasyLeagues })));
const FantasyLeagueConfirm = lazy(() => import('./pages/fantasy/FantasyLeagueConfirm').then(m => ({ default: m.FantasyLeagueConfirm })));
const FantasyLeaderboard = lazy(() => import('./pages/fantasy/FantasyLeaderboard').then(m => ({ default: m.FantasyLeaderboard })));
const FantasyWallet = lazy(() => import('./pages/fantasy/FantasyWallet').then(m => ({ default: m.FantasyWallet })));

import { AboutShowtimeFlag } from './pages/about/AboutShowtimeFlag';
import { MediaGuidelines } from './pages/about/MediaGuidelines';
import { GameplayRules } from './pages/about/GameplayRules';
import { ShowtimeByelaws } from './pages/about/ShowtimeByelaws';
import { ShowtimeArena } from './pages/about/ShowtimeArena';
import { Education } from './pages/about/Education';
import { FAQ } from './pages/about/FAQ';
import { Whistleblower } from './pages/about/Whistleblower';
import { OurTeam } from './pages/about/OurTeam';
import { Sponsorships } from './pages/about/Sponsorships';
import { PrivacyPolicy } from './pages/about/PrivacyPolicy';
import { NewsList } from './pages/news/NewsList';
import { MatchHub } from './pages/matches/MatchHub';
import { MatchDetail } from './pages/matches/MatchDetail';
import { StandingsPage } from './pages/matches/StandingsPage';
import { StatsPage } from './pages/stats/StatsPage';
import { NewsDetail } from './pages/news/NewsDetail';
// import { GalleryPage } from './pages/gallery/GalleryPage';
import { TicketsPage } from './pages/tickets/TicketsPage';
import { TicketConfirmation } from './pages/tickets/TicketConfirmation';
import { ReferralGeneratorPage } from './pages/tickets/ReferralGeneratorPage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { PlayersPage } from './pages/players/PlayersPage';
import { PlayerDetail } from './pages/players/PlayerDetail';
import { TeamsPage } from './pages/teams/TeamsPage';
import { TeamDetail } from './pages/teams/TeamDetail';

// Lazy load Admin Pages
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const Dashboard = lazy(() => import('./pages/admin/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminMatches = lazy(() => import('./pages/admin/AdminMatches').then(m => ({ default: m.AdminMatches })));
const AdminPlayByPlay = lazy(() => import('./pages/admin/AdminPlayByPlay').then(m => ({ default: m.AdminPlayByPlay })));
const AdminNews = lazy(() => import('./pages/admin/AdminNews').then(m => ({ default: m.AdminNews })));
// const AdminGallery = lazy(() => import('./pages/admin/AdminGallery').then(m => ({ default: m.AdminGallery })));
const AdminHeroSlides = lazy(() => import('./pages/admin/AdminHeroSlides').then(m => ({ default: m.AdminHeroSlides })));
const AdminLiveStream = lazy(() => import('./pages/admin/AdminLiveStream').then(m => ({ default: m.AdminLiveStream })));
const AdminPlayers = lazy(() => import('./pages/admin/AdminPlayers').then(m => ({ default: m.AdminPlayers })));
const AdminStats = lazy(() => import('./pages/admin/AdminStats').then(m => ({ default: m.AdminStats })));
const AdminStandings = lazy(() => import('./pages/admin/AdminStandings').then(m => ({ default: m.AdminStandings })));
const AdminTickets = lazy(() => import('./pages/admin/AdminTickets').then(m => ({ default: m.AdminTickets })));
const AdminEventDays = lazy(() => import('./pages/admin/AdminEventDays').then(m => ({ default: m.AdminEventDays })));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminTeams = lazy(() => import('./pages/admin/AdminTeams'));
const AdminCompetitions = lazy(() => import('./pages/admin/AdminCompetitions'));
const AdminCompetitionTeams = lazy(() => import('./pages/admin/AdminCompetitionTeams').then(m => ({ default: m.AdminCompetitionTeams })));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory').then(m => ({ default: m.AdminInventory })));
const AdminStore = lazy(() => import('./pages/admin/AdminStore').then(m => ({ default: m.AdminStore })));
const AdminReferrals = lazy(() => import('./pages/admin/AdminReferrals').then(m => ({ default: m.AdminReferrals })));
const AdminGiftTicket = lazy(() => import('./pages/admin/AdminGiftTicket').then(m => ({ default: m.AdminGiftTicket })));
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrderDetail').then(m => ({ default: m.AdminOrderDetail })));
// Team of the Week disabled for now (likely becoming a static image like
// Team of the Season) — routes commented out below so no TOTW API calls fire.
// const AdminTOTW = lazy(() => import('./pages/admin/AdminTOTW').then(m => ({ default: m.AdminTOTW })));
// const TOTWPage = lazy(() => import('./pages/stats/TOTWPage').then(m => ({ default: m.TOTWPage })));

const AdminPlayerClaims = lazy(() => import('./pages/admin/AdminPlayerClaims'));
const AdminContracts = lazy(() => import('./pages/admin/AdminContracts'));
const AdminTransfers = lazy(() => import('./pages/admin/AdminTransfers'));
const AdminTransferWindows = lazy(() => import('./pages/admin/AdminTransferWindows'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminFantasy = lazy(() => import('./pages/admin/AdminFantasy').then(m => ({ default: m.AdminFantasy })));

// Lazy load Team Head Pages
const TeamHeadLayout = lazy(() => import('./pages/team-head/TeamHeadLayout'));
const TeamHeadOverview = lazy(() => import('./pages/team-head/TeamHeadOverview'));
const TeamHeadPlayers = lazy(() => import('./pages/team-head/TeamHeadPlayers'));
const TeamHeadContracts = lazy(() => import('./pages/team-head/TeamHeadContracts').then(m => ({ default: m.TeamHeadContracts })));
const TeamHeadTransfers = lazy(() => import('./pages/team-head/TeamHeadTransfers').then(m => ({ default: m.TeamHeadTransfers })));
const TeamHeadBudget = lazy(() => import('./pages/team-head/TeamHeadBudget').then(m => ({ default: m.TeamHeadBudget })));
const TeamTickets = lazy(() => import('./pages/team-head/TeamTickets'));
const TeamHeadClaims = lazy(() => import('./pages/team-head/TeamHeadClaims'));

// Lazy load Player Portal Pages
const PlayerPortalLayout = lazy(() => import('./pages/player-portal/PlayerPortalLayout'));
const PlayerPortalOverview = lazy(() => import('./pages/player-portal/PlayerPortalOverview'));
const PlayerPortalContracts = lazy(() => import('./pages/player-portal/PlayerPortalContracts'));
const PlayerPortalTransfers = lazy(() => import('./pages/player-portal/PlayerPortalTransfers').then(m => ({ default: m.PlayerPortalTransfers })));

// Player account claim flow. Unlisted by design: reachable by URL for players
// onboarding off the historical import, but never linked from navigation.
const ClaimAccountPage = lazy(() => import('./pages/claim/ClaimAccountPage'));
const ClaimStatusPage = lazy(() => import('./pages/claim/ClaimStatusPage'));
const ClaimVerifyEmailPage = lazy(() => import('./pages/claim/ClaimVerifyEmailPage'));

// Lazy load Seller Pages
const SellerLayout = lazy(() => import('./pages/seller/SellerLayout').then(m => ({ default: m.SellerLayout })));
const SellerPortal = lazy(() => import('./pages/seller/SellerPortal').then(m => ({ default: m.SellerPortal })));

import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { FloatingThemeToggle } from './components/common/FloatingThemeToggle';
import { AdSenseScript } from './components/monetization';
import { BrevoTracker } from './components/analytics';
import { Analytics } from '@vercel/analytics/react';
import './index.css';

function App() {
  return (
    <FontProvider>
      <ThemeProvider>
      <FloatingThemeToggle />
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
            <Route path="/claim" element={<ClaimAccountPage />} />
            <Route path="/claim/verify" element={<ClaimVerifyEmailPage />} />
            <Route path="/claim/status" element={
              <ProtectedRoute>
                <ClaimStatusPage />
              </ProtectedRoute>
            } />

            {/* Public Routes with Layout */}
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />

              {/* Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />

              {/* Main Features */}
              <Route path="/matches" element={<MatchHub />} />
              <Route path="/matches/:id" element={<MatchDetail />} />
              <Route path="/standings" element={<StandingsPage />} />
              <Route path="/stats" element={<StatsPage />} />
              {/* <Route path="/team-of-the-week" element={<TOTWPage />} /> */}
              <Route path="/news" element={<NewsList />} />
              <Route path="/news/:slug" element={<NewsDetail />} />
              {/* <Route path="/gallery" element={<GalleryPage />} /> */}
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/confirm" element={<TicketConfirmation />} />
              <Route path="/tickets/referrals" element={<ReferralGeneratorPage />} />

              {/* Player Profiles */}
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/players/:id" element={<PlayerDetail />} />

              {/* Teams */}
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/:id" element={<TeamDetail />} />

              {/* Store Pages */}
              <Route path="/store" element={<StorePage />} />
              <Route path="/store/products/:id" element={<ProductDetailPage />} />
              <Route path="/store/products/:id/reviews" element={<ProductReviewsPage />} />
              <Route path="/store/cart" element={<CartPage />} />
              <Route path="/store/checkout" element={<CheckoutPage />} />
              <Route path="/store/confirm" element={<OrderConfirmationPage />} />
              <Route path="/store/orders" element={<MyOrdersPage />} />

              {/* Fantasy Flag Football */}
              <Route path="/fantasy" element={<FantasyHub />} />
              <Route path="/fantasy/dashboard" element={
                <ProtectedRoute>
                  <FantasyDashboard />
                </ProtectedRoute>
              } />
              <Route path="/fantasy/build" element={
                <ProtectedRoute>
                  <FantasySquadBuilder />
                </ProtectedRoute>
              } />
              <Route path="/fantasy/my-team" element={
                <ProtectedRoute>
                  <FantasyMyTeam />
                </ProtectedRoute>
              } />
              <Route path="/fantasy/leagues" element={
                <ProtectedRoute>
                  <FantasyLeagues />
                </ProtectedRoute>
              } />
              <Route path="/fantasy/wallet" element={
                <ProtectedRoute>
                  <FantasyWallet />
                </ProtectedRoute>
              } />
              <Route path="/fantasy/leaderboard/:id" element={<FantasyLeaderboard />} />
              <Route path="/fantasy/leagues/confirm" element={
                <ProtectedRoute>
                  <FantasyLeagueConfirm />
                </ProtectedRoute>
              } />

              {/* About Us Pages */}
              <Route path="/about/showtime-flag" element={<AboutShowtimeFlag />} />
              <Route path="/about/media-guidelines" element={<MediaGuidelines />} />
              <Route path="/about/rules" element={<GameplayRules />} />
              <Route path="/about/byelaws" element={<ShowtimeByelaws />} />
              <Route path="/about/arena" element={<ShowtimeArena />} />
              <Route path="/about/education" element={<Education />} />
              <Route path="/about/faq" element={<FAQ />} />
              <Route path="/about/whistleblower" element={<Whistleblower />} />
              <Route path="/about/our-team" element={<OurTeam />} />
              <Route path="/about/sponsorships" element={<Sponsorships />} />
              <Route path="/about/privacy" element={<PrivacyPolicy />} />
            </Route>

            {/* Admin Routes (No Layout) */}
            <Route path="/admin" element={
              <ProtectedRoute requireRole={['admin', 'app_admin', 'ticketer', 'referee', 'stats']}>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="matches" element={<AdminMatches />} />
              <Route path="play-by-play" element={<AdminPlayByPlay />} />
              <Route path="news" element={<AdminNews />} />
              {/* <Route path="gallery" element={<AdminGallery />} /> */}
              <Route path="hero-slides" element={<AdminHeroSlides />} />
              <Route path="live-stream" element={<AdminLiveStream />} />
              <Route path="players" element={<AdminPlayers />} />
              <Route path="stats" element={<AdminStats />} />
              {/* <Route path="totw" element={<AdminTOTW />} /> */}
              <Route path="standings" element={<AdminStandings />} />
              <Route path="tickets" element={<AdminTickets />} />
              <Route path="referrals" element={<AdminReferrals />} />
              <Route path="administrator" element={<AdminGiftTicket />} />
              <Route path="event-days" element={<AdminEventDays />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="teams" element={<AdminTeams />} />
              <Route path="competitions" element={<AdminCompetitions />} />
              <Route path="competitions/:id/teams" element={<AdminCompetitionTeams />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="store" element={<AdminStore />} />
              <Route path="store/orders/:id" element={<AdminOrderDetail />} />
              <Route path="contracts" element={<AdminContracts />} />
              <Route path="player-claims" element={<AdminPlayerClaims />} />
              <Route path="transfers" element={<AdminTransfers />} />
              <Route path="transfer-windows" element={<AdminTransferWindows />} />
              <Route path="fantasy" element={<AdminFantasy />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Team Head Routes */}
            <Route path="/team-head" element={
              <ProtectedRoute requireRole={['team_head', 'admin']}>
                <TeamHeadLayout />
              </ProtectedRoute>
            }>
              <Route index element={<TeamHeadOverview />} />
              <Route path="players" element={<TeamHeadPlayers />} />
              <Route path="contracts" element={<TeamHeadContracts />} />
              <Route path="transfers" element={<TeamHeadTransfers />} />
              <Route path="budget" element={<TeamHeadBudget />} />
              <Route path="tickets" element={<TeamTickets />} />
              <Route path="claims" element={<TeamHeadClaims />} />
            </Route>

            {/* Player Portal Routes */}
            <Route path="/player-portal" element={
              <ProtectedRoute requireRole={['player', 'admin']}>
                <PlayerPortalLayout />
              </ProtectedRoute>
            }>
              <Route index element={<PlayerPortalOverview />} />
              <Route path="contracts" element={<PlayerPortalContracts />} />
              <Route path="transfers" element={<PlayerPortalTransfers />} />
            </Route>

            {/* Seller Portal Routes */}
            <Route path="/seller" element={
              <ProtectedRoute requireRole={['admin', 'seller']}>
                <SellerLayout />
              </ProtectedRoute>
            }>
              <Route index element={<SellerPortal />} />
            </Route>

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
