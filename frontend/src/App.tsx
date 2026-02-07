import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* Home */}
          <Route path="/" element={<LandingPage />} />

          {/* Main Features (Placeholders for now) */}
          <Route path="/schedule" element={<PlaceholderPage title="Match Hub" />} />
          <Route path="/standings" element={<PlaceholderPage title="Standings" />} />
          <Route path="/news" element={<PlaceholderPage title="News" />} />
          <Route path="/gallery" element={<PlaceholderPage title="Gallery" />} />

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
        </Routes>
      </Layout>
    </BrowserRouter>
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
