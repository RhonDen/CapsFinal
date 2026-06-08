import axios from 'axios';
import { CalendarX, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';
import { formatDateKey, getLocalDateKey } from '../../utils/schedule.js';

const normalizeDateValueToKey = (value) => {
  if (!value) return '';

  if (typeof value === 'string') {
    // expected: YYYY-MM-DD or ISO
    if (value.includes('T')) {
      return formatDateKey(value, { timeZone: 'UTC' });
    }
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  // Convert to YYYY-MM-DD in local time
  return getLocalDateKey(parsed);
};


function BlockDates() {
  const [dates, setDates] = useState([]);
  const [newDate, setNewDate] = useState(getLocalDateKey());
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDates = async () => {
    try {
      const response = await axios.get('/api/admin/blocked-dates');
      setDates(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to load blocked dates.');
    }
  };

  useEffect(() => {
    fetchDates();
  }, []);

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!newDate) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/admin/block-dates', { date: newDate, reason });
      setReason('');
      await fetchDates();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to block that date.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/admin/block-dates/${id}`);
      await fetchDates();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to remove blocked date.');
    }
  };

  return (
    <AdminPageShell
      title="Block Dates"
      description="Reserve full dates when the clinic is unavailable so patients and walk-ins cannot be scheduled there."
      icon={CalendarX}
      maxWidth="max-w-3xl"
    >
      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      <form
        onSubmit={handleAdd}
        className="mb-8 flex flex-wrap gap-4 rounded-[28px] bg-white p-6 shadow-sm"
      >
        <input
          type="date"
          min={getLocalDateKey()}
          value={newDate}
          onChange={(event) => setNewDate(event.target.value)}
          required
          className="flex-1 rounded-xl border p-3"
        />
        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="flex-1 rounded-xl border p-3"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-maastricht px-6 py-3 text-white transition hover:bg-police disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
          Add
        </button>
      </form>

      <div className="space-y-3">
        {dates.map((item) => (
          <div
            key={item._id}
            className="flex items-center justify-between rounded-[24px] bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-medium text-maastricht">
                {formatDateKey(
                  normalizeDateValueToKey(item.dateKey || item.date),
                  {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  }
                )}


              </p>
              {item.reason ? <p className="text-sm text-police">{item.reason}</p> : null}
            </div>

            <button
              type="button"
              onClick={() => handleDelete(item._id)}
              className="text-red-500 transition hover:text-red-700"
              aria-label="Delete blocked date"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
    </AdminPageShell>
  );
}

export default BlockDates;
