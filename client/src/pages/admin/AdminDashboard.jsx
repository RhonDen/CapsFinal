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
import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import AdminPageShell from '../../components/admin/AdminPageShell.jsx';
import ScreenLoader from '../../components/ScreenLoader.jsx';
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
};

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(INITIAL_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusLoadingId, setStatusLoadingId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let intervalId = null;
    let isActive = true;

    const fetchDashboard = async (showLoader = false) => {
      if (!isActive) return;

      if (showLoader) {
        setLoading(true);
      }

      try {
        const response = await axios.get('/api/admin/dashboard', {
          withCredentials: true,
        });
        setDashboard(response.data);
        setError('');
      } catch (requestError) {
        const apiError = requestError.response?.data?.error;
        const isAuthError =
          apiError === 'Access denied. No token provided.' ||
          apiError?.toLowerCase?.().includes('access denied') ||
          apiError?.toLowerCase?.().includes('no token');

        if (isAuthError) {
          setError('');
          setLoading(false);
          if (intervalId) clearInterval(intervalId);
          window.location.href = '/admin/login';
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

    return () => {
      isActive = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const updateStatus = async (appointmentId, status) => {
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
      await axios.patch(
        `/api/admin/appointments/${numericId}/status`,
        { status },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
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

  const fetchDashboard = useMemo(() => {
    return async () => {
      const response = await axios.get('/api/admin/dashboard', {
        withCredentials: true,
      });
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
    const color = appointment.isWalkIn
      ? 'bg-silver-lake text-maastricht'
      : 'bg-maastricht text-white';

    return (
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${appointment.isWalkIn ? 'bg-maastricht' : 'bg-silver-lake'}`} />
        {label}
      </div>
    );
  };

  return (
    <AdminPageShell title={null} description={null} icon={LayoutDashboard} backTo={null}>
      <div className="space-y-6">
        {error ? (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </p>
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

            <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-6 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)] dark:border-slate-700 dark:bg-slate-800/90">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-silver-lake dark:text-slate-400">
                    Clinic command center
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold text-maastricht dark:text-slate-100">
                    Admin overview
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-police dark:text-slate-400">
                    Keep the day organized with a calmer layout that gives each section more breathing room.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/70 bg-white/70 px-4 py-3 text-sm text-police shadow-sm dark:border-slate-700 dark:bg-slate-700/70 dark:text-slate-300">
                  <span className="font-semibold text-maastricht dark:text-slate-100">{todayLabel || 'Today'}</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-5">
                <div className="rounded-[24px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-700/70">
                  <p className="mb-2 text-sm font-semibold text-silver-lake dark:text-slate-400">Pending Requests</p>
                  <p className="text-4xl font-bold text-maastricht dark:text-slate-100">{dashboard.stats.pendingRequests}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-700/70">
                  <p className="mb-2 text-sm font-semibold text-silver-lake dark:text-slate-400">Approved Today</p>
                  <p className="text-4xl font-bold text-maastricht dark:text-slate-100">{dashboard.stats.approvedToday}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-700/70">
                  <p className="mb-2 text-sm font-semibold text-silver-lake dark:text-slate-400">Rejected Today</p>
                  <p className="text-4xl font-bold text-maastricht dark:text-slate-100">{dashboard.stats.rejectedToday}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-700/70">
                  <p className="mb-2 text-sm font-semibold text-silver-lake dark:text-slate-400">Completed Today</p>
                  <p className="text-4xl font-bold text-maastricht dark:text-slate-100">{dashboard.stats.completedToday}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-700/70">
                  <p className="mb-2 text-sm font-semibold text-silver-lake dark:text-slate-400">Not Completed Today</p>
                  <p className="text-4xl font-bold text-maastricht dark:text-slate-100">{dashboard.stats.notCompletedToday}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-maastricht dark:text-slate-100">Quick actions</h2>
                  <p className="text-sm text-police dark:text-slate-400">Jump to key admin tools without losing your place.</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-police dark:bg-slate-700 dark:text-slate-300">
                  5 shortcuts
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {QUICK_LINKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center justify-between rounded-[22px] p-6 transition ${item.tone}`}
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

            <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <section className="rounded-[36px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold text-maastricht dark:text-slate-100">Pending requests</h2>
                      <p className="text-sm text-police dark:text-slate-400">Approve or reject new bookings after OTP verification.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {dashboard.pendingAppointments.map((appointment) => (
                      <article
                        key={appointment.id}
                        className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-6 dark:border-slate-600 dark:bg-slate-700"
                      >
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              {typePill(appointment)}
                            </div>
                            <h3 className="break-words text-xl font-semibold text-maastricht dark:text-slate-100">{appointment.fullName}</h3>
                            <p className="mt-1 text-lg font-semibold text-police dark:text-slate-300">{appointment.number}</p>
                          </div>

                          <span className={`mt-1 inline-flex w-max items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ${getStatusTone(appointment.status)}`}>
                            {appointment.statusLabel}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-800/60">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Service</p>
                            <p className="mt-1 text-base font-semibold text-maastricht dark:text-slate-100">{formatServiceLabel(appointment.service)}</p>
                          </div>
                          <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-800/60">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Time</p>
                            <p className="mt-1 text-base font-semibold text-maastricht dark:text-slate-100">
                              {formatDateKey(appointment.dateKey, { month: 'long', day: 'numeric', year: 'numeric' })} at {formatTimeLabel(appointment.time)}
                            </p>
                            <p className="mt-1 text-sm text-police dark:text-slate-300">Slot length: {appointment.durationMinutes} minutes</p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => updateStatus(appointment.id, 'accepted')}
                            disabled={!appointment.canApprove || statusLoadingId === `${appointment.id}:accepted`}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {statusLoadingId === `${appointment.id}:accepted` ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5" />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(appointment.id, 'rejected')}
                            disabled={statusLoadingId === `${appointment.id}:rejected`}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {statusLoadingId === `${appointment.id}:rejected` ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <XCircle className="h-5 w-5" />
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
                    <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-8 text-sm text-police dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      No pending requests right now.
                    </div>
                  ) : null}
                </section>

                <section className="rounded-[36px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-maastricht dark:text-slate-100">Today&apos;s schedule</h2>
                    <p className="text-sm text-police dark:text-slate-400">A cleaner daily layout for the appointments that matter most today.</p>
                  </div>

                  <div className="hidden rounded-[28px] border border-slate-200 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-silver-lake dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 xl:grid xl:grid-cols-12">
                    <div className="col-span-3">Name</div>
                    <div className="col-span-3">Service</div>
                    <div className="col-span-3">Time</div>
                    <div className="col-span-2">Number</div>
                    <div className="col-span-1">Type</div>
                  </div>

                  <div className="space-y-4 pt-2">
                    {dashboard.todayAppointments.map((appointment) => (
                      <article key={appointment.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-600 dark:bg-slate-700">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
                          <div className="min-w-0 xl:col-span-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Name</p>
                            <h3 className="mt-1 break-words text-xl font-semibold text-maastricht dark:text-slate-100">{appointment.fullName}</h3>
                          </div>

                          <div className="min-w-0 xl:col-span-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Service</p>
                            <p className="mt-1 text-lg font-semibold text-police dark:text-slate-200">{formatServiceLabel(appointment.service)}</p>
                          </div>

                          <div className="min-w-0 xl:col-span-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Time</p>
                            <p className="mt-1 text-lg font-semibold text-maastricht dark:text-slate-100">
                              {formatTimeLabel(appointment.time)}
                              <span className="text-police dark:text-slate-300">{appointment.scheduledEnd ? ' to ' : ''}</span>
                              {appointment.scheduledEnd ? formatTimeFromDateValue(appointment.scheduledEnd) : ''}
                            </p>
                          </div>

                          <div className="min-w-0 xl:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Number</p>
                            <p className="mt-1 text-lg font-semibold text-police dark:text-slate-200">{appointment.number}</p>
                          </div>

                          <div className="xl:col-span-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Type</p>
                            <div className="mt-2">{typePill(appointment)}</div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <span className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ${getStatusTone(appointment.status)}`}>
                            {appointment.statusLabel}
                          </span>

                          {appointment.status === 'accepted' ? (
                            appointment.canMarkOutcome ? (
                              <div className="flex flex-col gap-3 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={() => updateStatus(appointment.id, 'completed')}
                                  disabled={statusLoadingId === `${appointment.id}:completed`}
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {statusLoadingId === `${appointment.id}:completed` ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-5 w-5" />
                                  )}
                                  Completed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateStatus(appointment.id, 'notCompleted')}
                                  disabled={statusLoadingId === `${appointment.id}:notCompleted`}
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-700 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {statusLoadingId === `${appointment.id}:notCompleted` ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <Clock3 className="h-5 w-5" />
                                  )}
                                  Not Completed
                                </button>
                              </div>
                            ) : (
                              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-police dark:bg-slate-800/60 dark:text-slate-300">
                                Outcome buttons open when the appointment starts at {formatTimeLabel(appointment.time)}.
                              </div>
                            )
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>

                  {dashboard.todayAppointments.length === 0 ? (
                    <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-8 text-sm text-police dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      No approved, rejected, completed, or not completed appointments for today yet.
                    </div>
                  ) : null}
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-[36px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-maastricht dark:text-slate-100">Upcoming appointments</h2>
                    <p className="text-sm text-police dark:text-slate-400">The next closest approved schedules from now.</p>
                  </div>

                  <div className="space-y-4">
                    {(dashboard.upcomingAppointments || []).map((appointment) => (
                      <article key={appointment.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-600 dark:bg-slate-700">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Name</p>
                            <h3 className="mt-1 break-words text-xl font-semibold text-maastricht dark:text-slate-100">{appointment.fullName}</h3>
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Service</p>
                            <p className="mt-1 text-lg font-semibold text-police dark:text-slate-200">{formatServiceLabel(appointment.service)}</p>
                          </div>

                          <div className="min-w-0 md:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake dark:text-slate-300">Time</p>
                            <p className="mt-1 text-lg font-semibold text-maastricht dark:text-slate-100">
                              {formatDateKey(appointment.dateKey, { month: 'long', day: 'numeric', year: 'numeric' })} at {formatTimeLabel(appointment.time)}
                              <span className="text-police dark:text-slate-300">{appointment.scheduledEnd ? ' to ' : ''}</span>
                              {appointment.scheduledEnd ? formatTimeFromDateValue(appointment.scheduledEnd) : ''}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <span className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ${getStatusTone(appointment.status)}`}>
                            {appointment.statusLabel}
                          </span>
                          <div className="mt-1">{typePill(appointment)}</div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {(dashboard.upcomingAppointments || []).length === 0 ? (
                    <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-8 text-sm text-police dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      No upcoming approved appointments.
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminPageShell>
  );
}

export default AdminDashboard;
