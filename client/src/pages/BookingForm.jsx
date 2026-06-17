import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock3,
  Loader2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SERVICES } from '../constants/services.js';
import BlockedDateBanner from '../components/admin/BlockedDateBanner.jsx';

import {

  formatServiceLabel,
  formatTimeLabel,
  getLocalDateKey,
  getRoundedServiceDuration,
} from '../utils/schedule.js';

function BookingForm() {
  const today = getLocalDateKey();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    number: '',
    lastName: '',
    firstName: '',
    middleInitial: '',
    service: '',
    email: '',
    date: today,
    time: '',
  });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotMessage, setSlotMessage] = useState('Select a service and date to see open times.');
  const [isDateBlocked, setIsDateBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');


  useEffect(() => {
    let isMounted = true;

    const loadAvailability = async () => {
      if (!form.service || !form.date) {
        setAvailableSlots([]);
        setIsDateBlocked(false);
        setBlockedReason('');
        setSlotMessage('Select a service and date to see open times.');

        setForm((current) => (current.time ? { ...current, time: '' } : current));
        return;
      }


      setSlotsLoading(true);
      setSlotMessage('');
      setIsDateBlocked(false);

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
        setIsDateBlocked(Boolean(response.data.isDateBlocked));
        setBlockedReason(response.data.reason || '');

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

        setSlotMessage(`Showing ${slots.length} available start times from 9:00 AM to 5:00 PM.`);
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setAvailableSlots([]);
        setIsDateBlocked(false);
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
    const { name, value } = event.target;

    if (name === 'number') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 11);
      setForm((current) => ({ ...current, number: digitsOnly }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  };

  const requestOtp = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Backend expects exactly 11 digits starting with 09 (regex: /^09\d{9}$/)
    // Remove any formatting (ex: dashes) before sending.
    const payload = {
      ...form,
      number: (form.number || '').toString().replace(/\D/g, '').slice(0, 11),
    };

    try {
      const response = await axios.post('/api/bookings/request-otp', payload);

      setSuccess(response.data.message);
      setStep(2);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        number: (form.number || '').toString().replace(/\D/g, '').slice(0, 11),
        otp,
      };

      const response = await axios.post('/api/bookings/verify-otp', payload);

      const serialText = response.data.serialNumber
        ? ` Request #${response.data.serialNumber} is now waiting for admin approval.`
        : ' Your request is now waiting for admin approval.';

      setSuccess(`Appointment request submitted successfully.${serialText}`);
      setForm({
        number: '',
        lastName: '',
        firstName: '',
        middleInitial: '',
        service: '',
        email: '',
        date: today,
        time: '',
      });
      setAvailableSlots([]);
      setSlotMessage('Select a service and date to see open times.');
      setOtp('');
      setStep(1);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const returnToFormDetails = () => {
    setError('');
    setSuccess('');
    setOtp('');
    setStep(1);
  };

  const roundedDuration = form.service ? getRoundedServiceDuration(form.service) : null;

  return (
    <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[28px] border border-white/70 bg-white/92 p-8 shadow-[0_24px_60px_-32px_rgba(12,36,61,0.38)] backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(215,238,233,0.75),rgba(230,239,246,0))]" />
      <div className="relative">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/booking"
            className="inline-flex items-center gap-2 rounded-full border border-mist bg-pearl px-4 py-2 text-sm font-medium text-police transition hover:border-silver-lake hover:text-maastricht"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full bg-seafoam px-4 py-2 text-sm font-semibold text-police">
            <ShieldCheck className="h-4 w-4 text-glacier" />
            Secure SMS Verification
          </div>
        </div>

        <h2 className="mb-2 text-3xl font-semibold text-maastricht">
          Book a Dental Appointment
        </h2>
        <p className="mb-6 max-w-2xl text-sm leading-7 text-police md:text-base">
          Choose a date, pick an available time between 9:00 AM and 5:00 PM,
          then confirm the request with OTP. Service lengths now follow
          15-minute scheduling blocks so the clinic calendar stays aligned.
        </p>

        <div className="mb-6 flex gap-3">
          <div
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              step === 1 ? 'bg-maastricht text-white' : 'bg-mist text-police'
            }`}
          >
            1. Details
          </div>
          <div
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              step === 2 ? 'bg-maastricht text-white' : 'bg-mist text-police'
            }`}
          >
            2. OTP
          </div>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-2xl bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        <div key={step} className="animate-panel-in">
          {step === 1 ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-maastricht">
                  Phone Number *
                </label>
                <input
                  name="number"
                  type="text"
                  placeholder="09175550123"
                  value={form.number}
                  onChange={handleChange}
                  required
                  inputMode="numeric"
                  maxLength={11}
                  pattern="[0-9]{11}"
                  onBlur={() => {
                    // Keep digits-only so backend regex /^09\d{9}$/ always matches.
                    const raw = (form.number || '').replace(/\D/g, '').slice(0, 11);
                    setForm((c) => ({ ...c, number: raw }));
                  }}

                  className="w-full rounded-2xl border border-gray-200 bg-white p-3 focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-maastricht">
                    Last Name *
                  </label>
                  <input
                    name="lastName"
                    placeholder="Dela Cruz"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-gray-200 bg-white p-3 focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-maastricht">
                    First Name *
                  </label>
                  <input
                    name="firstName"
                    placeholder="Juan"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-gray-200 bg-white p-3 focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-maastricht">
                  Middle Initial
                </label>
                <input
                  name="middleInitial"
                  maxLength={1}
                  placeholder="M"
                  value={form.middleInitial}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 bg-white p-3 focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-maastricht">
                  Dental Service *
                </label>
                <select
                  name="service"
                  value={form.service}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-gray-200 bg-white p-3 focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
                >
                  <option value="">-- Select dental service --</option>
                  {SERVICES.map((service) => (
                    <option key={service} value={service}>
                      {formatServiceLabel(service)}
                    </option>
                  ))}
                </select>
                {roundedDuration ? (
                  <p className="mt-2 text-xs text-police">
                    Scheduled slot length: {roundedDuration} minutes.
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-maastricht">
                    Preferred Date *
                  </label>
                  <input
                    name="date"
                    type="date"
                    min={today}
                    value={form.date}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-gray-200 bg-white p-3 focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-maastricht">
                    Preferred Time *
                  </label>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-lake" />
                    <select
                      name="time"
                      value={form.time}
                      onChange={handleChange}
                      required
                      disabled={slotsLoading || !form.service || !form.date || (availableSlots.length === 0 && !slotsLoading)}
                      className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-3 focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                    >
                      <option value="">
                        {!form.service || !form.date ? 'Select service and date first' : slotsLoading ? 'Loading times...' : availableSlots.length === 0 ? 'No times available' : 'Select a time'}
                      </option>
                      {availableSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {formatTimeLabel(slot)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {isDateBlocked ? (
                <BlockedDateBanner
                  reason={blockedReason}
                  dateLabel={form.date}
                />
              ) : (
                <div
                  className="rounded-2xl border border-mist bg-pearl p-4 text-sm text-police"
                >
                  {slotMessage}
                </div>
              )}


              <div>
                <label className="mb-1 block text-sm font-medium text-maastricht">
                  Email (optional)
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="juandelacruz@email.com"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 bg-white p-3 focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
                />
              </div>

              <button
                type="submit"
                disabled={loading || slotsLoading || !form.time}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-maastricht py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-police disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Smartphone className="h-5 w-5" />
                )}
                {loading ? 'Sending OTP...' : 'Send Secure OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <p className="text-sm leading-7 text-police">
                Enter the 6-digit code sent to <strong>{form.number}</strong> to
                submit your appointment request for{' '}
                <strong>{formatTimeLabel(form.time)}</strong>. The clinic will
                review and approve or reject it afterward.
              </p>
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                required
                className="w-full rounded-2xl border-2 border-gray-200 p-4 text-center text-2xl tracking-[0.45em] focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={returnToFormDetails}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-mist bg-pearl px-4 py-3 font-semibold text-police transition hover:border-silver-lake hover:text-maastricht"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Details
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-maastricht py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-police disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                  {loading ? 'Verifying...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookingForm;
