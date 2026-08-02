# Task: Park Demo Seed Script for Fake April–May Appointments

## Steps

- [x] 1. Rewrite `server/seed_fake_analytics_data.js` with park demo mode (`SEED_PARK_MODE=true`)
      - Realistic Filipino names + real PH mobile prefixes (Globe/Smart/DITO)
      - ~90% walk-ins with `otp: null` (NO SMS/OTP ever fires)
      - Status mix heavy on completed/notCompleted/rejected
      - Default 70 total (range 50-75), backdated createdAt/updatedAt
      - Purges only `[FAKE]` rows so real bookings untouched
      - Legacy mode preserved unchanged
- [x] 2. Fix runtime bug: remove inner `connectDatabase`/`disconnectDatabase` shadowed import
- [x] 3. Fix syntax error: nested backticks in park-mode console.log
- [x] 4. Fix `serialNumber` unique-constraint collision — compute `serialBase` from Counter + max serial
- [x] 5. Execute local smoke test (SQLite) via reliable child-process wrapper
      - Result: 50 fake rows inserted, 49 walk-ins, 0 SMS/OTP sent
      - Status mix: 14 completed, 13 notCompleted, 11 rejected, 9 accepted, 3 pending
      - Filipino names + real PH prefixes verified, dates in Apr–May 2026
- [x] 6. Clean up temporary helper scripts and debug logs
- [ ] 7. Run production command against Neon/Postgres (user executes):
      **`cd d:/React-Projects/capsproj/server && set SEED_PARK_MODE=true&& set SEED_PARK_TOTAL=70&& node seed_fake_analytics_data.js`**
      (or in PowerShell: `$env:SEED_PARK_MODE='true'; $env:SEED_PARK_TOTAL='70'; node seed_fake_analytics_data.js`)
