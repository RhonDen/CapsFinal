# TODO

## Analytics fixes
- [x] Fix UniSMS OTP phone validation acceptance (request-otp) to reduce “invalid lije” confusion.
- [x] Implement strict PH +63 normalization and sender_id retries in `server/utils/sendSMS.js`.
- [x] Fix weekly/monthly analytics “Appointments by Day” bucket grouping so weekly has exactly 7 weekday buckets and monthly has days for the selected month (`server/routes/admin.js` `/api/admin/analytics`).
- [x] Add analytics fields to `/api/admin/analytics`: `peakHours` and `predictivePie` for `type=predictive` (`server/routes/admin.js`).
- [ ] Update frontend analytics page to show Predictive (Next Month) + Peak Hours (`client/src/pages/admin/DataAnalysis.jsx`).
- [ ] Manual verification via:
  - [ ] `curl` for `type=daily|weekly|monthly|predictive`
  - [ ] Switch tabs in admin analytics UI and verify charts render

## Dev reliability (local)
- [ ] Ensure `npm run dev` works reliably without missing binaries / port conflicts.
