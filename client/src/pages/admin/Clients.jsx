import axios from 'axios';
import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';

function Clients() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await axios.get('/api/admin/clients');
        setClients(response.data);
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Failed to load clients.');
      }
    };

    fetchClients();
  }, []);

  return (
    <AdminPageShell
      title="Clients"
      description="See saved client phone numbers and the latest recorded appointment connected to each one."
      icon={Users}
      maxWidth="max-w-4xl"
    >
      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-maastricht text-white">
            <tr>
              <th className="p-3">Phone Number</th>
              <th className="p-3">Last Appointment</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.number} className="border-b border-gray-100">
                <td className="p-3">{client.number}</td>
                <td className="p-3">
                  {new Date(client.lastAppointment).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {clients.length === 0 && !error ? (
          <p className="p-4 text-sm text-police">No client records yet.</p>
        ) : null}
      </div>
    </AdminPageShell>
  );
}

export default Clients;
