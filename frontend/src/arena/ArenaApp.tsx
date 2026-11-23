import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, ThemeProvider } from '../contexts';
import { ErrorBoundary, Loader, ScrollToTop } from '../components';
import { ArenaScopeProvider } from './ArenaScope';
import { ArenaLayout } from './ArenaLayout';
import { RequireFeature, RequireManager, RequireSignIn } from './ArenaGuards';
import { ArenaLogin, ArenaSignup } from './pages/auth';

// Pages load on demand so a visitor only downloads the area they open.
const page = <K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

const Overview = page(() => import('./pages/public/Overview'), 'ArenaOverview');
const Matches = page(() => import('./pages/public/Matches'), 'ArenaMatches');
const MatchDetail = page(() => import('./pages/public/MatchDetail'), 'ArenaMatchDetail');
const Standings = page(() => import('./pages/public/Standings'), 'ArenaStandings');
const Players = page(() => import('./pages/public/Players'), 'ArenaPlayers');
const PlayerProfile = page(() => import('./pages/public/PlayerProfile'), 'ArenaPlayerProfile');
const Clubs = page(() => import('./pages/public/Clubs'), 'ArenaClubs');
const ClubProfile = page(() => import('./pages/public/ClubProfile'), 'ArenaClubProfile');
const Tournament = page(() => import('./pages/public/Tournament'), 'ArenaTournament');

const MyProfile = page(() => import('./pages/me/MyProfile'), 'ArenaMyProfile');
const MyContracts = page(() => import('./pages/me/MyContracts'), 'ArenaMyContracts');

const ManageClub = page(() => import('./pages/manage/ManageClub'), 'ArenaManageClub');
const ManageTransfers = page(() => import('./pages/manage/ManageTransfers'), 'ArenaManageTransfers');
const ManageTeamSheets = page(() => import('./pages/manage/ManageTeamSheets'), 'ArenaManageTeamSheets');

const AdminHome = page(() => import('./pages/admin/AdminHome'), 'ArenaAdminHome');
const AdminSeasons = page(() => import('./pages/admin/AdminSeasons'), 'ArenaAdminSeasons');
const AdminSeasonDetail = page(() => import('./pages/admin/AdminSeasonDetail'), 'ArenaAdminSeasonDetail');
const AdminClubs = page(() => import('./pages/admin/AdminClubs'), 'ArenaAdminClubs');
const AdminClubDetail = page(() => import('./pages/admin/AdminClubDetail'), 'ArenaAdminClubDetail');
const AdminPlayers = page(() => import('./pages/admin/AdminPlayers'), 'ArenaAdminPlayers');
const AdminResults = page(() => import('./pages/admin/AdminResults'), 'ArenaAdminResults');
const AdminResultEntry = page(() => import('./pages/admin/AdminResultEntry'), 'ArenaAdminResultEntry');
const AdminTransfers = page(() => import('./pages/admin/AdminTransfers'), 'ArenaAdminTransfers');

const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));

const ARENA_FEATURES = ['arena_seasons', 'arena_clubs', 'arena_results', 'arena_transfers'] as const;

export const ArenaApp = () => (
  <ThemeProvider>
    <AuthProvider>
      <Toaster position="top-center" toastOptions={{ style: { background: '#111923', color: '#fff' } }} />
      <BrowserRouter>
        <ScrollToTop />
        <ErrorBoundary>
          <ArenaScopeProvider>
            <Suspense fallback={<Loader />}>
              <Routes>
                <Route path="/login" element={<ArenaLogin />} />
                <Route path="/signup" element={<ArenaSignup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                <Route element={<ArenaLayout />}>
                  <Route index element={<Overview />} />
                  <Route path="matches" element={<Matches />} />
                  <Route path="matches/:id" element={<MatchDetail />} />
                  <Route path="standings" element={<Standings />} />
                  <Route path="players" element={<Players />} />
                  <Route path="players/:id" element={<PlayerProfile />} />
                  <Route path="clubs" element={<Clubs />} />
                  <Route path="clubs/:slug" element={<ClubProfile />} />
                  <Route path="tournament" element={<Tournament />} />

                  <Route path="me" element={<RequireSignIn actionText="see your profile"><MyProfile /></RequireSignIn>} />
                  <Route path="me/contracts" element={<RequireSignIn actionText="see your contract offers"><MyContracts /></RequireSignIn>} />

                  <Route path="manage" element={<RequireManager><ManageClub /></RequireManager>} />
                  <Route path="manage/transfers" element={<RequireManager><ManageTransfers /></RequireManager>} />
                  <Route path="manage/teamsheets" element={<RequireManager><ManageTeamSheets /></RequireManager>} />

                  <Route path="admin" element={<RequireFeature features={[...ARENA_FEATURES]}><AdminHome /></RequireFeature>} />
                  <Route path="admin/seasons" element={<RequireFeature features={['arena_seasons']}><AdminSeasons /></RequireFeature>} />
                  <Route path="admin/seasons/:id" element={<RequireFeature features={['arena_seasons']}><AdminSeasonDetail /></RequireFeature>} />
                  <Route path="admin/clubs" element={<RequireFeature features={['arena_clubs']}><AdminClubs /></RequireFeature>} />
                  <Route path="admin/clubs/:id" element={<RequireFeature features={['arena_clubs']}><AdminClubDetail /></RequireFeature>} />
                  <Route path="admin/players" element={<RequireFeature features={['arena_clubs']}><AdminPlayers /></RequireFeature>} />
                  <Route path="admin/results" element={<RequireFeature features={['arena_results']}><AdminResults /></RequireFeature>} />
                  <Route path="admin/results/:matchId" element={<RequireFeature features={['arena_results']}><AdminResultEntry /></RequireFeature>} />
                  <Route path="admin/transfers" element={<RequireFeature features={['arena_transfers']}><AdminTransfers /></RequireFeature>} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </ArenaScopeProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);
