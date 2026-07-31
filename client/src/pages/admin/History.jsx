import api from '../../api.js';
import { Calendar, ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
  { value: 'notCompleted', label: 'Not Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  completed: 'bg-emerald-600 text-white',
  notCompleted: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  cancelled: 'bg-red-50 text-red-700 ring-1 ring-red-200',
};

const STATUS_LABEL = {
  pending: 'Pending',
  accepted: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  notCompleted: 'Not Completed',
  cancelled: 'Cancelled',
};

function formatDateOnly(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatDateKey(dateKey) {
  if (!dateKey) return '—';
  const [y, m, d] = String(dateKey).split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(time) {
  if (!time) return '—';
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 || 12;
  return `${display}:${String(m).padStart(2, '0')} ${suffix}`;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  let key = digits;
  if (key.startsWith('63')) key = key.slice(2);
  if (key.startsWith('0')) key = key.slice(1);
  return key.length > 10 ? key.slice(-10) : key;
}

function getPatientName(row) {
  if (row.fullName && row.fullName.trim()) return row.fullName.trim();
  const parts = [row.firstName, row.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Unknown';
}

const ITEMS_PER_PAGE = 10;

function History() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [expandedPhone, setExpandedPhone] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      
      // If search text is provided, send it to backend which ignores date filters
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      } else {
        // Normal filter mode: use date range and other filters
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);
        if (statusFilter) params.set('status', statusFilter);
        if (phoneFilter) params.set('phone', phoneFilter.replace(/\D/g, '').slice(0, 11));
      }

      const response = await api.get(`/api/admin/history?${params.toString()}`);
      setAppointments(response.data.appointments || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, statusFilter, phoneFilter, searchQuery]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // No client-side filtering needed — backend handles search across ALL records
  const groupedByPhone = useMemo(() => {
    const groups = new Map();

    appointments.forEach((a) => {
      const key = normalizePhone(a.number) || `unknown-${a.id}`;
      if (!groups.has(key)) {
        groups.set(key, { phoneKey: key, displayNumber: a.number || 'N/A', appointments: [] });
      }
      groups.get(key).appointments.push(a);
    });

    return Array.from(groups.values())
      .map((g) => {
        const sorted = g.appointments.sort((a, b) => {
          const aDate = a.scheduledStart || a.date || a.createdAt;
          const bDate = b.scheduledStart || b.date || b.createdAt;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });
        const latest = sorted[0];
        return {
          ...g,
          appointments: sorted,
          latestName: getPatientName(latest),
          latestDate: latest?.dateKey || latest?.date || latest?.scheduledStart,
          count: sorted.length,
        };
      })
      .sort((a, b) => {
        const aTime = new Date(a.latestDate).getTime();
        const bTime = new Date(b.latestDate).getTime();
        if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
        if (!Number.isFinite(aTime)) return 1;
        if (!Number.isFinite(bTime)) return -1;
        return bTime - aTime;
      });
  }, [appointments]);

  const clearFilters = () => {
    setFromDate(() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().slice(0, 10);
    });
    setToDate(today);
    setStatusFilter('');
    setPhoneFilter('');
    setSearchQuery('');
  };

  const hasActiveFilters = fromDate !== (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })() || toDate !== today || statusFilter !== '' || phoneFilter !== '' || searchQuery !== '';

  return (
    <AdminPageShell
      title="Appointment History"
      description="Review past appointments with powerful search and filtering."
      icon={Calendar}
      backTo="/admin/dashboard"
      backLabel="Dashboard"
      maxWidth="max-w-7xl"
    >
      {/* ── Filter Panel ── */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Filters</h2>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-500 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Phone</label>
            <input
              type="text"
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value)}
              placeholder="09XXXXXXXXX"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name or number…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? 'Searching…' : 'Search'}
          </button>
          {searchQuery && (
            <span className="text-xs text-slate-400">
              Filtering by <strong className="text-slate-600">"{searchQuery}"</strong>
            </span>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
        )}
      </div>

      {/* ── Results ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              <span className="text-sm">Loading history…</span>
            </div>
          </div>
        ) : groupedByPhone.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="mx-auto h-10 w-10 text-slate-200" />
            <p className="mt-3 text-sm text-slate-400">No appointments found for the selected filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groupedByPhone.map((group) => {
              const isExpanded = expandedPhone === group.phoneKey;

              return (
                <div key={group.phoneKey}>
                  {/* ── Group Header ── */}
                  <button
                    onClick={() => setExpandedPhone(isExpanded ? null : group.phoneKey)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {group.latestName}
                        </h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${group.count > 1 ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200' : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200'}`}>
                          {group.count}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {group.displayNumber} &middot; Latest: {formatDateKey(group.latestDate)}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 text-slate-300">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </button>

                  {/* ── Expanded Appointments ── */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Date</th>
                              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Time</th>
                              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Patient</th>
                              <th className="hidden px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell sm:px-6">Service</th>
                              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.appointments.map((a) => (
                              <tr key={a.id} className="transition hover:bg-white">
                                <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-700 sm:px-6">
                                  {formatDateKey(a.dateKey || a.date)}
                                </td>
                                <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-700 sm:px-6">
                                  {formatTime(a.time)}
                                </td>
                                <td className="px-5 py-3 text-sm font-medium text-slate-900 sm:px-6">
                                  <div>{getPatientName(a)}</div>
                                  <div className="text-xs text-slate-400">{a.number}</div>
                                </td>
                                <td className="hidden whitespace-nowrap px-5 py-3 text-sm text-slate-600 sm:table-cell sm:px-6">
                                  {a.service || '—'}
                                </td>
                                <td className="whitespace-nowrap px-5 py-3 sm:px-6">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status] || 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'}`}>
                                    {STATUS_LABEL[a.status] || a.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Summary ── */}
      {!loading && groupedByPhone.length > 0 && (
        <div className="mt-4 text-center text-xs text-slate-400">
          Showing {groupedByPhone.length} patient group{groupedByPhone.length !== 1 ? 's' : ''} &middot;{' '}
          {appointments.length} total appointment{appointments.length !== 1 ? 's' : ''}
        </div>
      )}
    </AdminPageShell>
  );
}

export default History;
