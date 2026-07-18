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

const STATUS_STYLES = {
  pending: 'bg-slate-50 text-slate-700 border-slate-200',
  accepted: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-900 border-rose-200',
  completed: 'bg-emerald-600 text-white border-emerald-700',
  // Use a darker amber for readable contrast with dark text.
  notCompleted: 'bg-amber-300 text-slate-900 border-amber-400',
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

  // Normalize phone so +63 and 09 are treated as the same person.
  // Canonical strategy:
  // - digitsOnly
  // - if starts with "63" => remove leading "63"
  // - if starts with "0" => remove leading "0"
  // - keep remaining digits (if unusually long, keep last 10)
  const normalizePhoneKey = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';

    let key = digits;
    if (key.startsWith('63')) key = key.slice(2);
    if (key.startsWith('0')) key = key.slice(1);

    if (key.length > 10) key = key.slice(-10);
    return key;
  };

  const getFullNameForRow = (r) => {
    const fromFull = String(r.fullName || '').trim();
    if (fromFull) return fromFull;
    const composed = `${r.firstName || ''} ${r.lastName || ''}`.trim();
    return composed || 'Unknown';
  };

  return (
    <AdminPageShell
      title="Appointment History"
      description="Search appointments across dates/status (read-only)."
      icon={Calendar}
      backTo="/admin/dashboard"
      backLabel="Dashboard"
      maxWidth="max-w-7xl"
    >
      <div className="mb-6 flex flex-col gap-5 rounded-[28px] bg-white p-7 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="h-6 w-6 text-silver-lake" />
          <p className="text-lg font-semibold text-maastricht">Filters</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-police">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(formatDateOnly(e.target.value))}
              className="rounded-xl border border-gray-200 p-4 text-base"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-police">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(formatDateOnly(e.target.value))}
              className="rounded-xl border border-gray-200 p-4 text-base"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-police">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-gray-200 p-4 text-base"
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
              className="rounded-xl border border-gray-200 p-4 text-base"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-police">Find (name/number)</span>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Type a name or number…"
              className="rounded-xl border border-gray-200 p-4 text-base"
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
            <p className="text-base text-police">
              Showing matches for <span className="font-semibold">{searchText}</span>
            </p>
          ) : null}
        </div>

        {error ? <div className="text-sm text-red-700">{error}</div> : null}
      </div>

      <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-7 text-base text-police">
              Loading history…
            </div>
          ) : effectiveRows.length === 0 ? (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-7 text-base text-police">
              No appointments found for selected filters.
            </div>
          ) : (
            (() => {
              const statusOrder = ['pending', 'accepted', 'rejected', 'completed', 'notCompleted'];

              // Normalize phone so +63 and 09 are treated as the same person.
              // Canonical strategy:
              // - digitsOnly
              // - if starts with "63" => remove leading "63"
              // - if starts with "0" => remove leading "0"
              // - keep remaining digits (if unusually long, keep last 10)
              const normalizePhoneKey = (value) => {
                const digits = String(value || '').replace(/\D/g, '');
                if (!digits) return '';

                let key = digits;
                if (key.startsWith('63')) key = key.slice(2);
                if (key.startsWith('0')) key = key.slice(1);

                if (key.length > 10) key = key.slice(-10);
                return key;
              };

              const getFullNameForRow = (r) => {
                const fromFull = String(r.fullName || '').trim();
                if (fromFull) return fromFull;
                return `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Unknown';
              };

              // Folder grouping by normalized phone number.
              // Each folder shows the latest appointment date on top,
              // and inside shows past/previous appointments (newest -> oldest).
              const byPhone = new Map();

              effectiveRows.forEach((r) => {
                const phoneKey = normalizePhoneKey(r.number);
                const key = phoneKey || `unknown:${String(r.id ?? '')}`;

                const bucket = byPhone.get(key) || [];
                bucket.push(r);
                byPhone.set(key, bucket);
              });

              const phoneFolders = Array.from(byPhone.entries())
                .map(([key, appts]) => {
                  const sorted = appts.slice().sort((a, b) => {
                    const at = a.scheduledStart || a.date || a.createdAt;
                    const bt = b.scheduledStart || b.date || b.createdAt;
                    return new Date(bt).getTime() - new Date(at).getTime();
                  });

                  const latest = sorted[0];
                  const latestDateKey = latest?.dateKey || latest?.date || latest?.scheduledStart || latest?.createdAt;

                  return { key, appts: sorted, latestDateKey };
                })
                .sort((a, b) => {
                  const da = new Date(a.latestDateKey).getTime();
                  const db = new Date(b.latestDateKey).getTime();
                  if (!Number.isFinite(da) && !Number.isFinite(db)) return String(b.key).localeCompare(String(a.key));
                  if (!Number.isFinite(da)) return 1;
                  if (!Number.isFinite(db)) return -1;
                  return db - da;
                });

              const getLatestNice = (row) => {
                const dk = row?.dateKey || row?.date;
                return dk ? formatDateKeyToNice(dk) : 'N/A';
              };

              return (
                <div className="space-y-6">
                  {phoneFolders.map((folder) => {
                    const appts = folder.appts;

                    // Canonical display name = name from latest appointment (handles “same number different name”)
                    const latestRow = appts[0];
                    const latestName = getFullNameForRow(latestRow);

                    // Group appointments within the folder by status (cards),
                    // but list items are ordered newest -> oldest.
                    const groupedByStatus = statusOrder.reduce((acc, s) => {
                      acc[s] = [];
                      return acc;
                    }, {});

                    appts.forEach((r) => {
                      const s = r.status;
                      if (!groupedByStatus[s]) groupedByStatus[s] = [];
                      groupedByStatus[s].push(r);
                    });

                    const folderLatestNice = getLatestNice(latestRow);

                    return (
                      <section
                        key={folder.key}
                        className="rounded-[28px] border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex flex-col gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-silver-lake">
                              Client folder
                            </p>
                            <h3 className="mt-1 text-xl font-semibold text-maastricht break-words">
                              {latestName}
                            </h3>
                            <p className="mt-1 text-sm text-police">
                              Latest: {folderLatestNice} • {appts.length} appointment{appts.length === 1 ? '' : 's'}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-police whitespace-nowrap">
                              {latestRow?.number || 'N/A'}
                            </div>
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
                                  className={`rounded-[18px] border p-4 ${
                                    STATUS_STYLES[s] || 'border-slate-200 bg-slate-50/70 text-slate-700'
                                  }`}
                                >
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-base font-semibold text-slate-900">{label}</p>
                                    <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-semibold text-slate-700">
                                      {list.length}
                                    </span>
                                  </div>

                                  <div className="space-y-3">
                                    {list.map((r) => {
                                      const pillClass =
                                        r.status === 'completed'
                                          ? 'bg-emerald-600 text-white border-emerald-700'
                                          : r.status === 'notCompleted'
                                            ? 'bg-amber-300 text-slate-900 border-amber-400'
                                            : r.status === 'accepted'
                                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                              : r.status === 'rejected'
                                                ? 'bg-rose-50 text-rose-900 border-rose-200'
                                                : 'bg-slate-50 text-slate-700 border-slate-200';

                                      // list is already newest->oldest due to folder sorting,
                                      // but statuses grouping preserves original order from appts.
                                      return (
                                        <article
                                          key={r.id}
                                          className="rounded-[16px] border border-slate-200 bg-white p-3"
                                        >
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                                                  {r.time || 'N/A'}
                                                </p>
                                                <span
                                                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${pillClass}`}
                                                >
                                                  {STATUS_LABELS_FALLBACK[r.status] || r.status}
                                                </span>
                                              </div>
                                              <h4 className="mt-2 break-words text-lg font-semibold text-slate-900">
                                                {getFullNameForRow(r)}
                                              </h4>
                                              <p className="mt-1 text-base font-semibold text-slate-700">
                                                {r.service}
                                              </p>
                                            </div>
                                            <div className="flex flex-col gap-1 sm:items-end">
                                              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                                                Phone
                                              </p>
                                              <p className="text-base font-semibold text-slate-900 whitespace-nowrap">
                                                {r.number}
                                              </p>
                                            </div>
                                          </div>
                                        </article>
                                      );
                                    })}
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

