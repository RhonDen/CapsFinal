# Analytics Formulas

This document explains **the actual math** behind every analytics section, in plain language first, then the formula. It answers *"what equation did you use?"* — and makes sure anyone can understand what the equation is actually doing.

> **How to read this document:** each section follows the same pattern:
> 1. **What it does** — a one-line non-technical summary.
> 2. **The formula** — the actual math.
> 3. **What the symbols mean** — in plain English.
> 4. **What the result tells you** — how to use it for a decision.

---

## 1. Descriptive Analytics — "What happened?"

This section summarizes the raw appointments in the selected period. It answers the question: *"During this time window, what did the clinic actually do?"*

### 1.1 Service Distribution (Donut / Pie Chart)

**What it does:** Shows what share of all appointments each service took up.

**The formula:**

\[
\text{pct}_s = \frac{\text{count}(\text{service} = s)}{\sum_{t \in \text{services}} \text{count}(\text{service} = t)} \times 100
\]

**What the symbols mean:**
- `pct_s` — the percentage of appointments that belong to service `s` (e.g. "Teeth Cleaning").
- `count(service = s)` — the number of appointments where the service equals `s`.
- `Σ` (sigma) — "sum of"; the bottom line adds up the counts for **every** service, which gives the total number of appointments.

**What the result tells you:** Which services are most in demand. If "Whitening" is 40% of your appointments, that's your biggest revenue driver — keep plenty of slots open for it.

### 1.2 Status Distribution (Bar Chart)

**What it does:** Counts how many appointments ended in each status.

**The formula:**

\[
\text{count}_s = |\{ a \in \text{appointments} \mid a.\text{status} = s \}|
\]

**What the symbols mean:**
- `|{...}|` — "the number of items in this set" (i.e. a count).
- `a.status = s` — an appointment whose status equals `s`.
- `s` — one of: `pending`, `accepted`, `rejected`, `completed`, `notCompleted`, `cancelled`.

**What the result tells you:** How healthy your pipeline is. A high `notCompleted` number means many patients book but never show up — that's a reminder/confirmation opportunity.

### 1.3 Peak Hours

**What it does:** Counts appointments by the hour of day they're scheduled for.

**The formula:**

\[
\text{count}_h = |\{ a \in \text{appointments} \mid \text{hour}(a.\text{time}) = h \}|
\]

**What the symbols mean:**
- `h` — an hour from `0` (midnight) to `23` (11 PM).
- `hour(a.time)` — extracts just the hour from an appointment's time.

**What the result tells you:** When you're busiest. If 10 AM has the peak, make sure that's when you have the most staff.

### 1.4 Appointments by Day (Line Chart)

**What it does:** Shows volume over time, grouped by the selected period:
- **Daily** → a single "Total" bucket.
- **Weekly** → grouped by day name (`Mon`–`Sun`).
- **Monthly** → grouped by day-of-month (`1`–`31`).
- **Yearly** → grouped by month name (`Jan`–`Dec`).

**The formula:** A simple count of appointments in each bucket:

\[
\text{count}_k = |\{ a \in \text{appointments} \mid \text{groupKey}(a) = k \}|
\]

**What the result tells you:** The shape of your demand over time — is it steady, spiky, or trending?

---

## 2. Diagnostic Analytics — "Why did it happen?"

This section looks for **patterns** in the data to explain *why* volume looks the way it does.

### 2.1 Day-of-Week Breakdown

**What it does:** Counts appointments by which weekday they fall on.

**The formula:**

\[
\text{count}_d = |\{ a \in \text{appointments} \mid \text{dayOfWeek}(a) = d \}|
\]

**What the symbols mean:**
- `d` — a weekday from Monday (0) to Sunday (6).
- `dayOfWeek(a)` — the weekday of appointment `a`.

**What the result tells you:** Which days are consistently busy vs. quiet. This drives staffing decisions.

### 2.2 Service × Day Correlation

**What it does:** Counts appointments for each **combination** of service and weekday.

**The formula:**

\[
\text{count}_{s,d} = |\{ a \in \text{appointments} \mid a.\text{service} = s \ \text{and}\ \text{dayOfWeek}(a) = d \}|
\]

**What the symbols mean:**
- `s` — a service name.
- `d` — a weekday.
- `and` — both conditions must be true.

**What the result tells you:** Which services are most popular on which days (e.g. "Whitening" peaks on Saturdays). Use this to schedule specialty staff on the right days.

