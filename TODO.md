# Analytics Enhancement Plan

## Phase 1 — Bug Fixes ✅
- [x] Fix line chart X-axis: change `dataKey="day"` to `dataKey="name"` in DataAnalysis.jsx
- [x] Fix weekday ordering in diagnostics (ensure Mon-Sun order)

## Phase 2 — Enhanced Backend Analytics (server/routes/admin.js) ✅
- [x] Add rejection analysis: rejected + notCompleted counts by service
- [x] Add status change timeline: pending → accepted → completed/notCompleted over time
- [x] Add service popularity trend: month-over-month service demand changes
- [x] Add walk-in vs online booking comparison data

## Phase 3 — Enhanced Frontend (client/src/pages/admin/DataAnalysis.jsx) ✅
- [x] Add Service × Day Heatmap visualization (colored grid replacing plain table)
- [x] Add Rejection Analysis section (which services get rejected/not-completed most)
- [x] ~~Add smarter Prescriptive Analytics with priority scoring~~ **REMOVED per user request**
- [x] Add Service Popularity Trend chart
- [x] Add Walk-in vs Online comparison chart
- [x] Add Status Timeline chart
