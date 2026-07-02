- [x] Read existing History UI and server admin routes structure.
- [x] Implement `GET /api/admin/history` in `server/routes/admin.js` with filters (from/to/status/phone).
- [x] Implement history UI grouping by date and status in `client/src/pages/admin/History.jsx`.
- [x] Improve History search to support name/number matching (client-side within fetched range).
- [x] Fix UniSMS `sender_id` failures by adding multi-candidate retry in `server/utils/sendSMS.js` (422 invalid sender_id => try next sender_id).
- [x] Run `node server/utils/sendSMS.test-runner.js` (passes).
- [x] Lock local dev ports to keep `npm run dev` from switching/using different ports (client and server).
- [x] Lock Vite client port via `strictPort: true`.
- [x] Make server port parsing strict and fail fast on EADDRINUSE.



