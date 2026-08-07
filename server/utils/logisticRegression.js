/**
 * Self-contained logistic regression for the analytics dashboard.
 *
 * Predicts the PROBABILITY of an appointment being COMPLETED (0–1), not a hard
 * class label. This gives the admin a continuous risk/confidence score for
 * each service, day-of-week, walk-in/online, and time-of-day segment.
 *
 * No external ML library is required — gradient descent, L2 regularization,
 * feature standardization, and binary cross-entropy are implemented here.
 */

// Cap the number of features so the model stays fast on small datasets.
const MAX_SERVICE_FEATURES = 8;

/**
 * One-hot encode a categorical service into a fixed-size feature vector.
 * Returns { features, labels } where labels is a map of service name -> index.
 */
function encodeServices(appointments, topServices) {
  const labelToIndex = new Map();
  topServices.forEach((svc, idx) => labelToIndex.set(svc, idx));

  const featureRows = [];
  const targets = [];

  for (const appt of appointments) {
    const svc = appt.service || 'Unknown';
    const isTop = labelToIndex.has(svc);
    const row = [];
    // isWalkIn (0/1)
    row.push(appt.isWalkIn ? 1 : 0);
    // hourOfDay (0–23)
    if (appt.time) {
      const h = parseInt(appt.time.split(':')[0], 10);
      row.push(Number.isFinite(h) ? h : 12);
    } else if (appt.scheduledStart) {
      row.push(new Date(appt.scheduledStart).getHours());
    } else {
      row.push(12);
    }
    // dayOfWeek (0–6, Sunday = 0)
    let dow = 0;
    const dt = appt.scheduledStart || appt.date || appt.createdAt;
    if (dt) {
      const d = new Date(dt);
      if (!Number.isNaN(d.getTime())) dow = d.getDay();
    }
    row.push(dow);
    // month (0–11)
    let month = 0;
    if (dt) {
      const d = new Date(dt);
      if (!Number.isNaN(d.getTime())) month = d.getMonth();
    }
    row.push(month);
    // durationMinutes
    row.push(Number.isFinite(appt.durationMinutes) ? appt.durationMinutes : 30);
    // One-hot service
    for (let i = 0; i < MAX_SERVICE_FEATURES; i++) {
      row.push(isTop && labelToIndex.get(svc) === i ? 1 : 0);
    }
    featureRows.push(row);
    // Target: completed = 1, everything else = 0
    targets.push(appt.status === 'completed' ? 1 : 0);
  }

  return { featureRows, targets };
}

/**
 * Compute mean and standard deviation for each feature column.
 */
function computeStats(featureRows) {
  const n = featureRows.length;
  const dim = featureRows[0].length;
  const means = new Array(dim).fill(0);
  const stds = new Array(dim).fill(0);

  for (const row of featureRows) {
    for (let j = 0; j < dim; j++) means[j] += row[j];
  }
  for (let j = 0; j < dim; j++) means[j] /= n;

  for (const row of featureRows) {
    for (let j = 0; j < dim; j++) {
      const diff = row[j] - means[j];
      stds[j] += diff * diff;
    }
  }
  for (let j = 0; j < dim; j++) stds[j] = Math.sqrt(stds[j] / n) || 1;

  return { means, stds };
}

/**
 * Standardize features to zero mean / unit variance.
 */
function standardize(featureRows, means, stds) {
  return featureRows.map((row) =>
    row.map((val, j) => (val - means[j]) / stds[j])
  );
}

/**
 * Sigmoid function.
 */
function sigmoid(z) {
  // Clamp to avoid overflow.
  if (z >= 0) {
    const ex = Math.exp(-z);
    return 1 / (1 + ex);
  }
  const ex = Math.exp(z);
  return ex / (1 + ex);
}

/**
 * Train a logistic regression model using gradient descent with L2
 * regularization and binary cross-entropy loss.
 *
 * @param {Array<Object>} appointments - Raw appointment rows.
 * @param {Array<number>} [seed] - Optional RNG seed for reproducibility.
 * @returns {Object} Model with weights, metrics, and per-segment probabilities.
 */
