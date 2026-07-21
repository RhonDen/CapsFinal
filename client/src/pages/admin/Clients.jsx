import api from '../../api.js';
import { Users } from 'lucide-react';
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

function Clients() {
  const [clients, setClients] = useState([]);
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

  const normalizedClients = useMemo(() => {
    return (clients || []).map((c) => ({
      number: c.number,
      fullName: c.fullName || [c.lastName, c.firstName].filter(Boolean).join(', ') || 'N/A',
      lastAppointment: c.lastAppointment,
    }));
  }, [clients]);

  return (
    <AdminPageShell
      title="Clients"
      description="See saved client phone numbers, client name, and the latest recorded appointment connected to each one."
      icon={Users}
      maxWidth="max-w-5xl"
    >
      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-maastricht text-white">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Phone Number</th>
              <th className="p-3">Last Appointment</th>
            </tr>
          </thead>
          <tbody>
            {normalizedClients.map((client) => (
              <tr key={client.number} className="border-b border-gray-100">
                <td className="p-3 font-medium text-police">{client.fullName}</td>
                <td className="p-3">{client.number}</td>
                <td className="p-3">{formatDateTime(client.lastAppointment)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {normalizedClients.length === 0 && !error ? (
          <p className="p-4 text-sm text-police">No client records yet.</p>
        ) : null}
      </div>
    </AdminPageShell>
  );
}

export default Clients;

