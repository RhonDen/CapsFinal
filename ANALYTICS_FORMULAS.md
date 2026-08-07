# Analytics Formulas

This document documents the actual mathematical formulas used by each analytics section. It answers the question *"what equation did you use?"* with precise notation.

---

## 1. Descriptive Analytics — "What happened?"

### Service Distribution (Donut / Pie Chart)

For a set of appointments in a date range:

\[
\text{pct}_s = \frac{\text{count}(\text{service} = s)}{\sum_{t \in \text{services}} \text{count}(\text{service} = t)} \times 100
\]

### Status Distribution (Bar Chart)

\[
\text{count}_s = |\{ a \in \text{appointments} \mid a.\text{status} = s \}|
\]

where `s ∈ {pending, accepted, rejected, completed, notCompleted, cancelled}`.

### Peak Hours

\[
\text{count}_h = |\{ a \in \text{appointments} \mid \text{hour}(a.\text{time}) = h \}|
\]

Sorted by `h` ascending.

### Appointments by Day (Line Chart)

- Daily: single "Total" bucket
- Weekly: counts grouped by day name (`Mon`–`Sun`)
- Monthly: counts grouped by day-of-month (`1`–`31`)
- Yearly: counts grouped by month name (`Jan`–`Dec`)

---

## 2. Diagnostic Analytics — "Why did it happen?"

### Day-of-Week Breakdown

\[
\text{count}_d = |\{ a \in \text{appointments} \mid \text{dayOfWeek}(a) = d \}|
\]

Sorted by natural day order (Monday = 0, Sunday = 6).

### Service × Day Correlation

\[
\text{count}_{s,d} = |\{ a \in \text{appointments} \mid a.\text{service} = s \land \text{dayOfWeek}(a) = d \}|
\]

---

## 3. Predictive Analytics — "What might happen next?"

### Rolling Average Forecast (Monthly only)

Let:

- \( C_m \) = total appointments in month \( m \) (the selected month)
- \( C_{m-1}, C_{m-2}, \dots \) = totals for previous months
- Historical window: up to 3 months before the selected month

\[
\text{projected}_{\text{next}} = \left\lfloor \frac{C_m + C_{m-1} + C_{m-2}}{3} \right\rfloor
\]

If fewer than 3 months of history exist, the average is taken over whatever is available (minimum 1). The result is rounded to the nearest integer.

This deliberately avoids exponential smoothing or compounding growth to keep projections conservative.

---

## 4. Logistic Regression — Completion Probability

### Prediction Target

\[
P(y = 1 \mid \mathbf{x}) \in [0, 1], \quad y = \begin{cases} 1 & \text{if appointment is ``completed''} \\ 0 & \text{otherwise} \end{cases}
\]

The model outputs a **continuous probability**, never a hard class label.

### Feature Encoding

Each appointment is encoded as a feature vector:

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

Top 8 services are selected by total appointment count. All other services are grouped into "Other" (one-hot column 8).

### Feature Standardization

Each feature is standardized to zero mean, unit variance using training-set statistics:

\[
\hat{x}_j = \frac{x_j - \mu_j}{\sigma_j}
\]

where:
\[
\mu_j = \frac{1}{n} \sum_{i=1}^n x_{ij}, \quad
\sigma_j = \sqrt{\frac{1}{n} \sum_{i=1}^n (x_{ij} - \mu_j)^2}
\]

### Hypothesis (Sigmoid)

\[
h_\theta(\mathbf{x}) = \sigma(z) = \frac{1}{1 + e^{-z}}
\]
where
\[
z = b + \sum_{j=1}^d w_j \hat{x}_j
\]

- \( \mathbf{w} \) = weight vector (coefficients)
- \( b \) = bias term
- \( d \) = number of features (\(5 + 8 = 13\))

### Loss Function (Binary Cross-Entropy with L2 Regularization)

\[
J(\mathbf{w}, b) = -\frac{1}{n} \sum_{i=1}^n \left[ y_i \log h_\theta(\mathbf{x}_i) + (1 - y_i) \log (1 - h_\theta(\mathbf{x}_i)) \right] + \frac{\lambda}{2n} \sum_{j=1}^d w_j^2
\]

- \( \lambda = 0.01 \) (L2 regularization strength)

### Gradient Descent Update

For each epoch \( t = 1, \dots, 200 \):

\[
w_j^{(t+1)} = w_j^{(t)} - \alpha \left( \frac{1}{n} \sum_{i=1}^n (h_\theta(\mathbf{x}_i) - y_i) \hat{x}_{ij} + \frac{\lambda}{n} w_j^{(t)} \right)
\]