function trainLogisticRegression(appointments, seed = 42) {
  const cleaned = (appointments || []).filter(
    (a) => a && typeof a === 'object'
  );

  // Require a minimum number of finalized (non-pending) appointments.
  const finalized = cleaned.filter((a) => a.status && a.status !== 'pending');
  if (finalized.length < 10) {
    return {
      trained: false,
      reason: 'Not enough finalized appointment data to train a reliable model (need at least 10).',
      sampleSize: finalized.length,
    };
  }

  // Determine top services for one-hot encoding.
  const serviceCounts = new Map();
  for (const a of finalized) {
    const svc = a.service || 'Unknown';
    serviceCounts.set(svc, (serviceCounts.get(svc) || 0) + 1);
  }
  const topServices = Array.from(serviceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SERVICE_FEATURES)
    .map(([svc]) => svc);

  const { featureRows, targets } = encodeServices(finalized, topServices);
  const { means, stds } = computeStats(featureRows);
  const X = standardize(featureRows, means, stds);
  const y = targets;

  const n = X.length;
  const dim = X[0].length;
  // Initialize weights deterministically (small random values).
  let weights = new Array(dim).fill(0).map(() => (seed % 97) / 1000 - 0.048);
  let bias = 0;

  const learningRate = 0.1;
  const l2Lambda = 0.01;
  const epochs = 200;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(dim).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      const z =
        bias +
        weights.reduce((sum, w, j) => sum + w * X[i][j], 0);
      const p = sigmoid(z);
      const error = p - y[i];

      for (let j = 0; j < dim; j++) gradW[j] += error * X[i][j];
      gradB += error;
    }

    for (let j = 0; j < dim; j++) {
      weights[j] -= learningRate * (gradW[j] / n + l2Lambda * weights[j]);
    }
    bias -= learningRate * (gradB / n);
  }

  // ── Metrics ──
  const predictions = X.map((row) => {
    const z = bias + weights.reduce((sum, w, j) => sum + w * row[j], 0);
    return sigmoid(z);
  });

  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  for (let i = 0; i < n; i++) {
    const pred = predictions[i] >= 0.5 ? 1 : 0;
    if (pred === 1 && y[i] === 1) tp++;
    else if (pred === 1 && y[i] === 0) fp++;
    else if (pred === 0 && y[i] === 0) tn++;
    else fn++;
  }

  const accuracy = (tp + tn) / n;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Simple AUC approximation using rank-based method.
  let auc = 0.5;
  {
    const pos = [];
    const neg = [];
    for (let i = 0; i < n; i++) {
      if (y[i] === 1) pos.push(predictions[i]);
      else neg.push(predictions[i]);
    }
    if (pos.length > 0 && neg.length > 0) {
      let concordant = 0;
      let total = 0;
      for (const p of pos) {
        for (const q of neg) {
          if (p > q) concordant++;
          else if (p === q) concordant += 0.5;
          total++;
        }
      }
      auc = total > 0 ? concordant / total : 0.5;
    }
  }

  // ── Per-segment probabilities ──
  const serviceProbabilities = [];
  for (const svc of topServices) {
    const appts = finalized.filter((a) => (a.service || 'Unknown') === svc);
    if (appts.length === 0) continue;
    const encoded = encodeServices(appts, topServices);
    const Xs = standardize(encoded.featureRows, means, stds);
    const probs = Xs.map((row) => {
      const z = bias + weights.reduce((sum, w, j) => sum + w * row[j], 0);
      return sigmoid(z);
    });
    const completed = appts.filter((a) => a.status === 'completed').length;
    serviceProbabilities.push({
      service: svc,
      probability: probs.reduce((s, p) => s + p, 0) / probs.length,
      completed,
      total: appts.length,
    });
  }
  serviceProbabilities.sort((a, b) => b.probability - a.probability);

  const dowProbabilities = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let d = 0; d < 7; d++) {
    const appts = finalized.filter((a) => {
      const dt = a.scheduledStart || a.date || a.createdAt;
      if (!dt) return false;
      const day = new Date(dt).getDay();
      return day === d;
    });
    if (appts.length === 0) continue;
    const encoded = encodeServices(appts, topServices);
    const Xs = standardize(encoded.featureRows, means, stds);
    const probs = Xs.map((row) => {
      const z = bias + weights.reduce((sum, w, j) => sum + w * row[j], 0);
      return sigmoid(z);
    });
    const completed = appts.filter((a) => a.status === 'completed').length;
    dowProbabilities.push({
      day: dayNames[d],
      probability: probs.reduce((s, p) => s + p, 0) / probs.length,
      completed,
      total: appts.length,
    });
  }
  dowProbabilities.sort((a, b) => b.probability - a.probability);

  // ── Feature importance (coefficients) ──
  const featureNames = [
    'Walk-in',
    'Hour of day',
    'Day of week',
    'Month',
    'Duration (min)',
    ...topServices.map((svc) => `Service: ${svc}`),
  ];
  const featureImportance = weights
    .map((w, j) => ({ feature: featureNames[j] || `Feature ${j}`, coefficient: w }))
    .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));

  // Overall completion probability (average model output).
  const overallProbability =
    predictions.reduce((s, p) => s + p, 0) / predictions.length;

  // ── Sigmoid curve (probability vs hour of day) ──
  // Builds the classic S-curve by sweeping the hour-of-day feature from 0–23
  // while holding all other features at their training-set mean. This gives
  // the admin a visual of the actual logistic function, not just bars.
  const sigmoidCurve = [];
  {
    // Mean values for the non-hour continuous/binary features.
    const meanIsWalkIn =
      featureRows.reduce((s, r) => s + r[0], 0) / n;
    const meanDow = featureRows.reduce((s, r) => s + r[2], 0) / n;
    const meanMonth = featureRows.reduce((s, r) => s + r[3], 0) / n;
    const meanDuration = featureRows.reduce((s, r) => s + r[4], 0) / n;

    // Use the most common service as the reference one-hot.
    const refServiceIdx = 0;

    for (let hour = 0; hour <= 23; hour++) {
      // Raw feature vector matching encodeServices() layout.
      const raw = [
        meanIsWalkIn,
        hour,
        meanDow,
        meanMonth,
        meanDuration,
      ];
      for (let i = 0; i < MAX_SERVICE_FEATURES; i++) {
        raw.push(i === refServiceIdx ? 1 : 0);
      }

      // Standardize using the training stats, then predict.
      const row = raw.map((val, j) => (val - means[j]) / stds[j]);
      const z = bias + weights.reduce((sum, w, j) => sum + w * row[j], 0);
      sigmoidCurve.push({
        hour,
        label: `${hour}:00`,
        probability: Number(sigmoid(z).toFixed(4)),
      });
    }
  }

  return {
    trained: true,
    method: 'logistic-regression',
    target: 'probability of completion',
    sampleSize: n,
    overallProbability,
    serviceProbabilities,
    dowProbabilities,
    featureImportance,
    sigmoidCurve,
    metrics: {
      accuracy,
      precision,
      recall,
      f1,
      auc,
    },
    topServices,
  };
}

module.exports = { trainLogisticRegression };
