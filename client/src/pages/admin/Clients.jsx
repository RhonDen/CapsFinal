import api from '../../api.js';
import { ChevronLeft, ChevronRight, Phone, Search, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';

const ITEMS_PER_PAGE = 10;

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getClientName(client) {
  if (client.fullName && client.fullName.trim()) return client.fullName.trim();
  const parts = [client.firstName, client.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Unknown';
}

function Clients() {
  const [clients, setClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/api/admin/clients');
        setClients(response.data || []);
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Failed to load clients.');
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  // Searchable by name or phone digits.
  // Names use substring matching so typing "Geo" immediately shows "George",
  // and a name is matched whether it appears as a first name OR last name
  // (e.g. "George" matches both "George Cruz" and "Maria George").
  // IMPORTANT: each typed token is matched against EACH individual name
  // field separately (first name, last name, full name). This prevents
  // false matches that span across two joined names (e.g. searching "zge"
  // must NOT match because "z" is at the end of "Cruz" and "ge" is the
  // start of "George" — they are different fields).
  // Phone numbers are normalized on BOTH sides (handles E.164 "+63917..."
  // vs the "09..." the admin types) so partial typing works immediately.
  const filteredClients = useMemo(() => {
    let result = clients;
    const nameQuery = searchQuery.trim().toLowerCase();
    const phoneQuery = phoneFilter.replace(/\D/g, '').trim();

    if (nameQuery) {
      const nameParts = nameQuery.split(/\s+/).filter(Boolean);
      result = result.filter((client) => {
        // Collect each name field as its OWN string (no concatenation).
        const nameFields = [
          String(client.firstName || ''),
          String(client.lastName || ''),
          getClientName(client),
          ...(Array.isArray(client.allNames) ? client.allNames : []),
        ]
          .map((n) => String(n || '').trim().toLowerCase())
          .filter(Boolean);

        // Every typed token must be a substring of at least ONE name field.
        // This ensures a token never accidentally spans two different names.
        return nameParts.every((part) =>
          nameFields.some((field) => field.includes(part))
        );
      });
    }
    if (phoneQuery) {
      // Normalize the query: if the admin types "09...", also try the
      // E.164 form "639..." (and vice-versa) so partial typing works.
      const qDigits = phoneQuery;
      const q63 = qDigits.startsWith('0')
        ? '63' + qDigits.slice(1)
        : qDigits.startsWith('63')
        ? '0' + qDigits.slice(2)
        : qDigits;

      result = result.filter((client) => {
        const rawDigits = String(client.number || '').replace(/\D/g, '');
        const last10 = rawDigits.slice(-10);
        // Also build a "0-prefixed" variant of the stored number so a
        // search for "09..." matches "+63917..." correctly.
        const withZero = last10.startsWith('63')
          ? '0' + last10.slice(2)
          : last10;

        return (
          rawDigits.includes(qDigits) ||
          rawDigits.includes(q63) ||
          last10.includes(qDigits) ||
          last10.includes(q63) ||
          withZero.includes(qDigits) ||
          withZero.includes(q63)
        );
      });
    }
    return result;
  }, [clients, searchQuery, phoneFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / ITEMS_PER_PAGE));
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, phoneFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setPhoneFilter('');
  };

  const hasActiveFilters = searchQuery !== '' || phoneFilter !== '';

  return (
    <AdminPageShell
      title="Clients"
      description="Search patients by name or phone number."
      icon={Users}
      backTo="/admin/dashboard"
      backLabel="Dashboard"
      maxWidth="max-w-5xl"
    >
      {/* ── Search & Filter Bar ── */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Search Clients</h2>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value.replace(/\D/g, ''))}
              placeholder="Filter by phone number…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
        )}
      </div>

      {/* ── Results Count ── */}
      <p className="mb-4 text-sm text-slate-500">
        {loading
          ? 'Loading clients…'
          : `${filteredClients.length} client${filteredClients.length !== 1 ? 's' : ''}` +
            (filteredClients.length !== clients.length ? ` (filtered from ${clients.length})` : '')}
      </p>

      {/* ── Results: Flat Clients Table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              <span className="text-sm">Loading clients…</span>
            </div>
          </div>
        ) : paginatedClients.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-200" />
            <p className="mt-3 text-sm text-slate-400">
              {hasActiveFilters ? 'No clients match your search.' : 'No client records yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Name</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-6">Phone</th>
                  <th className="hidden px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell sm:px-6">Last Appointment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedClients.map((client) => (
                  <tr key={client.number || client.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-900 sm:px-6">
                      {getClientName(client)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600 sm:px-6">
                      {client.number || '—'}
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3.5 text-sm text-slate-600 sm:table-cell sm:px-6">
                      {formatDateTime(client.lastAppointment)}
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
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredClients.length)} of {filteredClients.length} clients
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

export default Clients;
