# TODO

## Task: Fix walk-in appointment disappearing + auto-mark online no-shows

### Steps:
- [x] 1. Add auto-marking logic for overdue online appointments in the dashboard endpoint (server/routes/admin.js)
- [x] 2. Add `pendingOutcomeAppointments` query to the dashboard endpoint (server/routes/admin.js)
- [x] 3. Add background job in server.js to auto-mark overdue online appointments as notCompleted
- [x] 4. Add "Pending Outcome" section to AdminDashboard.jsx showing unmarked walk-in appointments
- [x] 5. Test the changes
