import axios from 'axios';
import { CheckCircle, Loader2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminPageShell from '../../components/admin/AdminPageShell.jsx';
import { SERVICES } from '../../constants/services.js';
import {
  formatServiceLabel,
  formatTimeLabel,
  getLocalDateKey,
  getRoundedServiceDuration,
} from '../../utils/schedule.js';

function WalkIn() {
  const today = getLocalDateKey();
  const [form, setForm] = useState({
    number: '',
    lastName: '',
    firstName: '',
    middleInitial: '',
    service: '',
    notes: '',
    email: '',
    date: today,
    time: '',
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotMessage, setSlotMessage] = useState('Select a service and date to view open times.');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  useEffect(() => {
    let isMounted = true;

    const loadAvailability = async () => {
      if (!form.service || !form.date) {
        setAvailableSlots([]);
        setSlotMessage('Select a service and date to view open times.');
        setForm((current) => (current.time ? { ...current, time: '' } : current));
        return;
      }

      setSlotsLoading(true);
      setSlotMessage('');

      try {
        const response = await axios.get('/api/bookings/availability', {
          params: {
            date: form.date,
            service: form.service,
          },
        });

        if (!isMounted) {
          return;
        }

        const slots = response.data.availableSlots || [];
        setAvailableSlots(slots);
        setForm((current) => {
          const nextTime = slots.includes(current.time) ? current.time : slots[0] || '';

          if (current.time === nextTime) {
            return current;
          }

          return { ...current, time: nextTime };
        });

        if (response.data.isDateBlocked) {
          setSlotMessage('That date is blocked by the clinic.');
          return;
        }

        if (slots.length === 0) {
          setSlotMessage('No available time slots remain for that date.');
          return;
        }

        setSlotMessage(`Showing ${slots.length} available start times for this walk-in entry.`);
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setAvailableSlots([]);
        setForm((current) => (current.time ? { ...current, time: '' } : current));
        setSlotMessage(
          requestError.response?.data?.error || 'Unable to load time slots right now.'
        );
      } finally {
        if (isMounted) {
          setSlotsLoading(false);
        }
      }
    };

    loadAvailability();

    return () => {
      isMounted = false;
    };
  }, [form.date, form.service]);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('/api/admin/walk-in', form);
      const serialNumber = response.data.appointment?.serialNumber;

      setMessageType('success');
      setMessage(
        serialNumber
          ? `Walk-in appointment created as approved booking #${serialNumber}.`
          : 'Walk-in appointment created and approved.'
      );
      setForm({
        number: '',
        lastName: '',
        firstName: '',
        middleInitial: '',
        service: '',
        notes: '',
        email: '',
        date: today,
        time: '',
      });
      setAvailableSlots([]);
      setSlotMessage('Select a service and date to view open times.');
    } catch (requestError) {
      setMessageType('error');
      setMessage(requestError.response?.data?.error || 'Creation failed.');
    } finally {
      setLoading(false);
    }
  };

  const roundedDuration = form.service ? getRoundedServiceDuration(form.service) : null;

  return (
    <AdminPageShell
      title="Walk-in Booking"
      description="Create a same-system appointment for a walk-in patient, including the date, the start time, and the 15-minute slot-based service duration."
      icon={UserPlus}
      maxWidth="max-w-3xl"
    >
      <div className="rounded-[28px] bg-white p-8 shadow-xl">
        {message ? (
          <p
            className={`mb-4 rounded-2xl p-3 text-sm ${
              messageType === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="number"
            placeholder="Phone Number *"
            value={form.number}
            onChange={handleChange}
            required
            className="w-full rounded-xl border p-3"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="lastName"
              placeholder="Last Name *"
              value={form.lastName}
              onChange={handleChange}
              required
              className="rounded-xl border p-3"
            />
            <input
              name="firstName"
              placeholder="First Name *"
              value={form.firstName}
              onChange={handleChange}
              required
              className="rounded-xl border p-3"
            />
          </div>
          <input
            name="middleInitial"
            placeholder="Middle Initial"
            value={form.middleInitial}
            onChange={handleChange}
            className="w-full rounded-xl border p-3"
          />
          <select
            name="service"
            value={form.service}
            onChange={handleChange}
            required
            className="w-full rounded-xl border bg-white p-3"
          >
            <option value="">Service</option>
            {SERVICES.map((service) => (
              <option key={service} value={service}>
                {formatServiceLabel(service)}
              </option>
            ))}
          </select>
          {roundedDuration ? (
            <p className="text-sm text-police">Scheduled slot length: {roundedDuration} minutes.</p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="date"
              type="date"
              min={today}
              value={form.date}
              onChange={handleChange}
              required
              className="rounded-xl border p-3"
            />
            <select
              name="time"
              value={form.time}
              onChange={handleChange}
              required
              disabled={!form.service || !form.date || slotsLoading || availableSlots.length === 0}
              className="rounded-xl border bg-white p-3 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">{slotsLoading ? 'Loading times...' : 'Select time'}</option>
              {availableSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {formatTimeLabel(slot)}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-mist bg-pearl p-4 text-sm text-police">
            {slotMessage}
          </div>
          <input
            name="email"
            placeholder="Email (optional)"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-xl border p-3"
          />
          <textarea
            name="notes"
            placeholder="Admin notes..."
            value={form.notes}
            onChange={handleChange}
            className="w-full rounded-xl border p-3"
          />
          <button
            type="submit"
            disabled={loading || slotsLoading || !form.time}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-silver-lake py-3 font-semibold text-white transition hover:bg-wild-blue disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle className="h-5 w-5" />
            )}
            {loading ? 'Creating...' : 'Create & Approve Walk-in'}
          </button>
        </form>
      </div>
    </AdminPageShell>
  );
}

export default WalkIn;
