# CAPSPROJ — Dental Appointment System (React + Express)

This guide explains how the system works end-to-end: patient booking + OTP, appointment history retrieval + OTP, and the admin workspace with approvals + analytics.

---

## 1) High-level features

### Client (Patient Portal)
1. **Book Appointment**
   - Patient fills a booking form (service, date, time, personal details).
   - System sends a **6-digit OTP** to the patient phone using **UniSMS**.
   - Patient enters the OTP to submit the appointment request.
2. **Booking History**
   - Patient enters phone number.
   - System sends a **history OTP** to the same phone.
   - After OTP verification, the patient sees their appointment history (approved/rejected/completed/not completed).

### Admin Workspace
1. **Login**
   - Admin signs in with username + password.
   - Backend sets a secure JWT cookie.
2. **Dashboard**
   - Shows:
     - Pending requests
     - Today’s appointments segmented by status
   - Admin can approve/reject pending bookings.
   - When scheduled time starts, admin can mark **Completed** or **Not Completed**.
3. **Block Dates**
   - Admin can block dates and add a reason.
   - Booking form will show the blocked reason.
4. **Clients**
   - Admin can view unique client phone numbers that have pending bookings.
5. **Walk-in**
   - Admin creates an accepted booking for a walk-in client.
6. **Data Analysis**
   - Pie chart: most completed services
   - Line chart: appointment counts by day
   - Bar chart: distribution of statuses
   - Controls support daily/weekly/monthly and date selection.

---

## 2) Frontend routing (React)

- `GET /` → Landing page
- `GET /booking/*` → Booking portal router
  - `/booking/new` → booking form + OTP flow
  - `/booking/history` → booking history + OTP flow
- `GET /admin/login` → admin login
- `GET /admin/dashboard` → admin dashboard (protected)
- `GET /admin/block-dates` → blocked dates (protected)
- `GET /admin/clients` → clients list (protected)
- `GET /admin/walk-in` → walk-in booking (protected)
- `GET /admin/data-analysis` → analytics (protected)

Protected routes use `client/src/components/ProtectedRoute.jsx` (JWT cookie auth).

---

## 3) Backend API routing (Express)

Server is in: `capsproj/server/`

### Patient booking endpoints
- `POST /api/bookings/request-otp`
  - Validates booking details
  - Checks blocked dates
  - Checks conflicts (no double booking)
  - Creates an appointment with:
    - hashed OTP (bcrypt)
    - OTP expiry
    - status = `pending`
  - Sends OTP using UniSMS
- `POST /api/bookings/verify-otp`
  - Validates OTP
  - Clears otp fields
  - Marks request as verified (appointment status remains `pending`)
  - Sends an SMS that the request is waiting for admin approval
- `POST /api/bookings/history/request-otp`
  - Generates history OTP for the latest matching appointment for that phone
- `POST /api/bookings/history/verify-otp`
  - Verifies history OTP
  - Returns appointments where the booking is verified (otp field is already null)

### Admin endpoints
- `POST /api/admin/login`
  - Validates username + password
  - Sets cookie: `admin_token`
- `POST /api/admin/logout`
  - Clears cookie
- `GET /api/admin/check-auth`
  - Returns authentication state
- `GET /api/admin/dashboard`
  - Returns:
    - pending requests
    - today appointments by status
- `PATCH /api/admin/appointments/:id/status`
  - Updates status:
    - `accepted`, `rejected`, `completed`, `notCompleted`
  - Enforces timing rules for `completed` / `notCompleted`
- `GET /api/admin/blocked-dates`
- `POST /api/admin/block-dates`
- `DELETE /api/admin/block-dates/:id`
- `GET /api/admin/clients`
- `POST /api/admin/walk-in`
- `GET /api/admin/analytics`
  - Query params:
    - `type` = daily | weekly | monthly (default monthly)
    - `date` (for daily/weekly)
    - `month` and `year` (for monthly)

---

## 4) UniSMS OTP integration

UniSMS sender is configured in:
- `capsproj/server/utils/sendSMS.js`

### Required environment variables
- `UNI_SMS_API_KEY`
- `UNI_SMS_SENDER_ID`

### OTP behavior
- Booking OTP:
  - random 6-digit code
  - stored hashed in MongoDB (bcrypt)
  - OTP expires in ~5 minutes
- History OTP:
  - similar mechanism
  - tied to the latest appointment request record for that number

---

## 5) Scheduling and anti double-booking

Scheduling is implemented in:
- `capsproj/server/utils/schedule.js`

### Slot model
- Base slot interval: **15 minutes**
- Business hours: 9:00 to 17:00

### Conflict prevention
- When booking is requested:
  - server checks existing appointments with statuses that should block time
  - overlap detection prevents double booking

---

## 6) Analytics implementation

Analytics is server-side:
- `capsproj/server/routes/admin.js` → `GET /api/admin/analytics`

It returns data shaped for the frontend charts:
- `pie`: completed services breakdown
- `line`: appointment counts by time unit
- `bar`: status distribution

Charts are rendered using `recharts` in:
- `capsproj/client/src/pages/admin/DataAnalysis.jsx`

---

## 7) Admin login placement

Admin login page is:
- `capsproj/client/src/pages/AdminLogin.jsx`

Admin navigation appears only when you are not already on admin login and the route begins with `/admin`.

To reach admin:
- go to `/admin/login`

Default seeded admin credentials are documented in `capsproj/README.md`.

---

## 8) Running the project

### Frontend
```bash
cd capsproj/client
npm install
npm run dev
```

### Backend
```bash
cd capsproj/server
npm install
npm run seed
npm run dev
```

---

## 9) Notes for deployment

1. Set environment variables:
   - DB connection settings (MongoDB)
   - `UNI_SMS_API_KEY`, `UNI_SMS_SENDER_ID`
   - `JWT_SECRET`
2. Ensure HTTPS in production so cookies with `secure: true` work correctly.

---

## 10) What to replace next

- Landing page hero Spline embed currently uses a placeholder Spline scene URL.
  - Replace `src` in `client/src/pages/LandingPage.jsx` with your actual Spline share link.

