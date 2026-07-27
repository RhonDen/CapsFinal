/**
 * Node-only tests for UniSMS payload + phone normalization.
 * Run with: node server/utils/sendSMS.test-runner.js
 *
 * No Jest/Vitest required.
 */
const assert = require('assert');

const { toE164PhStrict } = require('./sendSMS');

const test = (name, fn) => {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(e && e.stack ? e.stack : e);
    process.exitCode = 1;
  }
};

test('toE164PhStrict: converts 09xxxxxxxxx -> +63xxxxxxxxx', () => {
  assert.strictEqual(toE164PhStrict('09123456789'), '+639123456789');
});

test('toE164PhStrict: trims separators and spaces', () => {
  assert.strictEqual(toE164PhStrict('09 123-456-789'), '+639123456789');
});

test('toE164PhStrict: keeps already valid +63 E.164', () => {
  assert.strictEqual(toE164PhStrict('+639123456789'), '+639123456789');
});

test('toE164PhStrict: rejects invalid format', () => {
  assert.throws(() => toE164PhStrict('08123456789'), /Invalid PH phone number/);
});

if (process.exitCode) {
  console.error('\nSome tests failed.');
  process.exit(1);
} else {
  console.log('\nAll tests passed.');
}