---

## 3. Predictive Analytics — "What might happen next?"

This section forecasts future volume. It deliberately uses a **conservative** method (a rolling average) so it doesn't produce unrealistic "skyrocketing" predictions.

### 3.1 Rolling Average Forecast (Monthly only)

**What it does:** Predicts next month's appointments by averaging the most recent months.

**The formula:**

\[
\text{projected}_{\text{next}} = \left\lfloor \frac{C_m + C_{m-1} + C_{m-2}}{3} \right\rfloor
\]

**What the symbols mean:**
- `C_m` — total appointments in the selected month.
- `C_{m-1}` — total in the month before it.
- `C_{m-2}` — total two months before it.
- `⌊⌋` — "floor": round **down** to the nearest whole number.
- If fewer than 3 months of history exist, the average is over what's available (minimum 1).

**What the result tells you:** A realistic estimate of next month's demand. If it's high, pre-book staff and slots; if low, consider a promotion. It's a guide, not a promise.

---

## 4. Logistic Regression — "How likely is an appointment to actually happen?"

This is the most advanced section. It's a **statistical model** that learns from your finalized appointments which factors make completion more or less likely. Crucially, it outputs a **probability (0–100%)**, not a hard "yes/no" — so it's well-suited to risk scoring, not just classification.

### 4.1 What the model predicts

**What it does:** For each appointment, estimate the probability that it will be **completed**.

**The formula:**

\[
P(y = 1 \mid \mathbf{x}) \in [0, 1], \quad y = \begin{cases} 1 & \text{if appointment is ``completed''} \\ 0 & \text{otherwise} \end{cases}
\]

**What the symbols mean:**
- `y = 1` — the appointment is completed.
- `y = 0` — it's not completed (rejected, cancelled, no-show).
- `P(y = 1 | x)` — the probability of completion **given** the appointment's features `x`.
- Output is always between `0` and `1` (i.e. 0% to 100%).

### 4.2 Date range scoping

The model is trained **only on finalized (non-pending) appointments within the selected date range** — the same range used for every other section. If fewer than 10 finalized appointments exist in that range, the model returns `trained: false` with a friendly message instead of unreliable numbers.

### 4.3 Feature encoding — what the model "looks at"

**What it does:** Converts each appointment into a row of numbers the model can learn from.

**The formula:**

\[
\mathbf{x} =
\begin{bmatrix}
x_{\text{walkIn}} & \text{1 if walk-in, else 0} \\
x_{\text{hour}} & \text{hour of day (0–23)} \\
x_{\text{dow}} & \text{day of week (0 = Sunday, 6 = Saturday)} \\
x_{\text{month}} & \text{month (0–11)} \\
x_{\text{duration}} & \text{duration in minutes} \\
\mathbf{s} & \text{one-hot encoded service (top 8 + "Other")}
\end{bmatrix}
\]

**What the symbols mean:**
- `x_walkIn` — is it a walk-in? (1 = yes, 0 = online).
- `x_hour`, `x_dow`, `x_month`, `x_duration` — time and length of the appointment.
- `s` — the service, encoded as a "one-hot" vector: a 1 in the position of that service, 0 everywhere else. The top 8 services by count get their own column; everything else is grouped as "Other".

### 4.4 Feature standardization

**What it does:** Puts every feature on the same scale so no single feature (like minutes) dominates the others just because its numbers are bigger.

**The formula:**

\[
\hat{x}_j = \frac{x_j - \mu_j}{\sigma_j}
\]

**What the symbols mean:**
- `x_j` — the raw value of feature `j`.
- `μ_j` (mu) — the average of that feature across all training appointments.
- `σ_j` (sigma) — the standard deviation (how spread out the values are).

**What it does:** After standardization, each feature has mean 0 and standard deviation 1, so the model treats them fairly.

### 4.5 The sigmoid function — the heart of the model

**What it does:** Takes any "score" and squashes it into a probability between 0 and 1.

**The formula:**

\[
h_\theta(\mathbf{x}) = \sigma(z) = \frac{1}{1 + e^{-z}}, \quad z = b + \sum_{j=1}^d w_j \hat{x}_j
\]

**What the symbols mean:**
- `z` — a weighted sum: the bias `b` plus each feature (`x_hat_j`) multiplied by its weight `w_j`.
- `e` — Euler's number (~2.718), the base of natural logarithms.
- `σ(z)` — the sigmoid function. When `z` is very negative, σ → 0; when very positive, σ → 1; when `z = 0`, σ = 0.5.

