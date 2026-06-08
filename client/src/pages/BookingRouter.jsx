import {
  ArrowLeft,
  ArrowRight,
  FileText,
  History,
  ShieldCheck,
} from 'lucide-react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import BookingForm from './BookingForm.jsx';
import BookingHistory from './BookingHistory.jsx';
import BookingPortalHome from './BookingPortalHome.jsx';

const PORTAL_OPTIONS = [
  {
    to: 'new',
    label: 'Book Visit',
    description: 'Create a new dental appointment.',
    icon: FileText,
  },
  {
    to: 'history',
    label: 'Visit History',
    description: 'Check records using OTP.',
    icon: History,
  },
];

// Render the public booking portal with compact actions and animated content panels.
function BookingRouter() {
  // Read the current nested route so we can animate the active panel when it changes.
  const location = useLocation();

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(111,174,199,0.24),_transparent_60%)]" />
      <div className="pointer-events-none absolute right-0 top-16 h-40 w-40 rounded-full bg-seafoam/50 blur-3xl" />
      <div className="pointer-events-none absolute left-8 top-44 h-52 w-52 rounded-full bg-apricot/35 blur-3xl" />

      <div className="mx-auto max-w-5xl">
        <div className="mb-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-mist bg-white/85 px-4 py-2 text-sm font-medium text-police shadow-sm backdrop-blur transition hover:border-silver-lake hover:text-maastricht"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <section className="animate-fade-up overflow-hidden rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_26px_70px_-36px_rgba(12,36,61,0.42)] backdrop-blur md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-seafoam bg-seafoam/70 px-4 py-2 text-sm font-semibold text-police">
                <ShieldCheck className="h-4 w-4 text-glacier" />
                Secure Dental Appointments
              </div>
              <h1 className="mb-4 text-4xl font-semibold text-maastricht md:text-5xl">
                Appointment Portal
              </h1>
              <p className="max-w-2xl text-base leading-8 text-police md:text-lg">
                Book a visit or review your dental appointment history through a
                lighter, mobile-friendly portal. Each step opens smoothly below
                so patients always know where to continue next.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PORTAL_OPTIONS.map((option) => {
                const Icon = option.icon;

                return (
                  <NavLink
                    key={option.to}
                    to={option.to}
                    className={({ isActive }) =>
                      `group rounded-[24px] border p-4 text-left transition duration-300 ${
                        isActive
                          ? 'border-silver-lake bg-maastricht text-white shadow-lg'
                          : 'border-white bg-pearl/80 text-maastricht shadow-sm hover:-translate-y-0.5 hover:border-seafoam hover:shadow-md'
                      }`
                    }
                  >
                    {({ isActive }) => {
                      const descriptionColor = isActive
                        ? 'text-white/80'
                        : 'text-police';

                      return (
                        <>
                          <div className="mb-3 flex items-center justify-between">
                            <div className="inline-flex rounded-2xl bg-white/80 p-2 text-silver-lake shadow-sm">
                              <Icon className="h-5 w-5" />
                            </div>
                            <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
                          </div>
                          <h2 className="mb-1 font-sans text-lg font-semibold">
                            {option.label}
                          </h2>
                          <p className={`text-sm leading-6 ${descriptionColor}`}>
                            {option.description}
                          </p>
                        </>
                      );
                    }}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </section>

        <div key={location.pathname} className="mt-8 animate-panel-in">
          <Routes location={location}>
            <Route index element={<BookingPortalHome />} />
            <Route path="new" element={<BookingForm />} />
            <Route path="history" element={<BookingHistory />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default BookingRouter;
