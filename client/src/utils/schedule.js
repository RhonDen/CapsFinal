const SLOT_INTERVAL_MINUTES = 15;

const pad = (value) => value.toString().padStart(2, '0');

export const getLocalDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatDateKey = (dateKey, options = {}) => {
  if (!dateKey) {
    return 'No date';
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);

  if (Number.isNaN(localDate.getTime())) {
    return dateKey;
  }

  return localDate.toLocaleDateString('en-US', options);
};

export const parseServiceDuration = (service) => {
  const match = typeof service === 'string' ? service.match(/(\d+)\s*min/i) : null;
  return match ? Number.parseInt(match[1], 10) : SLOT_INTERVAL_MINUTES;
};

export const roundDurationToSlot = (minutes) =>
  Math.ceil(Math.max(minutes, SLOT_INTERVAL_MINUTES) / SLOT_INTERVAL_MINUTES) *
  SLOT_INTERVAL_MINUTES;

export const getRoundedServiceDuration = (service) =>
  roundDurationToSlot(parseServiceDuration(service));

export const formatServiceLabel = (service) => {
  if (!service) {
    return '';
  }

  return service.replace(/(\d+)\s*min/i, `${getRoundedServiceDuration(service)} min`);
};

export const formatTimeLabel = (time) => {
  if (!time) {
    return 'No time';
  }

  const [hours, minutes] = time.split(':').map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  const displayHours = hours % 12 || 12;
  const suffix = hours >= 12 ? 'PM' : 'AM';

  return `${displayHours}:${pad(minutes)} ${suffix}`;
};

export const formatTimeFromDateValue = (dateValue) => {
  if (!dateValue) {
    return 'No time';
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'No time';
  }

  return parsedDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatStatusLabel = (status) => {
  if (status === 'accepted') {
    return 'Approved';
  }

  if (status === 'notCompleted') {
    return 'Not Completed';
  }

  if (!status) {
    return '';
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const getStatusTone = (status) => {
  if (status === 'pending') {
    return 'bg-amber-100 text-amber-800';
  }

  if (status === 'accepted') {
    return 'bg-sky-100 text-sky-800';
  }

  if (status === 'rejected') {
    return 'bg-rose-100 text-rose-700';
  }

  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'notCompleted') {
    return 'bg-slate-200 text-slate-700';
  }

  return 'bg-slate-100 text-slate-700';
};