**What it does in plain terms:** The model learns the weights `w_j`. A positive weight means "more of this feature → higher completion probability"; a negative weight means the opposite. The sigmoid turns that weighted score into a clean 0–100% probability.

### 4.6 How the model learns — the loss function

**What it does:** Measures how wrong the model's predictions are, so the model can improve.

**The formula:**

\[
J(\mathbf{w}, b) = -\frac{1}{n} \sum_{i=1}^n \left[ y_i \log h_\theta(\mathbf{x}_i) + (1 - y_i) \log (1 - h_\theta(\mathbf{x}_i)) \right] + \frac{\lambda}{2n} \sum_{j=1}^d w_j^2
\]

**What the symbols mean:**
- `y_i` — actual outcome for appointment `i` (1 = completed, 0 = not).
- `h_θ(x_i)` — the model's predicted probability for that appointment.
- `n` — total number of training appointments.
- `λ = 0.01` — L2 regularization: penalizes overly large weights to prevent overfitting.

**What it does in plain terms:** If the model predicts 90% but the appointment actually wasn't completed, the loss is large. The model minimizes this loss across all appointments, learning the best weights.

### 4.7 Gradient descent — how the model improves

**What it does:** Repeatedly adjusts the weights to reduce the loss.

**The formula (one update per epoch, 200 epochs total):**

\[
w_j^{(t+1)} = w_j^{(t)} - \alpha \left( \frac{1}{n} \sum_{i=1}^n (h_\theta(\mathbf{x}_i) - y_i) \hat{x}_{ij} + \frac{\lambda}{n} w_j^{(t)} \right)
\]

\[
b^{(t+1)} = b^{(t)} - \alpha \left( \frac{1}{n} \sum_{i=1}^n (h_\theta(\mathbf{x}_i) - y_i) \right)
\]

**What the symbols mean:**
- `α = 0.1` — learning rate: how big each adjustment step is.
- `(h - y)` — the prediction error (predicted minus actual).
- Each epoch does a full pass over the data and nudges every weight in the direction that reduces error.

### 4.8 Overall completion probability

**What it does:** A single number for the whole clinic in the selected period.

**The formula:**

\[
\bar{p} = \frac{1}{n} \sum_{i=1}^n h_\theta(\mathbf{x}_i)
\]

**What it tells you:** The average predicted completion probability across all finalized appointments. The dashboard also shows the inverse (100% − this) as the "at-risk" rate.

### 4.9 Per-service and per-day-of-week probabilities

**What it does:** Breaks the probability down by service and by weekday, so you can see *which* bookings are riskiest.

**The formulas:**

\[
p_s = \frac{1}{|\mathcal{A}_s|} \sum_{a \in \mathcal{A}_s} h_\theta(\mathbf{x}_a)
\]

\[
p_d = \frac{1}{|\mathcal{A}_d|} \sum_{a \in \mathcal{A}_d} h_\theta(\mathbf{x}_a)
\]

**What the symbols mean:**
- `A_s` — the set of appointments with service `s`.
- `A_d` — the set of appointments on weekday `d`.
- Each is just the **average** predicted probability within that group.

**What it tells you:** If "Tooth Extraction" has a 55% completion probability vs. 90% for "Cleaning", that's a strong signal to send reminders for extractions.

### 4.10 Feature importance

**What it does:** Ranks which factors most strongly influence completion.

**The formula:**

\[
\text{importance}_j = |w_j|
\]

**What the symbols mean:**
- `|w_j|` — the absolute value of weight `j`. Larger magnitude = stronger influence.
- The **sign** of `w_j` tells direction: `+` = increases completion, `−` = decreases it.

**What it tells you:** If `hour` has a large negative weight, later hours strongly decrease completion — consider scheduling high-risk late slots differently.

### 4.11 Model performance metrics

**What it does:** Tells you how well the model fits the data. (*Note: these are in-sample — on the training data — so they indicate fit, not generalization.*)

