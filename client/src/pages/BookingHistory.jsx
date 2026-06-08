import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Loader2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDateKey,
  formatServiceLabel,
  formatStatusLabel,
  formatTimeLabel,
  getStatusTone,
} from '../utils/schedule.js';

function BookingHistory() {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async (event) => {
    event.preventDefault();
    if (!phone.trim()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/bookings/history/request-otp', { number: phone });
      setStep(2);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    if (!otp.trim()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/bookings/history/verify-otp', {
        number: phone,
        otp,
      });
      setAppointments(response.data.appointments);
      setStep(1);
      setOtp('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const returnToPhoneLookup = () => {
    setError('');
    setOtp('');
    setStep(1);
  };

  return (
    <div className="relative mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-white/70 bg-white/92 p-8 shadow-[0_24px_60px_-32px_rgba(12,36,61,0.38)] backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(230,239,246,0.9),rgba(215,238,233,0))]" />
      <div className="relative">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/booking"
            className="inline-flex items-center gap-2 rounded-full border border-mist bg-pearl px-4 py-2 text-sm font-medium text-police transition hover:border-silver-lake hover:text-maastricht"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-sm font-semibold text-police">
            <ShieldCheck className="h-4 w-4 text-glacier" />
            Records Protected by OTP
          </div>
        </div>

        <h2 className="mb-2 text-3xl font-semibold text-maastricht">
          Dental Appointment History
        </h2>
        <p className="mb-6 text-sm leading-7 text-police md:text-base">
          Use the same phone number from your booking to receive a one-time code
          and securely view all verified appointments, including rejected,
          approved, completed, and not completed records.
        </p>

        <div className="mb-6 flex gap-3">
          <div
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              step === 1 ? 'bg-maastricht text-white' : 'bg-mist text-police'
            }`}
          >
            1. Phone
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

        <div key={step} className="animate-panel-in">
          {step === 1 ? (
            <form
              onSubmit={requestOtp}
              className="mb-6 flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="tel"
                placeholder="Enter phone number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                className="flex-1 rounded-2xl border border-gray-200 bg-white p-3 focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-maastricht px-5 py-3 text-white transition hover:-translate-y-0.5 hover:bg-police disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Smartphone className="h-5 w-5" />
                )}
                Send OTP
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="mb-6 space-y-4">
              <p className="text-sm leading-7 text-police">
                Enter the OTP sent to <strong>{phone}</strong> to open your
                dental appointment history.
              </p>
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                required
                className="w-full rounded-2xl border-2 border-gray-200 p-4 text-center text-xl tracking-[0.35em] focus:border-silver-lake focus:outline-none focus:ring-4 focus:ring-silver-lake/15"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={returnToPhoneLookup}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-mist bg-pearl px-4 py-3 font-semibold text-police transition hover:border-silver-lake hover:text-maastricht"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Phone
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-maastricht py-3 text-white transition hover:-translate-y-0.5 hover:bg-police disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                  {loading ? 'Verifying...' : 'View History'}
                </button>
              </div>
            </form>
          )}
        </div>

        {appointments.length > 0 ? (
          <ul className="space-y-3">
            {appointments.map((appointment) => (
              <li
                key={appointment._id}
                className="flex items-start gap-4 rounded-2xl border border-mist bg-pearl p-4 shadow-sm"
              >
                <div className="rounded-2xl bg-seafoam p-3 text-maastricht">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-maastricht">
                        {formatServiceLabel(appointment.service)}
                      </p>
                      <p className="text-sm text-silver-lake">
                        Booking #{appointment.serialNumber || 'N/A'}
                      </p>
                    </div>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(
                        appointment.status
                      )}`}
                    >
                      {formatStatusLabel(appointment.status)}
                    </span>
                  </div>

                  <p className="text-sm text-police">
                    {formatDateKey(appointment.dateKey, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-police">
                    {appointment.time ? formatTimeLabel(appointment.time) : 'No time recorded'}
                  </p>
                  {appointment.isWalkIn ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-silver-lake">
                      Walk-in
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export default BookingHistory;
