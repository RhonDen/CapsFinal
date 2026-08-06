# Task: Make Fake May History + Contacts Appear in Live App

## Steps
- [x] 1. Refactor `server/seed_fake_history_contacts.js` — extract seeding logic into exported `seedFakeHistoryContacts({ manageConnection, total, contactTotal })` function
- [x] 2. Update `server/server.js` — call `seedFakeHistoryContacts({ manageConnection: false })` on startup after parkDemoSeed
- [x] 3. Remove `accepted` statuses from `parkDemoSeed.js` to prevent popup appointments
- [x] 4. Commit & push to trigger re-deploy
- [ ] 5. Verify May data appears in Data Analysis / History / Clients, contacts in Inbox
