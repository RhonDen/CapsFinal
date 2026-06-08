import { Clock3, ShieldCheck, Sparkles } from 'lucide-react';
import PublicDarkModeToggle from '../components/PublicDarkModeToggle.jsx';

const PORTAL_STEPS = [
  {
    title: 'Choose a service',
    description: 'Pick the dental visit type, date, and open time that fit best.',
    icon: Sparkles,
  },
  {
    title: 'Verify by SMS',
    description: 'Every request is protected with a one-time code for security.',
    icon: ShieldCheck,
  },
  {
    title: 'Return anytime',
    description: 'Use your phone number again to review booking results and history.',
    icon: Clock3,
  },
];

// Render the default portal message before the patient opens booking or history.
function BookingPortalHome() {
  return (
    <div className="relative min-h-screen bg-white dark:bg-slate-900 dark:text-slate-100">
      <PublicDarkModeToggle />

      <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_60px_-32px_rgba(12,36,61,0.35)] backdrop-blur md:p-8 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100">
        <div className="mb-6 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.28em] text-glacier">
            Patient Portal Guide
          </p>
          <h2 className="mb-3 text-3xl font-semibold text-maastricht">
            Secure dental bookings designed to feel clear and effortless.
          </h2>
          <p className="text-base leading-8 text-police">
            Choose an option above to open a booking panel below. The portal is
            optimized for mobile so patients can request appointments, choose
            15-minute-based time slots, verify their OTP, and review history
            without feeling lost on smaller screens.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PORTAL_STEPS.map((step) => {
            const Icon = step.icon;

            return (
              <div
                key={step.title}
                className="rounded-2xl border border-mist bg-pearl p-5 shadow-sm"
              >
                <div className="mb-4 inline-flex rounded-2xl bg-seafoam p-3 text-maastricht">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-maastricht">
                  {step.title}
                </h3>
                <p className="text-sm leading-7 text-police">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default BookingPortalHome;

