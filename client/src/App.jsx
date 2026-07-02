import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ScreenLoader from './components/ScreenLoader.jsx';


const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const BookingRouter = lazy(() => import('./pages/BookingRouter.jsx'));
const AdminLogin = lazy(() => import('./pages/AdminLogin.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const BlockDates = lazy(() => import('./pages/admin/BlockDates.jsx'));
const Clients = lazy(() => import('./pages/admin/Clients.jsx'));
const Inbox = lazy(() => import('./pages/admin/Inbox.jsx'));
const WalkIn = lazy(() => import('./pages/admin/WalkIn.jsx'));
const DataAnalysis = lazy(() => import('./pages/admin/DataAnalysis.jsx'));
const History = lazy(() => import('./pages/admin/History.jsx'));

function AppRoutes() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-grow">
        <Suspense
          fallback={<ScreenLoader title="Loading site…" subtitle="Preparing the next page" />}
        >
          {/* Keyed wrapper: animates any top-level route change */}
          <div key={location.pathname} className="animate-panel-in">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/booking/*" element={<BookingRouter />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/block-dates"
                element={
                  <ProtectedRoute>
                    <BlockDates />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/clients"
                element={
                  <ProtectedRoute>
                    <Clients />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/inbox"
                element={
                  <ProtectedRoute>
                    <Inbox />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/walk-in"
                element={
                  <ProtectedRoute>
                    <WalkIn />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/data-analysis"
                element={
                  <ProtectedRoute>
                    <DataAnalysis />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/history"
                element={
                  <ProtectedRoute>
                    <History />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </Suspense>
      </main>
      {!isAdminRoute ? <Footer /> : null}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;