\[
b^{(t+1)} = b^{(t)} - \alpha \left( \frac{1}{n} \sum_{i=1}^n (h_\theta(\mathbf{x}_i) - y_i) \right)
\]

- \( \alpha = 0.1 \) (learning rate)
- Epochs = 200

### Overall Completion Probability

\[
\bar{p} = \frac{1}{n} \sum_{i=1}^n h_\theta(\mathbf{x}_i)
\]

### Per-Service Probability

For each service \( s \):

\[
p_s = \frac{1}{|\mathcal{A}_s|} \sum_{a \in \mathcal{A}_s} h_\theta(\mathbf{x}_a)
\]

where \( \mathcal{A}_s \) is the set of appointments with `a.service = s`.

### Per-Day-of-Week Probability

For each day \( d \in \{0, \dots, 6\} \):

\[
p_d = \frac{1}{|\mathcal{A}_d|} \sum_{a \in \mathcal{A}_d} h_\theta(\mathbf{x}_a)
\]

where \( \mathcal{A}_d \) is the set of appointments with `dayOfWeek(a) = d`.

### Feature Importance

\[
\text{importance}_j = |w_j|
\]

Sorted descending. The sign of \( w_j \) indicates whether the feature increases (+) or decreases (−) completion probability.

### Metrics

| Metric | Formula |
|--------|---------|
| **Accuracy** | \( \frac{TP + TN}{n} \) |
| **Precision** | \( \frac{TP}{TP + FP} \) |
| **Recall** | \( \frac{TP}{TP + FN} \) |
| **F1 Score** | \( 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}} \) |
| **AUC** | \( \frac{1}{n_+ n_-} \sum_{i: y_i=1} \sum_{j: y_j=0} \mathbb{1}[p_i > p_j] \) (concordance probability) |

Where classification threshold = 0.5.

### Sigmoid Curve (Visualization)

\[
\text{curve}(h) = \sigma\left( b + w_{\text{hour}} \cdot \frac{h - \mu_{\text{hour}}}{\sigma_{\text{hour}}} + \sum_{j \neq \text{hour}} w_j \cdot \frac{\mu_j - \mu_j}{\sigma_j} \right)
\]

All non-hour features are held at their training-set mean (so their standardized values are zero), isolating the effect of hour of day on completion probability. This produces the classic S-curve across hours 0–23.

---

## 5. Period Comparison

### Month-over-Month / Year-over-Year Change

\[
\Delta\% = \frac{C_{\text{current}} - C_{\text{previous}}}{C_{\text{previous}}} \times 100
\]

where \( C_{\text{current}} \) and \( C_{\text{previous}} \) are the total appointment counts in the current and previous periods respectively.

---

## 6. Walk-in vs Online

### Percentages

\[
\text{walkIn\%} = \frac{|\{ a \mid a.\text{isWalkIn} = \text{true} \}|}{|\{ a \}|} \times 100
\]

\[
\text{online\%} = \frac{|\{ a \mid a.\text{isWalkIn} = \text{false} \}|}{|\{ a \}|} \times 100
\]

---

## 7. Status Timeline (Stacked Bar)

\[
\text{count}_{d,s} = |\{ a \in \text{appointments} \mid \text{dateKey}(a) = d \land a.\text{status} = s \}|
\]

for each date \( d \) in the range and each status \( s \).

---

## 8. Prescriptive Analytics (Recommendations)

Each recommendation is computed using comparative thresholds:

1. **Lowest-volume day**: if \( \text{count}_{\min} < \frac{\text{total}}{\text{days}} \)
2. **Highest-volume day**: always shown for the busiest day
3. **Peak hour**: always shown for the busiest hour
4. **Most-booked service**: always shown for the pie chart top entry
5. **Least-booked service**: if \( \text{count}_{\min} < 3 \)
6. **Growth alert**: if projected > actual in the last two predictive periods (only when \( \geq 3 \) forecast points exist)

---

## Notation Reference

| Symbol | Meaning |
|--------|---------|
| \( \sigma(z) \) | Sigmoid function |
| \( \mathbf{x} \) | Feature vector |
| \( \hat{x} \) | Standardized feature |
| \( w_j \) | Model weight (coefficient) |
| \( b \) | Bias term |
| \( \alpha \) | Learning rate (0.1) |
| \( \lambda \) | L2 regularization strength (0.01) |
| \( n \) | Number of training samples |
| \( \mathcal{A}_s \) | Appointments with service = \( s \) |
| \( \mathcal{A}_d \) | Appointments with day-of-week = \( d \) |
| \( \mathbb{1}[\cdot] \) | Indicator function (1 if true, 0 false) |
