const SLOT_INTERVAL_MINUTES = 15;
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 17;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const pad = (value) => value.toString().padStart(2, '0');

const minutesToTime = (totalMinutes) =>
  `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;

const timeToMinutes = (time) => {
  if (!TIME_PATTERN.test(time)) {
    return null;
  }

  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const dateKeyFromDateValue = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  if (typeof dateValue === 'string' && DATE_KEY_PATTERN.test(dateValue)) {
    return dateValue;
  }

  const parsedDate = dateValue instanceof Date ? dateValue : new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
};

const normalizeDateOnly = (dateValue) => {
  const dateKey = dateKeyFromDateValue(dateValue);

  if (!dateKey) {
    return null;
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const buildDateTime = (dateValue, time) => {
  const dateKey = dateKeyFromDateValue(dateValue);
  const minutes = timeToMinutes(time);

  if (!dateKey || minutes === null) {
    return null;
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const date = new Date(year, month - 1, day, hours, remainingMinutes, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== remainingMinutes
  ) {
    return null;
  }

  return date;
};

const parseServiceDuration = (service) => {
  const match = typeof service === 'string' ? service.match(/(\d+)\s*min/i) : null;

  if (!match) {
    return SLOT_INTERVAL_MINUTES;
  }

  return Number.parseInt(match[1], 10);
};

const roundDurationToSlot = (minutes) =>
  Math.ceil(Math.max(minutes, SLOT_INTERVAL_MINUTES) / SLOT_INTERVAL_MINUTES) *
  SLOT_INTERVAL_MINUTES;

const getRoundedServiceDuration = (service) =>
  roundDurationToSlot(parseServiceDuration(service));

const isValidBusinessTime = (time) => {
  const minutes = timeToMinutes(time);

  if (minutes === null) {
    return false;
  }

  const businessStartMinutes = BUSINESS_START_HOUR * 60;
  const businessEndMinutes = BUSINESS_END_HOUR * 60;

  return (
    minutes >= businessStartMinutes &&
    minutes < businessEndMinutes &&
    minutes % SLOT_INTERVAL_MINUTES === 0
  );
};

const buildSchedule = ({ dateValue, time, service }) => {
  const dateKey = dateKeyFromDateValue(dateValue);

  if (!dateKey || !isValidBusinessTime(time)) {
    return null;
  }

  const durationMinutes = getRoundedServiceDuration(service);
  const scheduledStart = buildDateTime(dateKey, time);

  if (!scheduledStart) {
    return null;
  }

  const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);
  const businessStart = buildDateTime(dateKey, `${pad(BUSINESS_START_HOUR)}:00`);
  const businessEnd = buildDateTime(dateKey, `${pad(BUSINESS_END_HOUR)}:00`);

  if (!businessStart || !businessEnd) {
    return null;
  }

  if (scheduledStart < businessStart || scheduledEnd > businessEnd) {
    return null;
  }

  return {
    date: normalizeDateOnly(dateKey),
    dateKey,
    time,
    durationMinutes,
    scheduledStart,
    scheduledEnd,
  };
};

const generateTimeSlots = (service) => {
  const durationMinutes = getRoundedServiceDuration(service);
  const startMinutes = BUSINESS_START_HOUR * 60;
  const endMinutes = BUSINESS_END_HOUR * 60 - durationMinutes;
  const slots = [];

  for (
    let currentMinutes = startMinutes;
    currentMinutes <= endMinutes;
    currentMinutes += SLOT_INTERVAL_MINUTES
  ) {
    slots.push(minutesToTime(currentMinutes));
  }

  return slots;
};

const getAppointmentWindow = (appointment) => {
  const dateKey = appointment.dateKey || dateKeyFromDateValue(appointment.date);
  const time = appointment.time;

  if (!dateKey || !time) {
    return null;
  }

  const durationMinutes =
    appointment.durationMinutes || getRoundedServiceDuration(appointment.service);
  const scheduledStart = appointment.scheduledStart
    ? new Date(appointment.scheduledStart)
    : buildDateTime(dateKey, time);

  if (!scheduledStart || Number.isNaN(scheduledStart.getTime())) {
    return null;
  }

  const scheduledEnd = appointment.scheduledEnd
    ? new Date(appointment.scheduledEnd)
    : new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);

  return {
    dateKey,
    time,
    durationMinutes,
    scheduledStart,
    scheduledEnd,
  };
};

const windowsOverlap = (firstWindow, secondWindow) =>
  firstWindow.scheduledStart < secondWindow.scheduledEnd &&
  secondWindow.scheduledStart < firstWindow.scheduledEnd;

const isBlockingStatus = (status) =>
  ['accepted', 'completed', 'notCompleted'].includes(status);

const getTodayDateKey = () => dateKeyFromDateValue(new Date());

module.exports = {
  SLOT_INTERVAL_MINUTES,
  BUSINESS_START_HOUR,
  BUSINESS_END_HOUR,
  dateKeyFromDateValue,
  normalizeDateOnly,
  buildDateTime,
  parseServiceDuration,
  roundDurationToSlot,
  getRoundedServiceDuration,
  isValidBusinessTime,
  buildSchedule,
  generateTimeSlots,
  getAppointmentWindow,
  windowsOverlap,
  isBlockingStatus,
  timeToMinutes,
  minutesToTime,
  getTodayDateKey,
};
