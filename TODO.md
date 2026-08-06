# TODO: Limit Fake History to May Only + No Popup Bookings

- [x] Edit `server/seed_fake_history_contacts.js` — change date window to May-only (May 1–May 31, capped at yesterday)
- [x] Re-run the seed script (purges old `[FAKE]` rows, seeds May-only data)
- [x] Verify database shows only May fake appointments with no future dates
- [ ] Commit and push changes
