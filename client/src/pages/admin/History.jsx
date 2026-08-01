import api from '../../api.js';
import { Calendar, ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react';
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

  // Flat list — no phone grouping. Sort by date descending.
  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const aDate = a.scheduledStart || a.date || a.createdAt;
      const bDate = b.scheduledStart || b.date || b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [appointments]);

  const totalPages = Math.max(1, Math.ceil(sortedAppointments.length / ITEMS_PER_PAGE));
  const paginatedAppointments = sortedAppointments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fromDate, toDate, statusFilter, phoneFilter]);

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

      {/* ── Results: Flat Appointment Table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              <span className="text-sm">Loading history…</span>
            </div>
          </div>
        ) : sortedAppointments.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="mx-auto h-10 w-10 text-slate-200" />
            <p className="mt-3 text-sm text-slate-400">No appointments found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Date</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Time</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Patient</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Phone</th>
                  <th className="hidden px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell sm:px-6">Service</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAppointments.map((a) => (
                  <tr key={a.id} className="transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-700 sm:px-6">
                      {formatDateKey(a.dateKey || a.date)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-700 sm:px-6">
                      {formatTime(a.time)}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-900 sm:px-6">
                      {getPatientName(a)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600 sm:px-6">
                      {a.number || '—'}
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3.5 text-sm text-slate-600 sm:table-cell sm:px-6">
                      {a.service || '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 sm:px-6">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status] || 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'}`}>
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(currentPage * ITEMS_PER_PAGE, sortedAppointments.length)} of {sortedAppointments.length} appointments
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-sm text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

export default History;
