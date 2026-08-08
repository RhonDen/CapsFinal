# Analytics Methodology

This document explains how the analytics dashboard calculates each section.

## Descriptive Analytics

- Counts the appointments that fall within the selected range.
- Uses actual appointment records from the database.
- Breakdowns are based on:
  - service type
  - day of month / week / year
  - appointment status
  - peak hour

## Diagnostic Analytics

- Builds a day-of-week distribution for the selected date range.
- Also computes a service-vs-day correlation to show which services are most common on which weekdays.
- These are based on real appointment timestamps and are intended to help staffing and scheduling decisions.

## Predictive Analytics

- Only available for monthly analysis.
- It uses the selected month as the reference period and looks at recent appointment counts from up to the previous three months.
- The forecast is a conservative rolling average rather than exponential or compounded growth.
- This avoids unrealistic projections like very large client counts caused by unstable growth formulas.

### How the forecast is computed

1. Collect appointment counts for the previous months in the dataset.
2. Include the current selected month count.
3. Use the average of the most recent three months of data.
4. Project next-month demand from that average.

## Prescriptive Analytics

- Provides suggested actions based on low-volume and high-volume days.
- Uses the same appointment counts and day-of-week breakdowns.
- This is a qualitative guidance layer, not a precise operational plan.

## Logistic Regression — Completion Probability

The analytics dashboard now includes a **logistic regression model** that predicts the **probability of appointment completion** (a continuous 0–1 score), not a hard class label. This replaces the raw-count "predictive" approach with a real statistical model.

> **Date range scoping:** the model is trained **only on finalized (non-pending) appointments within the selected date range** — so it respects the Daily/Weekly/Monthly/Yearly/Predictive filter just like every other analytics section. If fewer than 10 finalized appointments fall within the selected range, it gracefully reports `trained: false` instead of producing unreliable results.

### What it predicts

- **Target:** `P(completed = 1)` — the probability that a finalized appointment is completed.
- **Output:** a continuous probability (0–100%) per appointment, per service, and per day of week.
- **Not a classifier:** the model does not output a binary "will happen / won't happen" label. It gives the admin a risk/confidence score.

### Features used

Each finalized appointment is encoded into a feature vector:

- `isWalkIn` (0/1)
- `hourOfDay` (0–23, from the appointment time)
- `dayOfWeek` (0–6, Sunday = 0)
- `month` (0–11)
- `durationMinutes`
- One-hot encoded `service` (top 8 services by volume + "Other")

### Training

- **Algorithm:** gradient descent with L2 regularization.
- **Loss:** binary cross-entropy.
- **Preprocessing:** features are standardized (z-score) to zero mean / unit variance.
- **Hyperparameters:** learning rate 0.1, L2 lambda 0.01, 200 epochs.
- **Minimum data:** at least 10 finalized (non-pending) appointments are required. If fewer are available, the model returns `trained: false` with a reason.

### Outputs

- `overallProbability` — average modeled completion probability across all finalized appointments.
- `serviceProbabilities` — per-service completion probability, with completed/total counts.
- `dowProbabilities` — per-day-of-week completion probability, with completed/total counts.
- `featureImportance` — standardized model coefficients, sorted by absolute magnitude. Larger magnitude = stronger influence on completion.
- `metrics` — in-sample accuracy, precision, recall, F1, and AUC (rank-based approximation).

### Caveats

- Metrics are computed on the training set (in-sample) and are indicative of model fit, not out-of-sample generalization.
- The model is retrained on every analytics request using the current finalized appointment data.
- With small datasets, probabilities may be noisy; the model degrades gracefully when data is insufficient.
