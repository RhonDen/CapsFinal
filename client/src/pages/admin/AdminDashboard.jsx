import axios from 'axios';
import {
  BarChart3,
  CalendarX,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  Loader2,
  Mail,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';
import {
  formatDateKey,
  formatServiceLabel,
  formatTimeFromDateValue,
  formatTimeLabel,
  getStatusTone,
} from '../../utils/schedule.js';

const QUICK_LINKS = [
  {
    to: '/admin/block-dates',
    label: 'Block Dates',
    icon: CalendarX,
    tone: 'bg-maastricht text-white hover:bg-police',
  },
  {
    to: '/admin/clients',
    label: 'Clients',
    icon: Users,
    tone: 'bg-police text-white hover:bg-maastricht',
  },
  {
    to: '/admin/inbox',
    label: 'Inbox',
    icon: Mail,
    tone: 'bg-emerald-600 text-white hover:bg-emerald-700',
  },
  {
    to: '/admin/walk-in',
    label: 'Walk-in',
    icon: UserPlus,
    tone: 'bg-silver-lake text-white hover:bg-wild-blue',
  },
  {
    to: '/admin/data-analysis',
    label: 'Analytics',
    icon: BarChart3,
    tone: 'bg-wild-blue text-white hover:bg-silver-lake',
  },
];

const INITIAL_DASHBOARD = {
  todayDateKey: '',
  stats: {
    pendingRequests: 0,
    approvedToday: 0,
    rejectedToday: 0,
    completedToday: 0,
    notCompletedToday: 0,
  },
  pendingAppointments: [],
  todayAppointments: [],
};

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(INITIAL_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusLoadingId, setStatusLoadingId] = useState('');

  useEffect(() => {
    let intervalId = null;
    let isActive = true;

    const fetchDashboard = async (showLoader = false) => {
      if (!isActive) return;

      if (showLoader) {
        setLoading(true);
      }

      try {
        const response = await axios.get('/api/admin/dashboard');
        setDashboard(response.data);
        setError('');
      } catch (requestError) {
        const apiError = requestError.response?.data?.error;
        const isAuthError =
          apiError === 'Access denied. No token provided.' ||
          apiError?.toLowerCase?.().includes('access denied') ||
          apiError?.toLowerCase?.().includes('no token');

        if (isAuthError) {
          // Stop polling + clear UI noise; user must re-login.
          setError('');
          setLoading(false);
          if (intervalId) clearInterval(intervalId);
          window.location.href = '/admin/login';
          return;
        }

        // Avoid noisy UI updates during intermittent polling failures.
        if (showLoader) {
          setError(apiError || 'Failed to load dashboard.');
        }
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    };

    fetchDashboard(true);
    intervalId = setInterval(() => {
      fetchDashboard(false);
    }, 15000);

    return () => {
      isActive = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);


  const updateStatus = async (appointmentId, status) => {
    setStatusLoadingId(`${appointmentId}:${status}`);
    setError('');

    try {
      await axios.patch(`/api/admin/appointments/${appointmentId}/status`, { status });
      await fetchDashboard(false);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to update appointment status.');
    } finally {
      setStatusLoadingId('');
    }
  };

  const todayLabel = dashboard.todayDateKey
    ? formatDateKey(dashboard.todayDateKey, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
      <AdminPageShell
      title={null}
      description={null}
      icon={LayoutDashboard}
      backTo={null}
>
      {error ? (
        <p className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</p>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] bg-white p-10 text-center shadow-sm dark:bg-slate-800">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-silver-lake" />
          <p className="text-police dark:text-slate-300">Loading dashboard...</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[24px] bg-white p-5 shadow-sm dark:bg-slate-800">
              <p className="mb-2 text-sm text-silver-lake dark:text-slate-400">Pending Requests</p>
              <p className="text-3xl font-bold text-maastricht dark:text-slate-100">
                {dashboard.stats.pendingRequests}
              </p>
            </div>
            <div className="rounded-[24px] bg-white p-5 shadow-sm dark:bg-slate-800">
              <p className="mb-2 text-sm text-silver-lake dark:text-slate-400">Approved Today</p>
              <p className="text-3xl font-bold text-maastricht dark:text-slate-100">
                {dashboard.stats.approvedToday}
              </p>
            </div>
            <div className="rounded-[24px] bg-white p-5 shadow-sm dark:bg-slate-800">
              <p className="mb-2 text-sm text-silver-lake dark:text-slate-400">Rejected Today</p>
              <p className="text-3xl font-bold text-maastricht dark:text-slate-100">
                {dashboard.stats.rejectedToday}
              </p>
            </div>
            <div className="rounded-[24px] bg-white p-5 shadow-sm dark:bg-slate-800">
              <p className="mb-2 text-sm text-silver-lake dark:text-slate-400">Completed Today</p>
              <p className="text-3xl font-bold text-maastricht dark:text-slate-100">
                {dashboard.stats.completedToday}
              </p>
            </div>
            <div className="rounded-[24px] bg-white p-5 shadow-sm dark:bg-slate-800">
              <p className="mb-2 text-sm text-silver-lake dark:text-slate-400">Not Completed Today</p>
              <p className="text-3xl font-bold text-maastricht dark:text-slate-100">
                {dashboard.stats.notCompletedToday}
              </p>
            </div>
          </div>

          <div className="mb-6 rounded-[28px] bg-white p-6 shadow-sm dark:bg-slate-800">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-maastricht dark:text-slate-100">Today&apos;s Schedule</h2>
                <p className="text-sm text-police dark:text-slate-400">
                  {todayLabel || 'Current day'} resets automatically each day.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {QUICK_LINKS.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center justify-between rounded-[22px] p-5 transition ${item.tone}`}
                  >
                    <div>
                      <p className="text-sm opacity-80">Open</p>
                      <p className="text-lg font-semibold">{item.label}</p>
                    </div>
                    <Icon className="h-6 w-6" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1.2fr]">
            <section className="rounded-[28px] bg-white p-6 shadow-sm dark:bg-slate-800">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-maastricht dark:text-slate-100">Pending Requests</h2>
                  <p className="text-sm text-police dark:text-slate-400">
                    Approve or reject new bookings after OTP verification.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {dashboard.pendingAppointments.map((appointment) => (
                  <article
                    key={appointment._id}
                    className="rounded-[24px] border border-mist bg-pearl p-5 dark:border-slate-600 dark:bg-slate-700"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-silver-lake dark:text-slate-400">
                          Booking #{appointment.serialNumber || 'N/A'}
                        </p>
                        <h3 className="text-lg font-semibold text-maastricht dark:text-slate-100">
                          {appointment.fullName}
                        </h3>
                        <p className="text-sm text-police dark:text-slate-300">{appointment.number}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(
                          appointment.status
                        )}`}
                      >
                        {appointment.statusLabel}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-police dark:text-slate-300">
                      <p>{formatServiceLabel(appointment.service)}</p>
                      <p>
                        {formatDateKey(appointment.dateKey, {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {' at '}
                        {formatTimeLabel(appointment.time)}
                      </p>
                      <p>Slot length: {appointment.durationMinutes} minutes</p>
                      {appointment.isWalkIn ? <p>Recorded as walk-in.</p> : null}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => updateStatus(appointment._id, 'accepted')}
                        disabled={
                          !appointment.canApprove ||
                          statusLoadingId === `${appointment._id}:accepted`
                        }
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {statusLoadingId === `${appointment._id}:accepted` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(appointment._id, 'rejected')}
                        disabled={statusLoadingId === `${appointment._id}:rejected`}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {statusLoadingId === `${appointment._id}:rejected` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Reject
                      </button>
                    </div>
                    {!appointment.canApprove ? (
                      <p className="mt-3 text-sm text-amber-700">
                        This booking cannot be approved until it has a valid scheduled time.
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>

              {dashboard.pendingAppointments.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-mist bg-pearl p-6 text-sm text-police dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  No pending requests right now.
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] bg-white p-6 shadow-sm dark:bg-slate-800">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-maastricht dark:text-slate-100">Daily Appointments</h2>
                <p className="text-sm text-police dark:text-slate-400">
                  This list is based on the booked appointment date and time for today only.
                </p>
              </div>

              <div className="space-y-4">
                {dashboard.todayAppointments.map((appointment) => (
                  <article
                    key={appointment._id}
                    className="rounded-[24px] border border-mist bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-700"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-silver-lake dark:text-slate-400">
                          Booking #{appointment.serialNumber || 'N/A'}
                        </p>
                        <h3 className="text-lg font-semibold text-maastricht dark:text-slate-100">
                          {appointment.fullName}
                        </h3>
                        <p className="text-sm text-police dark:text-slate-300">{formatServiceLabel(appointment.service)}</p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(
                          appointment.status
                        )}`}
                      >
                        {appointment.statusLabel}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-police dark:text-slate-300">
                      <p>
                        {formatTimeLabel(appointment.time)} to{' '}
                        {appointment.scheduledEnd
                          ? formatTimeFromDateValue(appointment.scheduledEnd)
                          : formatTimeLabel(appointment.time)}
                      </p>
                      <p>{appointment.number}</p>
                      {appointment.isWalkIn ? <p>Walk-in appointment.</p> : null}
                    </div>

                    {appointment.status === 'accepted' ? (
                      appointment.canMarkOutcome ? (
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => updateStatus(appointment._id, 'completed')}
                            disabled={statusLoadingId === `${appointment._id}:completed`}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {statusLoadingId === `${appointment._id}:completed` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Completed
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(appointment._id, 'notCompleted')}
                            disabled={statusLoadingId === `${appointment._id}:notCompleted`}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-700 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {statusLoadingId === `${appointment._id}:notCompleted` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Clock3 className="h-4 w-4" />
                            )}
                            Not Completed
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl bg-pearl p-4 text-sm text-police">
                          Outcome buttons open when the appointment starts at{' '}
                          {formatTimeLabel(appointment.time)}.
                        </div>
                      )
                    ) : null}
                  </article>
                ))}
              </div>

              {dashboard.todayAppointments.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-mist bg-pearl p-6 text-sm text-police">
                  No approved, rejected, completed, or not completed appointments for today yet.
                </div>
              ) : null}
            </section>
          </div>
        </>
      )}
    </AdminPageShell>
  );
}

export default AdminDashboard;
