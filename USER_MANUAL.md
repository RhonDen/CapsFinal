# Dents-City Appointment System — User Manual

This manual covers how to use the Dents-City dental clinic appointment system. It has two main areas:

1. **Public Booking Portal** — for patients to book, view, and cancel appointments online.
2. **Admin Panel** — for clinic staff to manage appointments, clients, messages, and analytics.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Part 1: Patient (Public) Portal](#part-1-patient-public-portal)
  - [Booking a New Appointment](#booking-a-new-appointment)
  - [Viewing History & Cancelling](#viewing-history--cancelling)
- [Part 2: Admin Panel](#part-2-admin-panel)
  - [Logging In](#logging-in)
  - [Dashboard Overview](#dashboard-overview)
  - [Managing Pending Requests](#managing-pending-requests)
  - [Marking Appointment Outcomes](#marking-appointment-outcomes)
  - [Creating a Walk-in](#creating-a-walk-in)
  - [Blocking Dates](#blocking-dates)
  - [Managing Clients](#managing-clients)
  - [Inbox (Patient Messages)](#inbox-patient-messages)
  - [Appointment History](#appointment-history)
  - [Data Analysis / Analytics](#data-analysis--analytics)
- [Appointment Statuses Explained](#appointment-statuses-explained)

---

## Getting Started

- **Public site:** Home page → "Book Appointment" or the Appointment Portal link.
- **Admin panel:** Visit the `/admin/login` URL (e.g., `https://your-site.com/admin/login`).

### Default Admin Credentials

| Field    | Value      |
| -------- | ---------- |
| Username | `admin`    |
| Password | `admin123` |

> **Important:** Change these credentials before using the system in production.

---

## Part 1: Patient (Public) Portal

The public portal lets patients manage their own appointments securely using SMS (OTP) verification.

### Booking a New Appointment

1. Go to the **Appointment Portal** and click **"Appoint Schedule"** (or "Book a Dental Appointment").
2. Fill in the form:
   - **Phone Number** — Enter your 10-digit mobile number (the `+63` prefix is added automatically).
   - **Last Name / First Name** — Required patient details.
   - **Middle Initial** — Optional.
   - **Dental Service** — Choose the service you need.
   - **Preferred Date** — Pick an available date (past dates are blocked).
   - **Preferred Time** — Select an open time slot (9:00 AM – 5:00 PM).
   - **Email** — Optional.
3. Click **"Send Secure OTP"**.
4. Enter the 6-digit code sent to your phone and click **"Confirm Booking"**.
5. Your request is now **pending** and waiting for admin approval. You'll receive a request/serial number.

> **Note:** If the clinic blocks your requested date, your booking may be rejected during admin review.

### Viewing History & Cancelling

1. From the Appointment Portal, click **"Check history / Cancel"**.
2. Enter your mobile number and click **"Send OTP"**.
3. Enter the OTP sent to your phone and click **"View History"**.
4. You'll see your appointment timeline grouped by date, with summary cards (Total visits, Approved, Completed, Pending).
5. To cancel a **pending or approved** appointment, click **"Cancel this Appointment"** and confirm.

---

## Part 2: Admin Panel

### Logging In

1. Go to `/admin/login`.
2. Enter your admin username and password.
3. Click **Login**.

> The admin session stays active for a long time. The dashboard also runs a keep-alive ping so it doesn't log you out when idle. If a transient network error occurs, it retries before ever redirecting you to login.

### Dashboard Overview

The dashboard is the "Clinic Command Center" and shows:

- **Stats cards:** Pending Requests, Approved Today, Rejected Today, Completed Today, Not Completed Today.
- **Quick actions:** Shortcuts to Block Dates, Clients, Inbox, Walk-in, Analytics, and History.
- **Pending requests:** New online bookings awaiting approval/rejection.
- **Pending outcome:** Walk-in appointments that passed their scheduled time but haven't been marked completed/not completed yet.
- **Today's schedule:** All of today's appointments.
- **Upcoming appointments:** The next closest approved schedules.

### Managing Pending Requests

When a patient books online, it appears under **"Pending requests"**.

- Click **Approve** to accept the booking — the patient is notified.
- Click **Reject** to decline it. You **must** provide a reason, which is included in the SMS sent to the patient.

### Marking Appointment Outcomes

- **Walk-ins** that pass their scheduled time appear in **"Pending outcome"**. They stay there until you mark them:
  - **Completed** — the patient showed up.
  - **Not Completed** — the patient did not show up.
- For **online** (approved) bookings that the patient never showed up for, the system **automatically marks them as "Not Completed"** after their scheduled time passes. Walk-ins are **never** auto-marked — they remain visible until you manually set the outcome.

> **Note on the fix:** Walk-in appointments no longer disappear from the dashboard. They remain in "Pending Outcome" until manually resolved.

### Creating a Walk-in

1. Go to **Walk-in** from the dashboard quick actions.
2. Fill in the patient's details (phone, name, service, date, time, optional email/notes).
3. Click **"Create & Approve Walk-in"**.

The walk-in is immediately approved and added to the schedule, and it will appear in "Pending Outcome" once its time passes.

### Blocking Dates

Use this to reserve full dates when the clinic is unavailable.

1. Go to **Block Dates**.
2. Pick a date and optionally add a reason.
3. Click **Add**.

The date is now blocked — patients and walk-ins cannot be scheduled on it. You can remove a blocked date anytime using the trash icon.

### Managing Clients

1. Go to **Clients**.
2. Search by **patient name** or filter by **phone number**.
3. The table shows each client's name, phone, and last appointment.

### Inbox (Patient Messages)

Patient inquiries from the website contact form appear here.

1. Go to **Inbox**.
2. Unread messages are highlighted with a blue dot and counted in the "unread" badge.
3. Click a message to read it — it's automatically marked as read.
4. Use the search box to filter messages by name, email, or content.

### Appointment History

1. Go to **History**.
2. Use the filters to narrow results:
   - **From / To** date range.
   - **Status** (All, Pending, Approved, Rejected, Completed, Not Completed, Cancelled).
   - **Phone** number.
   - **Search** by name or number.
3. Click **Search** to apply filters.
4. Results show date, time, patient, phone, service, and status.

### Data Analysis / Analytics

The **Analytics** page provides insights into clinic performance, including:

- Appointment pie/line/bar charts and peak hours.
- Day-of-week breakdown and service trends.
- Forecasts and recommendations.
- Walk-in vs. online booking comparison.

---

## Appointment Statuses Explained

| Status         | Meaning                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| **Pending**    | Online booking submitted, waiting for admin approval.                   |
| **Approved**   | Admin accepted the booking.                                             |
| **Rejected**   | Admin declined the booking (reason is sent to the patient).             |
| **Completed**  | The patient showed up and the appointment was finished.                 |
| **Not Completed** | The patient did not show up (auto-marked for online no-shows; manually set for walk-ins). |
| **Cancelled**  | The appointment was cancelled (by the patient or admin).                |

---

## Tips & Troubleshooting

- **Bookings "disappear" from Pending Outcome?** This was a bug — walk-ins now always stay visible until manually marked completed/not completed. Online no-shows are auto-marked as Not Completed.
- **Logged out while idle?** The system now keeps the session alive with a heartbeat and retries transient errors, so you shouldn't be logged out unexpectedly.
- **Didn't receive an OTP?** Double-check your phone number format (10 digits after `+63`). Make sure your phone has signal/reception.
- **Need to unblock a date?** Go to Block Dates and delete the blocked date.
