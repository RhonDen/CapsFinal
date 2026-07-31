# Implementation Plan - Admin Panel Overhaul

## Server-Side Changes (COMPLETED ✓)

### 1. Appointment Model - Add rejectionReason field
- [x] `server/models/Appointment.js` - Add `rejectionReason` column (TEXT, allowNull: true)

### 2. Admin Routes - Rejection reason support
- [x] `server/routes/admin.js` - Accept optional `rejectionReason` in status update PATCH
- [x] `server/routes/admin.js` - Include rejection reason in SMS when rejecting

### 3. Contact Routes - Unread count endpoint
- [x] `server/routes/contact.js` - Add GET `/messages/unread-count` endpoint

## Client-Side Changes

### 4. Clients Page - Filters, pagination, improved search
- [x] `client/src/pages/admin/Clients.jsx` - Overhaul: add phone filter, pagination, improved search UX

### 5. History Page - Add pagination
- [x] `client/src/pages/admin/History.jsx` - Add pagination controls (ITEMS_PER_PAGE, currentPage state)

### 6. Dashboard - Fix responsive layout + rejection reason modal
- [x] `client/src/pages/admin/AdminDashboard.jsx` - Add rejection reason modal with textarea
- [x] `client/src/pages/admin/AdminDashboard.jsx` - Reject button opens modal, sends reason with rejection
- [x] `client/src/pages/admin/AdminDashboard.jsx` - Stats grid uses 2xl:grid-cols-5 for responsive layout

### 7. Analytics - Major overhaul
- [ ] `client/src/pages/admin/DataAnalysis.jsx` - Reorder sections (predictive & comparison on top, after basic charts)
- [ ] `client/src/pages/admin/DataAnalysis.jsx` - Show percentages inside pie chart + hover info
- [ ] `client/src/pages/admin/DataAnalysis.jsx` - Add labels/descriptions for each graph
- [ ] `client/src/pages/admin/DataAnalysis.jsx` - Improve visual appeal with numbers

### 8. Inbox - Real-time polling + unread highlights
- [x] `client/src/pages/admin/Inbox.jsx` - Add polling, highlight unread, unread count

### 9. Navbar - Unread message badge
- [x] `client/src/components/Navbar.jsx` - Add unread count notification badge
