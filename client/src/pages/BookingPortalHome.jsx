import { FileText, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicDarkModeToggle from '../components/PublicDarkModeToggle.jsx';

function BookingPortalHome() {
  return (
    <div className="relative min-h-screen bg-white dark:bg-slate-900 dark:text-slate-100">
      <PublicDarkModeToggle />

      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_60px_-32px_rgba(12,36,61,0.35)] backdrop-blur md:p-10 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100">
          <div className="mb-6">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.28em] text-glacier">
              Patient Portal
            </p>
            <h2 className="text-3xl font-semibold text-maastricht md:text-4xl">
              Book or Check History
            </h2>
            <p className="mt-3 text-sm leading-7 text-police md:text-base">
              Choose one option below.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/booking/new"
              className="group flex flex-col gap-3 rounded-[24px] border border-mist bg-pearl p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-seafoam hover:shadow-md"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-seafoam/60 text-maastricht">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-maastricht">
                  Book Appointment
                </span>
                <span className="mt-1 text-sm text-police/80">
                  Request an OTP and confirm
                </span>
              </div>
              <span className="mt-2 text-sm font-semibold text-silver-lake group-hover:text-maastricht">
                →
              </span>
            </Link>

            <Link
              to="/booking/history"
              className="group flex flex-col gap-3 rounded-[24px] border border-mist bg-pearl p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-seafoam hover:shadow-md"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-seafoam/60 text-maastricht">
                <History className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-maastricht">
                  Check History
                </span>
                <span className="mt-1 text-sm text-police/80">
                  Verify OTP to view records
                </span>
              </div>
              <span className="mt-2 text-sm font-semibold text-silver-lake group-hover:text-maastricht">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookingPortalHome;

