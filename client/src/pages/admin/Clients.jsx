import api from '../../api.js';
import { ChevronDown, ChevronUp, Loader2, Phone, Search, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';

const ITEMS_PER_PAGE = 10;

function formatDateTime(value) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function formatDateKey(dateKey) {
  if (!dateKey) return 'N/A';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTimeLabel(time) {
  if (!time) return 'N/A';
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 || 12;
  return `${displayHours}:${String(m).padStart(2, '0')} ${suffix}`;
}

const STATUS_OVERRIDES = {
  pending: 'Pending', accepted: 'Approved', rejected: 'Rejected',
  completed: 'Completed', notCompleted: 'Not Completed',
};

const STATUS_TONES = {
  pending: 'bg-amber-100 text-amber-800', accepted: 'bg-sky-100 text-sky-800',
  rejected: 'bg-red-100 text-red-700', completed: 'bg-emerald-100 text-emerald-700',
  notCompleted: 'bg-rose-100 text-rose-700',
};

function Clients() {
  const [clients, setClients] = useState([]);
  const [expandedNumber, setExpandedNumber] = useState(null);
  const [appointmentsMap, setAppointmentsMap] = useState({});
  const [loadingAppointments, setLoadingAppointments] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await api.get('/api/admin/clients');
        setClients(response.data);
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Failed to load clients.');
      }
    };
    fetchClients();
  }, []);

  const fetchAppointmentsForNumber = async (number) => {
    if (appointmentsMap[number]) return;
    setLoadingAppointments((prev) => ({ ...prev, [number]: true }));
    try {
      const response = await api.get(`/api/admin/clients/${encodeURIComponent(number)}/appointments`);
      setAppointmentsMap((prev) => ({ ...prev, [number]: response.data.appointments }));
    } catch {
      setAppointmentsMap((prev) => ({ ...prev, [number]: [] }));
    } finally {
      setLoadingAppointments((prev) => ({ ...prev, [number]: false }));
    }
  };

  const toggleExpand = (number) => {
    if (expandedNumber === number) {
      setExpandedNumber(null);
    } else {
      setExpandedNumber(number);
      fetchAppointmentsForNumber(number);
    }
  };

  const groupedClients = useMemo(() => {
    const numberGroups = new Map();
    clients.forEach((client) => {
      if (!numberGroups.has(client.number)) {
        numberGroups.set(client.number, {
          allNames: new Set(), lastAppointment: client.lastAppointment, fullName: client.fullName,
        });
      }
      const group = numberGroups.get(client.number);
      if (Array.isArray(client.allNames) && client.allNames.length > 0) {
        client.allNames.forEach((name) => { if (name) group.allNames.add(name); });
      } else if (client.fullName) {
        group.allNames.add(client.fullName);
      }
    });
    return Array.from(numberGroups.entries()).map(([number, group]) => ({
      number, fullName: group.fullName,
      allNames: Array.from(group.allNames).sort(), lastAppointment: group.lastAppointment,
    }));
  }, [clients]);

  const filteredClients = useMemo(() => {
    let result = groupedClients;
    const nameQuery = searchQuery.toLowerCase().trim();
    const phoneQuery = phoneFilter.replace(/\D/g, '').trim();

    if (nameQuery) {
      result = result.filter((client) =>
        client.allNames.some((name) => name.toLowerCase().includes(nameQuery))
      );
    }
    if (phoneQuery) {
      result = result.filter((client) => {
        const digits = client.number.replace(/\D/g, '');
        return digits.includes(phoneQuery);
      });
    }
    return result;
  }, [groupedClients, searchQuery, phoneFilter]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => { setCurrentPage(1); }, [searchQuery, phoneFilter]);

  return (
    <AdminPageShell
      title="Clients"
      description="Search by patient name or phone number, click to view all appointments."
      icon={Users}
      maxWidth="max-w-5xl"
    >
      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      {/* Search & Filter Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-silver-lake" />
          <input
            type="text"
            placeholder="Search by patient name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-10 text-sm text-police focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-silver-lake hover:text-police">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="relative sm:w-64">
          <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-silver-lake" />
          <input
            type="text"
            placeholder="Filter by phone number..."
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-10 text-sm text-police focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
          />
          {phoneFilter && (
            <button onClick={() => setPhoneFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-silver-lake hover:text-police">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <p className="mb-4 text-sm text-silver-lake">
        {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
        {filteredClients.length !== groupedClients.length && ` (filtered from ${groupedClients.length})`}
      </p>

      {/* Clients List */}
      <div className="space-y-3">
        {paginatedClients.map((client) => {
          const isExpanded = expandedNumber === client.number;
          return (
            <div key={client.number} className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm transition">
              <button
                onClick={() => toggleExpand(client.number)}
                className="flex w-full items-center justify-between p-5 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-maastricht">{client.fullName}</p>
                  <p className="mt-1 text-sm text-police">
                    {client.number}
                    {client.allNames.length > 1 ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                        {client.allNames.length} names
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-silver-lake sm:block">
                    Last: {formatDateTime(client.lastAppointment)}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-silver-lake" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-silver-lake" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-slate-50/70 p-5">
                  {client.allNames.length > 1 && (
                    <div className="mb-4 rounded-2xl bg-purple-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">Different names sharing this number</p>
                      <p className="mt-1 text-sm text-purple-800">{client.allNames.join(', ')}</p>
                    </div>
                  )}

                  {loadingAppointments[client.number] ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-silver-lake" />
                      <span className="ml-2 text-sm text-police">Loading appointments...</span>
                    </div>
                  ) : appointmentsMap[client.number] && appointmentsMap[client.number].length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-silver-lake">
                        {appointmentsMap[client.number].length} appointment{appointmentsMap[client.number].length > 1 ? 's' : ''}
                      </p>
                      {appointmentsMap[client.number].map((appt) => (
                        <div key={appt.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold text-maastricht">{appt.fullName}</p>
                              <p className="mt-0.5 text-sm text-silver-lake">
                                {appt.service}{appt.isWalkIn ? ' (Walk-in)' : ''}
                              </p>
                            </div>
                            <span className={`inline-flex w-max items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONES[appt.status] || 'bg-gray-100 text-gray-700'}`}>
                              {STATUS_OVERRIDES[appt.status] || appt.status}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 p-2.5">
                              <p className="text-xs text-silver-lake">Date</p>
                              <p className="text-sm font-medium text-police">{formatDateKey(appt.dateKey)}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2.5">
                              <p className="text-xs text-silver-lake">Time</p>
                              <p className="text-sm font-medium text-police">{formatTimeLabel(appt.time)}</p>
                            </div>
                          </div>
                          {appt.serialNumber && (
                            <p className="mt-2 text-xs text-silver-lake">Booking #{appt.serialNumber}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : appointmentsMap[client.number] ? (
                    <p className="py-4 text-center text-sm text-police">No appointments found for this number.</p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        {filteredClients.length === 0 && !error ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-police">
            {searchQuery.trim() || phoneFilter.trim()
              ? 'No clients match your search.'
              : 'No client records yet.'}
          </p>
        ) : null}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-police transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                page === currentPage
                  ? 'bg-silver-lake text-white'
                  : 'border border-gray-200 bg-white text-police hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-police transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </AdminPageShell>
  );
}

export default Clients;
