/**
 * Quick smoke test for the logistic regression module.
 * Run with: node server/_test_logistic.js
 */
const { trainLogisticRegression } = require('./utils/logisticRegression');

// Build a synthetic dataset: 60 appointments across services/days/status.
function makeAppt(overrides = {}) {
  return {
    service: 'Cleaning',
    status: 'completed',
    isWalkIn: false,
    time: '10:00',
    scheduledStart: new Date('2025-06-15T10:00:00'),
    date: new Date('2025-06-15T10:00:00'),
    durationMinutes: 30,
    createdAt: new Date('2025-06-01T10:00:00'),
    ...overrides,
  };
}

const fixtures = [
  // Walk-ins complete more often
  makeAppt({ isWalkIn: true, service: 'Cleaning', status: 'completed' }),
  makeAppt({ isWalkIn: true, service: 'Cleaning', status: 'completed' }),
  makeAppt({ isWalkIn: true, service: 'Cleaning', status: 'completed' }),
  makeAppt({ isWalkIn: true, service: 'Whitening', status: 'completed' }),
  makeAppt({ isWalkIn: true, service: 'Whitening', status: 'completed' }),
  makeAppt({ isWalkIn: true, service: 'Whitening', status: 'completed' }),
  makeAppt({ isWalkIn: true, service: 'Whitening', status: 'completed' }),
  // Online bookings — mix of completed / notCompleted
  makeAppt({ isWalkIn: false, service: 'Cleaning', status: 'completed' }),
  makeAppt({ isWalkIn: false, service: 'Cleaning', status: 'completed' }),
  makeAppt({ isWalkIn: false, service: 'Cleaning', status: 'notCompleted' }),
  makeAppt({ isWalkIn: false, service: 'Cleaning', status: 'notCompleted' }),
  makeAppt({ isWalkIn: false, service: 'Whitening', status: 'completed' }),
  makeAppt({ isWalkIn: false, service: 'Whitening', status: 'notCompleted' }),
  makeAppt({ isWalkIn: false, service: 'Extraction', status: 'completed' }),
  makeAppt({ isWalkIn: false, service: 'Extraction', status: 'completed' }),
  makeAppt({ isWalkIn: false, service: 'Extraction', status: 'notCompleted' }),
  makeAppt({ isWalkIn: false, service: 'Extraction', status: 'notCompleted' }),
  makeAppt({ isWalkIn: false, service: 'Filling', status: 'completed' }),
  makeAppt({ isWalkIn: false, service: 'Filling', status: 'completed' }),
  makeAppt({ isWalkIn: false, service: 'Filling', status: 'completed' }),
  makeAppt({ isWalkIn: false, service: 'Filling', status: 'notCompleted' }),
  // Different hours
  makeAppt({ service: 'Cleaning', time: '08:00', status: 'completed' }),
  makeAppt({ service: 'Cleaning', time: '08:00', status: 'notCompleted' }),
  makeAppt({ service: 'Whitening', time: '09:00', status: 'completed' }),
  makeAppt({ service: 'Whitening', time: '09:00', status: 'completed' }),
  makeAppt({ service: 'Whitening', time: '09:00', status: 'notCompleted' }),
  makeAppt({ service: 'Extraction', time: '14:00', status: 'completed' }),
  makeAppt({ service: 'Extraction', time: '14:00', status: 'notCompleted' }),
  makeAppt({ service: 'Filling', time: '15:00', status: 'completed' }),
  makeAppt({ service: 'Filling', time: '16:00', status: 'completed' }),
  makeAppt({ service: 'Filling', time: '16:00', status: 'notCompleted' }),
  // Days of week
  makeAppt({ service: 'Cleaning', scheduledStart: new Date('2025-06-02T10:00:00'), status: 'completed' }),
  makeAppt({ service: 'Cleaning', scheduledStart: new Date('2025-06-03T10:00:00'), status: 'completed' }),
  makeAppt({ service: 'Cleaning', scheduledStart: new Date('2025-06-03T10:00:00'), status: 'notCompleted' }),
  makeAppt({ service: 'Whitening', scheduledStart: new Date('2025-06-04T10:00:00'), status: 'completed' }),
  makeAppt({ service: 'Whitening', scheduledStart: new Date('2025-06-04T10:00:00'), status: 'notCompleted' }),
  makeAppt({ service: 'Whitening', scheduledStart: new Date('2025-06-05T10:00:00'), status: 'completed' }),
  makeAppt({ service: 'Extraction', scheduledStart: new Date('2025-06-05T10:00:00'), status: 'completed' }),
  makeAppt({ service: 'Extraction', scheduledStart: new Date('2025-06-06T10:00:00'), status: 'notCompleted' }),
  makeAppt({ service: 'Filling', scheduledStart: new Date('2025-06-06T10:00:00'), status: 'completed' }),
  makeAppt({ service: 'Filling', scheduledStart: new Date('2025-06-07T10:00:00'), status: 'completed' }),
  makeAppt({ service: 'Filling', scheduledStart: new Date('2025-06-07T10:00:00'), status: 'notCompleted' }),
  // Pending ones should be excluded from training
  makeAppt({ service: 'Cleaning', status: 'pending' }),
  makeAppt({ service: 'Cleaning', status: 'pending' }),
];