| Metric | What it measures | Formula |
|--------|------------------|---------|
| **Accuracy** | Overall fraction correct | \( \frac{TP + TN}{n} \) |
| **Precision** | Of those predicted "completed", how many actually were | \( \frac{TP}{TP + FP} \) |
| **Recall** | Of those actually completed, how many were caught | \( \frac{TP}{TP + FN} \) |
| **F1 Score** | Harmonic mean of precision & recall (balanced view) | \( 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}} \) |
| **AUC** | Probability a random "completed" outscores a random "not completed" | \( \frac{1}{n_+ n_-} \sum_{i: y_i=1} \sum_{j: y_j=0} \mathbb{1}[p_i > p_j] \) |

- Classification threshold = 0.5.
- `TP` = true positives, `TN` = true negatives, `FP` = false positives, `FN` = false negatives.

### 4.12 The S-curve visualization

**What it does:** Shows how completion probability changes across the hours of the day, holding all other features at their average.

**The formula:**

\[
\text{curve}(h) = \sigma\left( b + w_{\text{hour}} \cdot \frac{h - \mu_{\text{hour}}}{\sigma_{\text{hour}}} \right)
\]

Because every non-hour feature is held at its mean, its standardized value is zero, so it drops out of the equation. This isolates the pure effect of the hour, producing the classic S-curve.

**What it tells you:** The shape of the curve — which hours are high-probability and which dip — tells you when no-shows are most likely.

---

## 5. Period Comparison — "Are we growing or shrinking?"

**What it does:** Compares the current period's appointments to the previous one.

**The formula:**

\[
\Delta\% = \frac{C_{\text{current}} - C_{\text{previous}}}{C_{\text{previous}}} \times 100
\]

**What the symbols mean:**
- `C_current` — appointments in the current period.
- `C_previous` — appointments in the previous period.

**What it tells you:** A green `+` means growth, a red `−` means decline. Use it as a quick pulse check on your trend.

---

## 6. Walk-in vs Online — "How are patients booking?"

**What it does:** Shows the split between walk-in and online bookings.

**The formulas:**

\[
\text{walkIn\%} = \frac{|\{ a \mid a.\text{isWalkIn} = \text{true} \}|}{|\{ a \}|} \times 100
\]

\[
\text{online\%} = 100 - \text{walkIn\%}
\]

**What the symbols mean:**
- `a.isWalkIn = true` — an appointment that was a walk-in.
- `|{a}|` — total number of appointments.

**What it tells you:** Which channel drives volume. If walk-ins dominate, keep walk-in-friendly capacity; if online dominates, invest in the booking experience.

---

## 7. Status Timeline — "How do appointments move through their lifecycle?"

**What it does:** A day-by-day stacked count of appointment statuses.

**The formula:**

\[
\text{count}_{d,s} = |\{ a \in \text{appointments} \mid \text{dateKey}(a) = d \ \text{and}\ a.\text{status} = s \}|
\]

**What the symbols mean:**
- `d` — a specific date in the range.
- `s` — an appointment status.

**What it tells you:** Days with unusual spikes in `notCompleted` or `rejected` — investigate what happened on those days.

---

## 8. Prescriptive Analytics — "What should we do?"

**What it does:** Produces suggested actions from simple thresholds on the data.

**The rules:**

1. **Lowest-volume day** → flagged if `count_min < total ÷ days`.
2. **Highest-volume day** → always shown.
3. **Peak hour** → always shown.
4. **Most-booked service** → always shown (top of the pie).
5. **Least-booked service** → flagged if `count_min < 3`.
6. **Growth alert** → shown if projected > actual in the last two predictive periods (only when ≥ 3 forecast points exist).

**What it tells you:** A short, prioritized list of the most actionable items — which days/slots/services to focus on.

---

## Notation Reference

| Symbol | Meaning | Plain English |
|--------|---------|---------------|
| `σ(z)` | Sigmoid function | Squashes any score into a 0–1 probability |
| `x` | Feature vector | The row of numbers describing one appointment |
| `x̂` | Standardized feature | A feature rescaled to mean 0, std dev 1 |
| `w_j` | Weight (coefficient) | How strongly feature `j` affects the outcome |
| `b` | Bias term | The model's baseline (when all features are 0) |
| `α` | Learning rate (0.1) | How big each learning step is |
| `λ` | L2 regularization (0.01) | Penalty that keeps weights from getting too large |
| `n` | Number of training samples | How many appointments the model learned from |
| `A_s` | Appointments with service `s` | The group of appointments for one service |
| `A_d` | Appointments on weekday `d` | The group of appointments for one weekday |
| `1[·]` | Indicator function | 1 if the condition is true, otherwise 0 |
