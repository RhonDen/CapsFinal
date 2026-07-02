import axios from 'axios';
import { Calendar, Filter, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';

const STATUSES = ['pending', 'accepted', 'rejected', 'completed', 'notCompleted'];

const STATUS_LABELS_FALLBACK = {
  pending: 'Pending',
  accepted: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  notCompleted: 'Not Completed',
};

const formatDateOnly = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const formatDateKeyToNice = (dateKey) => {
  if (!dateKey) return 'N/A';
  // dateKey is YYYY-MM-DD
  const [y, m, d] = String(dateKey).split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const subtractYearsAsISODate = (years) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
};

function History() {
  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const [from, setFrom] = useState(subtractYearsAsISODate(1));
  const [to, setTo] = useState(today);

  const [status, setStatus] = useState('');
  const [phone, setPhone] = useState('');

  // Easy finding by name OR number:
  // - server can filter phone (exact digits)
  // - name/partial number is done client-side within the fetched date range
  const [searchText, setSearchText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  const buildQuery = () => {
    const params = new URLSearchParams();

    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (status) params.set('status', status);
    if (phone) params.set('phone', phone.replace(/\D/g, '').slice(0, 11));

    return params.toString();
  };

  const fetchHistory = async () => {
    setLoading(true);
    setError('');

    try {
      const qs = buildQuery();
      const response = await axios.get(`/api/admin/history?${qs}`, { withCredentials: true });
      setRows(response.data.appointments || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial load: past 1 year
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveRows = useMemo(() => {
    const q = String(searchText || '').trim().toLowerCase();
    if (!q) return rows;

    const digitsQ = q.replace(/\D/g, '');

    return rows.filter((r) => {
      const name = String(r.fullName || '').toLowerCase();
      const number = String(r.number || '').toLowerCase();

      // allow matching by name substring OR digits-only number substring
      if (digitsQ) return number.replace(/\D/g, '').includes(digitsQ) || name.includes(q);
      return name.includes(q) || number.includes(q);
    });
  }, [rows, searchText]);

  return (
    <AdminPageShell
      title="Appointment History"
      description="Search appointments across dates/status (read-only)."
      icon={Calendar}
      backTo="/admin/dashboard"
      backLabel="Dashboard"
      maxWidth="max-w-7xl"
    >
      <div className="mb-6 flex flex-col gap-4 rounded-[28px] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-silver-lake" />
          <p className="font-semibold text-maastricht">Filters</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-police">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(formatDateOnly(e.target.value))}
              className="rounded-xl border border-gray-200 p-3"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-police">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(formatDateOnly(e.target.value))}
              className="rounded-xl border border-gray-200 p-3"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-police">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-gray-200 p-3"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-police">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxxx"
              className="rounded-xl border border-gray-200 p-3"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-police">Find (name/number)</span>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Type a name or number…"
              className="rounded-xl border border-gray-200 p-3"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-maastricht px-5 py-3 text-white font-semibold transition hover:bg-police disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching…' : (
              <>
                <Search className="h-5 w-5" />
                Search
              </>
            )}
          </button>
          {searchText ? (
            <p className="text-sm text-police">
              Showing matches for <span className="font-semibold">{searchText}</span>
            </p>
          ) : null}
        </div>

        {error ? <div className="text-sm text-red-700">{error}</div> : null}
      </div>

      <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-6 text-sm text-police">
              Loading history…
            </div>
          ) : effectiveRows.length === 0 ? (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-6 text-sm text-police">
              No appointments found for selected filters.
            </div>
          ) : (
            (() => {
              const statusOrder = ['pending', 'accepted', 'rejected', 'completed', 'notCompleted'];

              // Group by dateKey (or date), newest first
              const byDate = new Map();

              effectiveRows.forEach((r) => {
                const dateKey = r.dateKey || r.date;
                const dateLabelKey = dateKey ? String(dateKey) : 'unknown';
                const bucket = byDate.get(dateLabelKey) || [];
                bucket.push(r);
                byDate.set(dateLabelKey, bucket);
              });

              const sortedDateKeys = Array.from(byDate.keys()).sort((a, b) => {
                const da = new Date(a).getTime();
                const db = new Date(b).getTime();
                if (!Number.isFinite(da) && !Number.isFinite(db)) return String(b).localeCompare(String(a));
                if (!Number.isFinite(da)) return 1;
                if (!Number.isFinite(db)) return -1;
                return db - da;
              });

              return (
                <div className="space-y-6">
                  {sortedDateKeys.map((dateKey) => {
                    const dateRows = byDate.get(dateKey) || [];
                    const groupedByStatus = statusOrder.reduce((acc, s) => {
                      acc[s] = [];
                      return acc;
                    }, {});
                    dateRows.forEach((r) => {
                      const s = r.status;
                      if (!groupedByStatus[s]) groupedByStatus[s] = [];
                      groupedByStatus[s].push(r);
                    });

                    const hasAny = Object.values(groupedByStatus).some((arr) => arr.length > 0);

                    if (!hasAny) return null;

                    return (
                      <section
                        key={dateKey}
                        className="rounded-[28px] border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex flex-col gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake">
                              Date
                            </p>
                            <h3 className="mt-1 text-xl font-semibold text-maastricht">
                              {formatDateKeyToNice(dateKey)}
                            </h3>
                            <p className="mt-1 text-sm text-police">
                              {dateRows.length} appointment{dateRows.length === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>

                        <div className="p-5">
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                            {statusOrder.map((s) => {
                              const list = groupedByStatus[s] || [];
                              if (!list.length) return null;

                              const label = STATUS_LABELS_FALLBACK[s] || s;

                              return (
                                <div
                                  key={s}
                                  className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                                >
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-maastricht">{label}</p>
                                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-police">
                                      {list.length}
                                    </span>
                                  </div>

                                  <div className="space-y-3">
                                    {list
                                      .slice()
                                      .sort((a, b) => {
                                        const at = a.scheduledStart || a.date || a.createdAt;
                                        const bt = b.scheduledStart || b.date || b.createdAt;
                                        return new Date(bt).getTime() - new Date(at).getTime();
                                      })
                                      .map((r) => (
                                        <article
                                          key={r.id}
                                          className="rounded-[18px] border border-slate-200 bg-white p-3"
                                        >
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake">
                                                {r.time || 'N/A'}
                                              </p>
                                              <h4 className="mt-1 break-words text-base font-semibold text-police">
                                                {r.fullName || `${r.firstName || ''} ${r.lastName || ''}`.trim()}
                                              </h4>
                                              <p className="mt-1 text-sm font-semibold text-maastricht">
                                                {r.service}
                                              </p>
                                            </div>
                                            <div className="flex flex-col gap-1 sm:items-end">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake">
                                                Phone
                                              </p>
                                              <p className="text-sm font-semibold text-police whitespace-nowrap">
                                                {r.number}
                                              </p>
                                            </div>
                                          </div>
                                        </article>
                                      ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}

export default History;

