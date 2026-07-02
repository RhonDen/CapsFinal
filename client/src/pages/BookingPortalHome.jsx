import { CalendarRange, FileText, History, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicDarkModeToggle from '../components/PublicDarkModeToggle.jsx';

function BookingPortalHome() {
  const [blockedDates, setBlockedDates] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [blockedError, setBlockedError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadBlockedDates = async () => {
      setBlockedLoading(true);
      setBlockedError('');

      try {
        const response = await axios.get('/api/public/blocked-dates');
        if (!isMounted) return;
        setBlockedDates(response.data || []);
      } catch (err) {
        if (!isMounted) return;
        setBlockedError('Unable to load blocked dates right now.');
        setBlockedDates([]);
      } finally {
        if (!isMounted) return;
        setBlockedLoading(false);
      }
    };

    loadBlockedDates();

    return () => {
      isMounted = false;
    };
  }, []);

  const blockedDatesFormatted = useMemo(() => {
    return (blockedDates || []).map((d) => ({
      id: d.id,
      dateKey: d.dateKey || d.date,
      reason: d.reason || '',
      rawDate: d.date,
    }));
  }, [blockedDates]);

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,rgba(219,234,254,0.35),transparent_45%),linear-gradient(180deg,#f8fbff_0%,#f3f5f9_100%)] dark:bg-slate-900 dark:text-slate-100">
      <PublicDarkModeToggle />

      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full overflow-hidden rounded-[36px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8 lg:p-10 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100">
          <div className="mb-8 rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-[0.28em] text-silver-lake">
              <ShieldCheck className="h-4 w-4" />
              Patient portal
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-maastricht sm:text-4xl">
              Book a visit or check your history
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-police md:text-base">
              Choose the option that fits your visit so your experience feels calm, clear, and easy to follow.
            </p>
          </div>

          <div className="mb-8 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-maastricht">
              <CalendarRange className="h-4 w-4 text-silver-lake" />
              Clinic availability
            </div>
            {blockedLoading ? (
              <p className="text-sm text-police/80">Loading availability...</p>
            ) : blockedError ? (
              <p className="text-sm text-red-600">{blockedError}</p>
            ) : blockedDatesFormatted.length === 0 ? (
              <p className="text-sm text-police/80">No blocked dates found.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {blockedDatesFormatted.map((d) => (
                  <li
                    key={d.id ?? d.dateKey}
                    className="rounded-2xl border border-white/70 bg-white/70 p-3 text-sm shadow-sm"
                  >
                    <div className="font-semibold text-police">{d.dateKey}</div>
                    {d.reason ? (
                      <div className="mt-1 text-xs text-silver-lake">Reason: {d.reason}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Link
              to="/booking/new"
              className="group flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-maastricht/10 text-maastricht">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xl font-semibold text-maastricht">Book appointment</span>
                <p className="mt-2 text-sm leading-6 text-police">
                  Request an OTP and confirm your preferred visit in a few steps.
                </p>
              </div>
              <span className="text-sm font-semibold text-silver-lake group-hover:text-maastricht">Start booking →</span>
            </Link>

            <Link
              to="/booking/history"
              className="group flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                <History className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xl font-semibold text-maastricht">Check history</span>
                <p className="mt-2 text-sm leading-6 text-police">
                  Verify your OTP and see all of your past bookings grouped by date.
                </p>
              </div>
              <span className="text-sm font-semibold text-silver-lake group-hover:text-maastricht">View timeline →</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookingPortalHome;

