import api from '../../api.js';
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
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import AdminPageShell from '../../components/admin/AdminPageShell.jsx';
import ScreenLoader from '../../components/ScreenLoader.jsx';
import {
  computeEndTimeLabel,
  formatDateKey,
  formatServiceLabel,
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
    badgeKey: 'unreadCount',
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
  {
    to: '/admin/history',
    label: 'History',
    icon: Clock3,
    tone: 'bg-maastricht text-white hover:bg-police',
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
  upcomingAppointments: [],
  pendingOutcomeAppointments: [],
};

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(INITIAL_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusLoadingId, setStatusLoadingId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState({ open: false, appointmentId: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await api.get('/api/contact/messages/unread-count');
        setUnreadCount(response.data.count || 0);
      } catch {
        // Silently fail
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let intervalId = null;
    let keepAliveId = null;
    let isActive = true;

    const fetchDashboard = async (showLoader = false) => {
      if (!isActive) return;

      if (showLoader) {
        setLoading(true);
      }

      try {
        const response = await api.get('/api/admin/dashboard');
        setDashboard(response.data);
        setError('');
      } catch (requestError) {
        const apiError = requestError.response?.data?.error;
        const isAuthError =
          apiError === 'Access denied. No token provided.' ||
          apiError?.toLowerCase?.().includes('access denied') ||
          apiError?.toLowerCase?.().includes('no token');

        if (isAuthError) {
          // Don't immediately log the admin out on a single 401 during
          // background polling. The server may be waking up from sleep or
          // restarting (e.g., free-tier hosting). Retry a few times before
          // redirecting, so transient issues don't kill the session.
          let retries = 0;
          const maxRetries = 3;
          const retry = async () => {
            if (!isActive) return;
            retries += 1;
            try {
              const response = await api.get('/api/admin/dashboard');
              setDashboard(response.data);
              setError('');
            } catch (retryError) {
              if (retries < maxRetries) {
                setTimeout(retry, 2000);
              } else {
                setError('');
                setLoading(false);
                if (intervalId) clearInterval(intervalId);
                if (keepAliveId) clearInterval(keepAliveId);
                window.location.href = '/admin/login';
              }
            }
          };
          retry();
          return;
        }

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

    // When the admin returns to the tab after being AFK, immediately
    // refetch the dashboard so it's never stale. This also prevents the
    // page from appearing to "refresh"/lose state when coming back.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Keep-alive: ping the server periodically so it doesn't go to sleep
    // (e.g., free-tier hosting that sleeps after inactivity). This keeps
    // the session alive and prevents the "idle logs out" issue.
    keepAliveId = setInterval(() => {
      api.get('/api/health').catch(() => {});
    }, 30000);

    return () => {
      isActive = false;
      if (intervalId) clearInterval(intervalId);
      if (keepAliveId) clearInterval(keepAliveId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const updateStatus = async (appointmentId, status, reason = '') => {
    if (actionLoading) return;

    const numericId = String(appointmentId ?? '');
    if (!numericId || !/^\d+$/.test(numericId)) {
      setError('Invalid appointment ID.');
      return;
    }

    setActionLoading(true);
    setStatusLoadingId(`${numericId}:${status}`);
    setError('');

    try {
      const payload = { status };
      if (status === 'rejected' && reason) {
        payload.rejectionReason = reason;
      }
      await api.patch(
        `/api/admin/appointments/${numericId}/status`,
        payload
      );
      await fetchDashboard(false);
    } catch (requestError) {
      const apiError = requestError.response?.data?.error;
      setError(apiError || 'Unable to update appointment status.');
    } finally {
      setStatusLoadingId('');
      setActionLoading(false);
    }
  };

  const handleRejectWithReason = async () => {
    if (!rejectModal.appointmentId) return;
    await updateStatus(rejectModal.appointmentId, 'rejected', rejectionReason);
    setRejectModal({ open: false, appointmentId: null });
    setRejectionReason('');
  };

  const fetchDashboard = useMemo(() => {
    return async () => {
      const response = await api.get('/api/admin/dashboard');
      setDashboard(response.data);
      setError('');
    };
  }, []);

  const todayLabel = dashboard.todayDateKey
    ? formatDateKey(dashboard.todayDateKey, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const typePill = (appointment) => {
    const label = appointment.isWalkIn ? 'Walk-in' : 'Online';
    const color = appointment.isWalkIn ? 'bg-silver-lake text-maastricht' : 'bg-maastricht text-white';

    return (
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${appointment.isWalkIn ? 'bg-maastricht' : 'bg-silver-lake'}`}
        />
        {label}
      </div>
    );
  };

  return (
    <AdminPageShell title={null} description={null} icon={LayoutDashboard} backTo={null}>
      <div className="space-y-4">
        {error ? (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</p>
        ) : null}

        {loading ? (
          <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-sm dark:bg-slate-800">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-silver-lake" />
            <p className="text-police dark:text-slate-300">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {actionLoading ? (
              <div className="pointer-events-auto absolute inset-0 z-[100]">
                <ScreenLoader title="Updating appointment…" subtitle="Please wait while we save the status." />
              </div>
            ) : null}

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-silver-lake dark:text-slate-400">
                    Clinic command center
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold text-maastricht dark:text-slate-100">Admin overview</h1>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-police shadow-sm dark:border-slate-700 dark:bg-slate-700/70 dark:text-slate-300">
                  <span className="font-semibold text-maastricht dark:text-slate-100">{todayLabel || 'Today'}</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-700/70">
                  <p className="mb-1 text-xs font-semibold text-silver-lake dark:text-slate-400">Pending Requests</p>
                  <p className="text-2xl font-bold text-maastricht dark:text-slate-100">{dashboard.stats.pendingRequests}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-700/70">
                  <p className="mb-1 text-xs font-semibold text-silver-lake dark:text-slate-400">Approved Today</p>
                  <p className="text-2xl font-bold text-maastricht dark:text-slate-100">{dashboard.stats.approvedToday}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-700/70">
                  <p className="mb-1 text-xs font-semibold text-silver-lake dark:text-slate-400">Rejected Today</p>
                  <p className="text-2xl font-bold text-maastricht dark:text-slate-100">{dashboard.stats.rejectedToday}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-700/70">
                  <p className="mb-1 text-xs font-semibold text-silver-lake dark:text-slate-400">Completed Today</p>
                  <p className="text-2xl font-bold text-maastricht dark:text-slate-100">{dashboard.stats.completedToday}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-700/70">
                  <p className="mb-1 text-xs font-semibold text-silver-lake dark:text-slate-400">Not Completed Today</p>
                  <p className="text-2xl font-bold text-maastricht dark:text-slate-100">{dashboard.stats.notCompletedToday}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold text-maastricht dark:text-slate-100">Quick actions</h2>
                  <p className="text-xs text-police dark:text-slate-400">Jump to key admin tools without losing your place.</p>
                </div>
                <div className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-police dark:bg-slate-700 dark:text-slate-300">
                  6 shortcuts
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                {QUICK_LINKS.map((item) => {
                  const Icon = item.icon;
                  const badgeValue = item.badgeKey === 'unreadCount' ? unreadCount : 0;
                  const hasBadge = badgeValue > 0;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`relative flex items-center gap-2 rounded-2xl p-3 transition ${item.tone}`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <p className="truncate text-sm font-semibold">{item.label}</p>
                      {hasBadge && (
                        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white shadow-lg ring-2 ring-white/30">
                          {badgeValue > 9 ? '9+' : badgeValue}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-maastricht dark:text-slate-100">Pending requests</h2>
                      <p className="text-xs text-police dark:text-slate-400">Approve or reject new bookings after OTP verification.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {dashboard.pendingAppointments.map((appointment) => (
                      <article
                        key={appointment.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-700"
                      >
                        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">{typePill(appointment)}</div>
                            <h3 className="break-words text-lg font-semibold text-maastricht dark:text-slate-100">
                              {appointment.fullName}
                            </h3>
                            <p className="mt-0.5 text-base font-semibold text-police dark:text-slate-300">{appointment.number}</p>
                          </div>

                          <span
                            className={`mt-1 inline-flex w-max items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusTone(
                              appointment.status
                            )}`}
                          >
                            {appointment.statusLabel}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-800/60">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Service</p>
                            <p className="mt-0.5 text-sm font-semibold text-maastricht dark:text-slate-100">
                              {formatServiceLabel(appointment.service)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-800/60">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Time</p>
                            <p className="mt-0.5 text-sm font-semibold text-maastricht dark:text-slate-100">
                              {formatDateKey(appointment.dateKey, { month: 'long', day: 'numeric', year: 'numeric' })} at{' '}
                              {formatTimeLabel(appointment.time)}
                            </p>
                            <p className="mt-0.5 text-xs text-police dark:text-slate-300">Slot length: {appointment.durationMinutes} minutes</p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => updateStatus(appointment.id, 'accepted')}
                            disabled={!appointment.canApprove || statusLoadingId === `${appointment.id}:accepted`}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {statusLoadingId === `${appointment.id}:accepted` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectModal({ open: true, appointmentId: appointment.id })}
                            disabled={statusLoadingId === `${appointment.id}:rejected`}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {statusLoadingId === `${appointment.id}:rejected` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            Reject
                          </button>
                        </div>

                        {!appointment.canApprove ? (
                          <p className="mt-2 text-xs text-amber-700">
                            This booking cannot be approved until it has a valid scheduled time.
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>

                  {dashboard.pendingAppointments.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-police dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      No pending requests right now.
                    </div>
                  ) : null}
                </section>

                <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm dark:border-amber-700/50 dark:bg-amber-900/20">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-maastricht dark:text-slate-100">Pending outcome</h2>
                    <p className="text-xs text-police dark:text-slate-400">
                      Walk-in appointments that passed their scheduled time but were not yet marked as completed or not completed.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {(dashboard.pendingOutcomeAppointments || []).map((appointment) => (
                      <article
                        key={appointment.id}
                        className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm dark:border-amber-700/50 dark:bg-slate-700"
                      >
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Name</p>
                            <h3 className="mt-0.5 break-words text-lg font-semibold text-maastricht dark:text-slate-100">{appointment.fullName}</h3>
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Service</p>
                            <p className="mt-0.5 text-base font-semibold text-police dark:text-slate-200">{formatServiceLabel(appointment.service)}</p>
                          </div>

                          <div className="min-w-0 md:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Time</p>
                            <p className="mt-0.5 text-base font-semibold text-maastricht dark:text-slate-100">
                              {formatDateKey(appointment.dateKey, { month: 'long', day: 'numeric', year: 'numeric' })} at {formatTimeLabel(appointment.time)}
                              <span className="text-police dark:text-slate-300">
                                {appointment.time && appointment.durationMinutes ? ' to ' : ''}
                              </span>
                              {appointment.time && appointment.durationMinutes
                                ? computeEndTimeLabel(appointment.time, appointment.durationMinutes)
                                : ''}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusTone(
                                appointment.status
                              )}`}
                            >
                              {appointment.statusLabel}
                            </span>
                            <div>{typePill(appointment)}</div>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => updateStatus(appointment.id, 'completed')}
                              disabled={statusLoadingId === `${appointment.id}:completed`}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {statusLoadingId === `${appointment.id}:completed` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Completed
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStatus(appointment.id, 'notCompleted')}
                              disabled={statusLoadingId === `${appointment.id}:notCompleted`}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {statusLoadingId === `${appointment.id}:notCompleted` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Clock3 className="h-4 w-4" />
                              )}
                              Not Completed
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {(dashboard.pendingOutcomeAppointments || []).length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-amber-300 bg-white/60 p-6 text-sm text-police dark:border-amber-700/50 dark:bg-slate-700 dark:text-slate-300">
                      No walk-in appointments are waiting for an outcome.
                    </div>
                  ) : null}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-maastricht dark:text-slate-100">Today&apos;s schedule</h2>
                    <p className="text-xs text-police dark:text-slate-400">A cleaner daily layout for the appointments that matter most today.</p>
                  </div>

                  <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-silver-lake dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 xl:grid xl:grid-cols-12">
                    <div className="col-span-3">Name</div>
                    <div className="col-span-3">Service</div>
                    <div className="col-span-3">Time</div>
                    <div className="col-span-2">Number</div>
                    <div className="col-span-1">Type</div>
                  </div>

                  <div className="pt-2">
                    <div className="max-h-[70vh] overflow-y-auto pr-1">
                      {dashboard.todayAppointments.length === 0 ? (
                        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-police dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          No approved, rejected, completed, or not completed appointments for today yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {dashboard.todayAppointments.map((appointment) => (
                            <article
                              key={appointment.id}
                              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-700"
                            >
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-12">
                                <div className="min-w-0 xl:col-span-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Name</p>
                                  <h3 className="mt-0.5 line-clamp-2 break-words text-lg font-semibold text-maastricht dark:text-slate-100">
                                    {appointment.fullName}
                                  </h3>
                                </div>

                                <div className="min-w-0 xl:col-span-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Service</p>
                                  <p className="mt-0.5 line-clamp-2 break-words text-base font-semibold text-police dark:text-slate-200">
                                    {formatServiceLabel(appointment.service)}
                                  </p>
                                </div>

                                <div className="min-w-0 xl:col-span-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Time</p>
                                  <p className="mt-0.5 line-clamp-2 break-words text-base font-semibold text-maastricht dark:text-slate-100">
                                    {formatTimeLabel(appointment.time)}
                                    <span className="text-police dark:text-slate-300">
                                      {appointment.time && appointment.durationMinutes ? ' to ' : ''}
                                    </span>
                                    {appointment.time && appointment.durationMinutes
                                      ? computeEndTimeLabel(appointment.time, appointment.durationMinutes)
                                      : ''}
                                  </p>
                                </div>

                                <div className="min-w-0 xl:col-span-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Number</p>
                                  <p className="mt-0.5 line-clamp-1 break-words text-base font-semibold text-police dark:text-slate-200">
                                    {appointment.number}
                                  </p>
                                </div>

                                <div className="xl:col-span-1">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Type</p>
                                  <div className="mt-1.5">{typePill(appointment)}</div>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <span
                                  className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusTone(
                                    appointment.status
                                  )}`}
                                >
                                  {appointment.statusLabel}
                                </span>

                                {appointment.status === 'accepted' ? (
                                  appointment.canMarkOutcome ? (
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                      <button
                                        type="button"
                                        onClick={() => updateStatus(appointment.id, 'completed')}
                                        disabled={statusLoadingId === `${appointment.id}:completed`}
                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        {statusLoadingId === `${appointment.id}:completed` ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="h-4 w-4" />
                                        )}
                                        Completed
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateStatus(appointment.id, 'notCompleted')}
                                        disabled={statusLoadingId === `${appointment.id}:notCompleted`}
                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        {statusLoadingId === `${appointment.id}:notCompleted` ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Clock3 className="h-4 w-4" />
                                        )}
                                        Not Completed
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="rounded-xl bg-slate-50 p-3 text-sm text-police dark:bg-slate-800/60 dark:text-slate-300">
                                      Outcome buttons open when the appointment starts at {formatTimeLabel(appointment.time)}.
                                    </div>
                                  )
                                ) : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-4">
                <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-maastricht dark:text-slate-100">Upcoming appointments</h2>
                    <p className="text-xs text-police dark:text-slate-400">The next closest approved schedules from now.</p>
                  </div>

                  <div className="space-y-3">
                    {(dashboard.upcomingAppointments || []).map((appointment) => (
                      <article
                        key={appointment.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-700"
                      >
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Name</p>
                            <h3 className="mt-0.5 break-words text-lg font-semibold text-maastricht dark:text-slate-100">{appointment.fullName}</h3>
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Service</p>
                            <p className="mt-0.5 text-base font-semibold text-police dark:text-slate-200">{formatServiceLabel(appointment.service)}</p>
                          </div>

                          <div className="min-w-0 md:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Time</p>
                            <p className="mt-0.5 text-base font-semibold text-maastricht dark:text-slate-100">
                              {formatDateKey(appointment.dateKey, { month: 'long', day: 'numeric', year: 'numeric' })} at {formatTimeLabel(appointment.time)}
                              <span className="text-police dark:text-slate-300">
                                {appointment.time && appointment.durationMinutes ? ' to ' : ''}
                              </span>
                              {appointment.time && appointment.durationMinutes
                                ? computeEndTimeLabel(appointment.time, appointment.durationMinutes)
                                : ''}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusTone(
                              appointment.status
                            )}`}
                          >
                            {appointment.statusLabel}
                          </span>
                          <div className="mt-1">{typePill(appointment)}</div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {(dashboard.upcomingAppointments || []).length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-police dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      No upcoming approved appointments.
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </>
        )}
      </div>
      {/* ── Rejection Reason Modal ── */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-maastricht">Rejection Reason</h3>
              <button
                onClick={() => { setRejectModal({ open: false, appointmentId: null }); setRejectionReason(''); }}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-police">
              Provide a reason for rejecting this appointment. This will be included in the SMS notification sent to the patient.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Slot unavailable, schedule conflict..."
              rows={4}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-police placeholder:text-slate-400 focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { setRejectModal({ open: false, appointmentId: null }); setRejectionReason(''); }}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-police transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectWithReason}
                disabled={!rejectionReason.trim() || actionLoading}
                className="flex-1 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actionLoading ? 'Rejecting...' : 'Reject & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

export default AdminDashboard;

