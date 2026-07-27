import api from '../../api.js';
import { ChevronDown, ChevronUp, Loader2, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';

function formatDateTime(value) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';

  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateKey(dateKey) {
  if (!dateKey) return 'N/A';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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
  pending: 'Pending',
  accepted: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  notCompleted: 'Not Completed',
};

const STATUS_TONES = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-sky-100 text-sky-800',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
  notCompleted: 'bg-rose-100 text-rose-700',
};

function Clients() {
  const [clients, setClients] = useState([]);
  const [expandedNumber, setExpandedNumber] = useState(null);
  const [appointmentsMap, setAppointmentsMap] = useState({});
  const [loadingAppointments, setLoadingAppointments] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
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
    if (appointmentsMap[number]) return; // Already loaded

    setLoadingAppointments((prev) => ({ ...prev, [number]: true }));

    try {
      const response = await api.get(`/api/admin/clients/${encodeURIComponent(number)}/appointments`);
      setAppointmentsMap((prev) => ({ ...prev, [number]: response.data.appointments }));
    } catch (requestError) {
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

  // Group clients by number — use allNames from API response for search
  const groupedClients = useMemo(() => {
    const numberGroups = new Map();

    clients.forEach((client) => {
      if (!numberGroups.has(client.number)) {
        numberGroups.set(client.number, {
          allNames: new Set(),
          lastAppointment: client.lastAppointment,
          fullName: client.fullName,
        });
      }
      const group = numberGroups.get(client.number);

      // Use allNames from API if available, otherwise fall back to fullName
      if (Array.isArray(client.allNames) && client.allNames.length > 0) {
        client.allNames.forEach((name) => {
          if (name) group.allNames.add(name);
        });
      } else if (client.fullName) {
        group.allNames.add(client.fullName);
      }
    });

    return Array.from(numberGroups.entries()).map(([number, group]) => ({
      number,
      fullName: group.fullName,
      allNames: Array.from(group.allNames).sort(),
      lastAppointment: group.lastAppointment,
    }));
  }, [clients]);

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return groupedClients;

    const query = searchQuery.toLowerCase().trim();

    return groupedClients.filter((client) => {
      // Search by any name associated with this number
      return client.allNames.some((name) => name.toLowerCase().includes(query));
    });
  }, [groupedClients, searchQuery]);

  return (
    <AdminPageShell
      title="Clients"
      description="Search by patient name, click to view all appointments under that phone number. Multiple names sharing the same number will all appear."
      icon={Users}
      maxWidth="max-w-5xl"
    >
      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-silver-lake" />
        <input
          type="text"
          placeholder="Search by patient name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm text-police focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
        />
      </div>

      {/* Clients List */}
      <div className="space-y-3">
        {filteredClients.map((client) => {
          const isExpanded = expandedNumber === client.number;

          return (
            <div
              key={client.number}
              className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm transition"
            >
              {/* Client Header - Clickable */}
              <button
                onClick={() => toggleExpand(client.number)}
                className="flex w-full items-center justify-between p-5 text-left transition hover:bg-slate-50"
              >
                <div>
                  <p className="text-lg font-semibold text-maastricht">{client.fullName}</p>
                  <p className="mt-1 text-sm text-police">
                    {client.number}
                    {client.allNames.length > 1 ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                        {client.allNames.length} names
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-3">
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

              {/* Expanded Appointments */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-slate-50/70 p-5">
                  {/* All names for this number */}
                  {client.allNames.length > 1 && (
                    <div className="mb-4 rounded-2xl bg-purple-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                        Different names sharing this number
                      </p>
                      <p className="mt-1 text-sm text-purple-800">
                        {client.allNames.join(', ')}
                      </p>
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
                        <div
                          key={appt.id}
                          className="rounded-2xl border border-gray-200 bg-white p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold text-maastricht">{appt.fullName}</p>
                              <p className="mt-0.5 text-sm text-silver-lake">
                                {appt.service}
                                {appt.isWalkIn ? ' (Walk-in)' : ''}
                              </p>
                            </div>
                            <span
                              className={`inline-flex w-max items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                                STATUS_TONES[appt.status] || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {STATUS_OVERRIDES[appt.status] || appt.status}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 p-2.5">
                              <p className="text-xs text-silver-lake">Date</p>
                              <p className="text-sm font-medium text-police">
                                {formatDateKey(appt.dateKey)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2.5">
                              <p className="text-xs text-silver-lake">Time</p>
                              <p className="text-sm font-medium text-police">
                                {formatTimeLabel(appt.time)}
                              </p>
                            </div>
                          </div>
                          {appt.serialNumber && (
                            <p className="mt-2 text-xs text-silver-lake">
                              Booking #{appt.serialNumber}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : appointmentsMap[client.number] ? (
                    <p className="py-4 text-center text-sm text-police">
                      No appointments found for this number.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        {filteredClients.length === 0 && !error ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-police">
            {searchQuery.trim()
              ? 'No clients match your search.'
              : 'No client records yet.'}
          </p>
        ) : null}
      </div>
    </AdminPageShell>
  );
}

export default Clients;
