import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CartProvider } from './contexts/CartContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { ScrollToTop } from './components/common/ScrollToTop';
import { LandingPage } from './pages/LandingPage';
import { StorePage } from './pages/StorePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { ProductReviewsPage } from './pages/ProductReviewsPage';
import { CartPage } from './pages/CartPage';
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
import { NewsList } from './pages/news/NewsList';
import { MatchHub } from './pages/matches/MatchHub';
import { MatchDetail } from './pages/matches/MatchDetail';
import { StandingsPage } from './pages/matches/StandingsPage';
import { StatsPage } from './pages/stats/StatsPage';
import { NewsDetail } from './pages/news/NewsDetail';
import { GalleryPage } from './pages/gallery/GalleryPage';
import { TicketsPage } from './pages/tickets/TicketsPage';
import { TicketConfirmation } from './pages/tickets/TicketConfirmation';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { HighlightsPage } from './pages/HighlightsPage';
import { PlayersPage } from './pages/players/PlayersPage';
import { PlayerDetail } from './pages/players/PlayerDetail';
import { AdminLayout } from './pages/admin/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { AdminMatches } from './pages/admin/AdminMatches';
import { AdminNews } from './pages/admin/AdminNews';
import { AdminGallery } from './pages/admin/AdminGallery';
import { AdminPlayers } from './pages/admin/AdminPlayers';
import { AdminStats } from './pages/admin/AdminStats';
import { AdminStandings } from './pages/admin/AdminStandings';
import { AdminTickets } from './pages/admin/AdminTickets';
import { AdminEventDays } from './pages/admin/AdminEventDays';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTeams from './pages/admin/AdminTeams';
import AdminCompetitions from './pages/admin/AdminCompetitions';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';
import { AdminInventory } from './pages/admin/AdminInventory';
import { AdminStore } from './pages/admin/AdminStore';
import { AdminOrderDetail } from './pages/admin/AdminOrderDetail';
import { AdminTOTW } from './pages/admin/AdminTOTW';
import { TOTWPage } from './pages/stats/TOTWPage';
import TeamHeadLayout from './pages/team-head/TeamHeadLayout';
import TeamHeadOverview from './pages/team-head/TeamHeadOverview';
import TeamHeadPlayers from './pages/team-head/TeamHeadPlayers';
import TeamTickets from './pages/team-head/TeamTickets';
import { SellerLayout } from './pages/seller/SellerLayout';
import { SellerPortal } from './pages/seller/SellerPortal';
import { Toaster } from 'react-hot-toast';
import { FloatingThemeToggle } from './components/common/FloatingThemeToggle';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <FloatingThemeToggle />
      <AuthProvider>
        <CartProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
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
              <Route path="/team-of-the-week" element={<TOTWPage />} />
              <Route path="/news" element={<NewsList />} />
              <Route path="/news/:slug" element={<NewsDetail />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/confirm" element={<TicketConfirmation />} />
              <Route path="/highlights" element={<HighlightsPage />} />

              {/* Player Profiles */}
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/players/:id" element={<PlayerDetail />} />

              {/* Store Pages */}
              <Route path="/store" element={<StorePage />} />
              <Route path="/store/products/:id" element={<ProductDetailPage />} />
              <Route path="/store/products/:id/reviews" element={<ProductReviewsPage />} />
              <Route path="/store/cart" element={<CartPage />} />
              <Route path="/store/checkout" element={<CheckoutPage />} />
              <Route path="/store/confirm" element={<OrderConfirmationPage />} />
              <Route path="/store/orders" element={<MyOrdersPage />} />

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
            </Route>

            {/* Admin Routes (No Layout) */}
            <Route path="/admin" element={
              <ProtectedRoute requireRole={['admin', 'ticketer', 'referee', 'stats']}>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="matches" element={<AdminMatches />} />
              <Route path="news" element={<AdminNews />} />
              <Route path="gallery" element={<AdminGallery />} />
              <Route path="players" element={<AdminPlayers />} />
              <Route path="stats" element={<AdminStats />} />
              <Route path="totw" element={<AdminTOTW />} />
              <Route path="standings" element={<AdminStandings />} />
              <Route path="tickets" element={<AdminTickets />} />
              <Route path="event-days" element={<AdminEventDays />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="teams" element={<AdminTeams />} />
              <Route path="competitions" element={<AdminCompetitions />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="store" element={<AdminStore />} />
              <Route path="store/orders/:id" element={<AdminOrderDetail />} />
            </Route>

            {/* Team Head Routes */}
            <Route path="/team-head" element={
              <ProtectedRoute requireRole={['team_head', 'admin']}>
                <TeamHeadLayout />
              </ProtectedRoute>
            }>
              <Route index element={<TeamHeadOverview />} />
              <Route path="players" element={<TeamHeadPlayers />} />
              <Route path="tickets" element={<TeamTickets />} />
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
        </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}



export default App;