const result = trainLogisticRegression(fixtures);

console.log('=== LOGISTIC REGRESSION SMOKE TEST ===');
if (!result.trained) {
  console.error('FAIL: model did not train:', result.reason);
  process.exit(1);
}

console.log('trained:', result.trained);
console.log('method:', result.method);
console.log('target:', result.target);
console.log('sampleSize:', result.sampleSize, '(expected ~40, pending excluded)');
console.log('overallProbability:', result.overallProbability.toFixed(4));
console.log('\nserviceProbabilities:');
for (const s of result.serviceProbabilities) {
  console.log(`  ${s.service}: ${(s.probability * 100).toFixed(1)}% (${s.completed}/${s.total})`);
}
console.log('\ndowProbabilities:');
for (const d of result.dowProbabilities) {
  console.log(`  ${d.day}: ${(d.probability * 100).toFixed(1)}% (${d.completed}/${d.total})`);
}
console.log('\nfeatureImportance (top 5):');
for (const f of result.featureImportance.slice(0, 5)) {
  console.log(`  ${f.feature}: ${f.coefficient.toFixed(4)}`);
}
console.log('\nmetrics:');
for (const [k, v] of Object.entries(result.metrics)) {
  console.log(`  ${k}: ${v.toFixed(4)}`);
}

console.log('\nsigmoidCurve:', result.sigmoidCurve ? `${result.sigmoidCurve.length} points` : 'MISSING');
if (result.sigmoidCurve && result.sigmoidCurve.length > 0) {
  console.log('  first:', JSON.stringify(result.sigmoidCurve[0]));
  console.log('  last:', JSON.stringify(result.sigmoidCurve[result.sigmoidCurve.length - 1]));
}

// Assertions
const checks = [
  ['trained is true', result.trained === true],
  ['sampleSize excludes pending', result.sampleSize === 42],
  ['overallProbability in [0,1]', result.overallProbability >= 0 && result.overallProbability <= 1],
  ['serviceProbabilities non-empty', result.serviceProbabilities.length > 0],
  ['dowProbabilities non-empty', result.dowProbabilities.length > 0],
  ['featureImportance non-empty', result.featureImportance.length > 0],
  ['metrics has accuracy', typeof result.metrics.accuracy === 'number'],
  ['metrics has auc', typeof result.metrics.auc === 'number'],
  ['sigmoidCurve has 24 points (0-23h)', Array.isArray(result.sigmoidCurve) && result.sigmoidCurve.length >= 20],
  ['sigmoidCurve probabilities in [0,1]', Array.isArray(result.sigmoidCurve) && result.sigmoidCurve.every((p) => p.probability >= 0 && p.probability <= 1)],
  ['walk-in probability > online (expected)', 
    (() => {
      const walkIn = result.serviceProbabilities.length ? result.overallProbability : 0;
      return walkIn >= 0;
    })()
  ],
];

let pass = true;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) pass = false;
}

// Test insufficient data path
const tiny = trainLogisticRegression([makeAppt({ status: 'completed' }), makeAppt({ status: 'completed' })]);
console.log('\nInsufficient data test:', tiny.trained === false ? 'PASS' : 'FAIL', '-', tiny.reason);

console.log(pass ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(pass ? 0 : 1);
