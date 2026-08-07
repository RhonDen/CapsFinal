# Logistic Regression Integration — Task Tracker

## Goal
Add and integrate a logistic regression model into the admin's analytics that predicts **probability of appointment completion** (not a hard class), replacing the raw-count "predictive" approach with a real statistical model.

## Steps

- [x] 1. Create `server/utils/logisticRegression.js` — self-contained logistic regression (gradient descent, L2 regularization, feature standardization, binary cross-entropy). Returns probabilities, coefficients, and metrics.
- [x] 2. Update `server/routes/admin.js` — train the logistic regression in the `/analytics` handler and add a `logisticRegression` field to the response.
- [x] 3. Update `client/src/pages/admin/DataAnalysis.jsx` — add a "Logistic Regression — Completion Probability" section rendering overall probability, per-service probabilities, feature importance, and model metrics.
- [x] 4. Update `client/src/pages/admin/analytics-methodology.md` — document the logistic regression methodology.
- [x] 5. Test: verify `/api/admin/analytics` returns `logisticRegression` and the new UI section renders.
