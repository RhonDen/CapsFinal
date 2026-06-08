// Shared types for frontend

export interface BookingFormData {
  number: string;
  lastName: string;
  firstName: string;
  middleInitial?: string;
  service: string;
  email?: string;
  date: string; // appointment date (YYYY-MM-DD)
  time: string;
}

export interface Appointment {
  _id: string;
  serialNumber?: number;
  number: string;
  lastName: string;
  firstName: string;
  middleInitial?: string;
  fullName?: string;
  service: string;
  email?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'notCompleted';
  statusLabel?: string;
  date?: string;
  dateKey?: string;
  time?: string;
  durationMinutes?: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  notes?: string;
  isWalkIn: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  canMarkOutcome?: boolean;
  createdAt: string;
}

export interface Stats {
  pendingRequests: number;
  approvedToday: number;
  rejectedToday: number;
  completedToday: number;
  notCompletedToday: number;
}

export interface BlockedDateItem {
  _id: string;
  date: string;
  dateKey?: string;
  reason: string;
}

export interface ClientItem {
  number: string;
  lastAppointment: string;
}

export interface PieDataItem {
  name: string;
  value: number;
}

export interface LineDataItem {
  day: number;
  count: number;
}

export interface BarDataItem {
  status: string;
  statusLabel?: string;
  count: number;
}

export interface AnalyticsResponse {
  pie: PieDataItem[];
  line: LineDataItem[];
  bar: BarDataItem[];
}
