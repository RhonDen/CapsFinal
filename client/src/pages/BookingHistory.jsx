import api from '../api.js';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock3,
  Loader2,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDateKey,
  formatServiceLabel,
  formatStatusLabel,
  formatTimeLabel,
  getStatusTone,
} from '../utils/schedule.js';

const statusRank = {
  pending: 0,
  accepted: 1,
  completed: 2,
  rejected: 3,
  notCompleted: 4,
};

function BookingHistory() {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneChange = (event) => {
    const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 11);
    setPhone(digitsOnly);
  };

  const requestOtp = async (event) => {
    event.preventDefault();
    if (!phone.trim()) {
      return;
    }

    setLoading(true);
    setError('');

    const sanitizedPhone = phone.replace(/\D/g, '').slice(0, 11);

    try {
      await api.post('/api/bookings/history/request-otp', { number: sanitizedPhone });
      setStep(2);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    if (!otp.trim()) {
      return;
    }

    setLoading(true);
    setError('');

    const sanitizedPhone = phone.replace(/\D/g, '').slice(0, 11);

    try {
      const response = await api.post('/api/bookings/history/verify-otp', {
        number: sanitizedPhone,
        otp,
      });
      setAppointments(response.data.appointments || []);
      setStep(1);
      setOtp('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const returnToPhoneLookup = () => {
    setError('');
    setOtp('');
    setStep(1);
  };

  const groupedAppointments = useMemo(() => {
    const sortedAppointments = [...appointments].sort((a, b) => {
      const dateA = a.dateKey || a.date || '';
      const dateB = b.dateKey || b.date || '';
      const dateCompare = dateB.localeCompare(dateA);

      if (dateCompare !== 0) {
        return dateCompare;
      }

      const timeA = a.time || '';
      const timeB = b.time || '';
      if (timeA !== timeB) {
        return timeA.localeCompare(timeB);
      }

      return (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
    });

    return sortedAppointments.reduce((groups, appointment) => {
      const dateKey = appointment.dateKey || appointment.date || 'unknown';
      const existingGroup = groups.find((group) => group.dateKey === dateKey);

      if (existingGroup) {
        existingGroup.items.push(appointment);
        return groups;
      }

      groups.push({
        dateKey,
        label: formatDateKey(dateKey, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        items: [appointment],
      });

      return groups;
    }, []);
  }, [appointments]);

  const summaryCards = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter((appointment) => appointment.status === 'completed').length;
    const approved = appointments.filter((appointment) => ['accepted', 'completed'].includes(appointment.status)).length;
    const pending = appointments.filter((appointment) => appointment.status === 'pending').length;

    return [
      { label: 'Total visits', value: total, accent: 'bg-maastricht text-white' },
      { label: 'Approved', value: approved, accent: 'bg-sky-100 text-sky-800' },
      { label: 'Completed', value: completed, accent: 'bg-emerald-100 text-emerald-700' },
      { label: 'Pending', value: pending, accent: 'bg-amber-100 text-amber-800' },
    ];
  }, [appointments]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(224,242,254,0.35),transparent_55%),linear-gradient(180deg,#f8fbff_0%,#f5f7fb_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[36px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8 lg:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/booking"
            className="inline-flex items-center gap-2 rounded-full border border-mist bg-pearl px-4 py-2 text-sm font-medium text-police transition hover:border-silver-lake hover:text-maastricht"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-sm font-semibold text-police">
            <ShieldCheck className="h-4 w-4 text-glacier" />
            Records protected by OTP
          </div>
        </div>

        <div className="mb-8 rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-silver-lake">
            <Sparkles className="h-4 w-4" />
            Appointment timeline
          </div>
          <h2 className="mt-3 text-3xl font-semibold text-maastricht sm:text-4xl">
            Your dental appointment history
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-police md:text-base">
            Review every booking in one calm view. The timeline below groups appointments by date and keeps status visible at a glance.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.label} className={`rounded-[22px] px-4 py-4 ${card.accent}`}>
                <p className="text-sm font-medium opacity-80">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold">{card.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <div
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              step === 1 ? 'bg-maastricht text-white' : 'bg-mist text-police'
            }`}
          >
            1. Phone
          </div>
          <div
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              step === 2 ? 'bg-maastricht text-white' : 'bg-mist text-police'
            }`}
          >
            2. OTP
          </div>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        ) : null}

        <div key={step} className="animate-panel-in">
          {step === 1 ? (
            <form onSubmit={requestOtp} className="mb-8 flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
              <input
                type="tel"
                placeholder="09175550123"
                value={phone}
                onChange={handlePhoneChange}
                required
                inputMode="numeric"
                maxLength={11}
                pattern="[0-9]{11}"
                className="flex-1 rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
              />
              <p className="text-sm text-police">
                If the clinic blocks your requested date, your booking may be rejected while being reviewed.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-maastricht px-5 py-3 text-white transition hover:-translate-y-0.5 hover:bg-police disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Smartphone className="h-5 w-5" />
                )}
                Send OTP
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="mb-8 space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <p className="text-sm leading-7 text-police">
                Enter the OTP sent to <strong>{phone}</strong> to open your full appointment timeline.
              </p>
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                required
                className="w-full rounded-2xl border-2 border-slate-200 bg-white p-4 text-center text-xl tracking-[0.35em] focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={returnToPhoneLookup}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-mist bg-pearl px-4 py-3 font-semibold text-police transition hover:border-silver-lake hover:text-maastricht"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Phone
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-maastricht py-3 text-white transition hover:-translate-y-0.5 hover:bg-police disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                  {loading ? 'Verifying...' : 'View History'}
                </button>
              </div>
            </form>
          )}
        </div>

        {appointments.length > 0 ? (
          <div className="space-y-4">
            {groupedAppointments.map((group) => (
              <section key={group.dateKey} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-silver-lake">Date</p>
                    <h3 className="text-lg font-semibold text-maastricht">{group.label}</h3>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-police shadow-sm">
                    {group.items.length} appointment{group.items.length === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="space-y-3">
                  {group.items.map((appointment) => (
                    <article
                      key={appointment._id || appointment.id}
                      className="rounded-[20px] border border-white bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-maastricht">{formatServiceLabel(appointment.service)}</p>
                          <p className="mt-1 text-sm text-silver-lake">Booking #{appointment.serialNumber || 'N/A'}</p>
                        </div>
                        <span className={`inline-flex w-max items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(appointment.status)}`}>
                          {formatStatusLabel(appointment.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-silver-lake">Time</p>
                          <p className="mt-1 text-sm font-semibold text-police">
                            {appointment.time ? formatTimeLabel(appointment.time) : 'No time recorded'}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-silver-lake">Status</p>
                          <p className="mt-1 text-sm font-semibold text-police">{formatStatusLabel(appointment.status) || 'No status'}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-silver-lake">Type</p>
                          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-police">
                            <Calendar className="h-4 w-4 text-silver-lake" />
                            {appointment.isWalkIn ? 'Walk-in' : 'Online'}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {appointments.length === 0 && step === 1 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 p-6 text-sm text-police">
            Once you verify your number, your past appointments will appear here grouped by date and status.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default BookingHistory;
