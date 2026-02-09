import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { LandingPage } from './pages/LandingPage';
import { CommissionersNote } from './pages/CommissionersNote';
import { StorePage } from './pages/StorePage';
import { AboutShowtimeFlag } from './pages/about/AboutShowtimeFlag';
import { MediaGuidelines } from './pages/about/MediaGuidelines';
import { GameplayRules } from './pages/about/GameplayRules';
import { ShowtimeByelaws } from './pages/about/ShowtimeByelaws';
import { ShowtimeArena } from './pages/about/ShowtimeArena';
import { Education } from './pages/about/Education';
import { FAQ } from './pages/about/FAQ';
import { Whistleblower } from './pages/about/Whistleblower';
import { NewsList } from './pages/news/NewsList';
import { NewsDetail } from './pages/news/NewsDetail';
import { GalleryPage } from './pages/gallery/GalleryPage';
import { TicketsPage } from './pages/tickets/TicketsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { HighlightsPage } from './pages/HighlightsPage';
import { PlayersPage } from './pages/players/PlayersPage';
import { PlayerDetail } from './pages/players/PlayerDetail';
import { AdminLayout } from './pages/admin/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes with Layout */}
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />

              {/* Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              {/* Main Features */}
              <Route path="/schedule" element={<PlaceholderPage title="Match Hub" />} />
              <Route path="/standings" element={<PlaceholderPage title="Standings" />} />
              <Route path="/news" element={<NewsList />} />
              <Route path="/news/:slug" element={<NewsDetail />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/highlights" element={<HighlightsPage />} />

              {/* Player Profiles */}
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/players/:id" element={<PlayerDetail />} />

              {/* Static Pages */}
              <Route path="/commissioners-note" element={<CommissionersNote />} />
              <Route path="/store" element={<StorePage />} />

              {/* About Us Pages */}
              <Route path="/about/showtime-flag" element={<AboutShowtimeFlag />} />
              <Route path="/about/media-guidelines" element={<MediaGuidelines />} />
              <Route path="/about/rules" element={<GameplayRules />} />
              <Route path="/about/byelaws" element={<ShowtimeByelaws />} />
              <Route path="/about/arena" element={<ShowtimeArena />} />
              <Route path="/about/education" element={<Education />} />
              <Route path="/about/faq" element={<FAQ />} />
              <Route path="/about/whistleblower" element={<Whistleblower />} />
            </Route>

            {/* Admin Routes (No Layout) */}
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="matches" element={<PlaceholderPage title="Match Management" />} />
              <Route path="news" element={<PlaceholderPage title="News Management" />} />
              <Route path="gallery" element={<PlaceholderPage title="Gallery Management" />} />
              <Route path="users" element={<PlaceholderPage title="User Management" />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Temporary placeholder component
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="text-center py-20">
    <h1 className="text-5xl font-black italic text-sffl-navy mb-4">{title}</h1>
    <p className="text-xl text-gray-600">Coming Soon - Backend Integration Required</p>
  </div>
);

export default App;
