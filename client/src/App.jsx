import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';


const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const BookingRouter = lazy(() => import('./pages/BookingRouter.jsx'));
const AdminLogin = lazy(() => import('./pages/AdminLogin.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const BlockDates = lazy(() => import('./pages/admin/BlockDates.jsx'));
const Clients = lazy(() => import('./pages/admin/Clients.jsx'));
const WalkIn = lazy(() => import('./pages/admin/WalkIn.jsx'));
const DataAnalysis = lazy(() => import('./pages/admin/DataAnalysis.jsx'));

function AppRoutes() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-grow">
        <Suspense
          fallback={
            <div className="p-8 text-center text-police">Loading page...</div>
          }
        >
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
          </Routes>
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
