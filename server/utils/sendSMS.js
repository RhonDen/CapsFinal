const axios = require('axios');

// ── UniSMS Configuration ──────────────────────────────────────────────
const UNISMS_ENDPOINT = 'https://unismsapi.com/api/sms';

// Try known API keys in order until one works.
const UNISMS_API_KEYS = [
  process.env.UNISMS_API_KEY || 'sk_b27982d7-8017-47b3-9433-b338b61a5fae',
  process.env.UNISMS_API_KEY_BACKUP || 'sk_12345678-1234-1234-1234-123456789012',
].filter(Boolean);

const getUnismsSenderIdCandidates = () => {
  const envValue = (process.env.UNISMS_SENDER_ID || '').trim();
  const candidates = [];
  if (envValue) candidates.push(envValue);
  candidates.push('Unisoft');
  return Array.from(new Set(candidates));
};

const isInvalidSenderIdError = (providerBody) => {
  const text = typeof providerBody === 'string' ? providerBody : JSON.stringify(providerBody || {});
  const lower = text.toLowerCase();
  return lower.includes('sender_id') && !lower.includes('accepted');
};

const UNISMS_TIMEOUT = 20000;

// ── Semaphore Configuration (Backup) ─────────────────────────────────
const SEMAPHORE_ENDPOINT = 'https://api.semaphore.co/api/v4/messages';
const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY || '';

const SEMAPHORE_TIMEOUT = 15000;

// ── Twilio Configuration (Last resort) ───────────────────────────────
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

// ── Common utilities ─────────────────────────────────────────────────

/**
 * Format a PH mobile number to E.164 strict format.
 * "09xxxxxxxxx" -> "+63xxxxxxxxx", "+639xxxxxxxxx" kept as-is.
 */
const toE164PhStrict = (phone) => {
  const raw = String(phone || '').trim();
  if (!raw) throw new Error('Invalid phone number: empty');

  const cleaned = raw.replace(/\s+/g, '');

  if (/^\+63\d{10}$/.test(cleaned)) return cleaned;

  const digits = cleaned.replace(/\D/g, '');

  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^63\d{10}$/.test(digits)) return `+${digits}`;

  throw new Error(`Invalid PH phone number: ${raw}`);
};

/**
 * Strip a PH number to 11-digit mobile format (09XXXXXXXXX).
 */
const toLocalPh = (phone) => {
  const e164 = toE164PhStrict(phone);
  const countryCode = e164.slice(0, 3); // +63
  const national = e164.slice(3);
  return `0${national}`;
};

// ── Provider Implementations ─────────────────────────────────────────

/**
 * Send SMS via UniSMS API.
 */
const sendViaUnisms = async (phone, message) => {
  const recipient = toE164PhStrict(phone);
  const senderIdCandidates = getUnismsSenderIdCandidates();

  for (const apiKey of UNISMS_API_KEYS) {
    for (const senderId of senderIdCandidates) {
      const payload = { recipient, content: String(message), sender_id: senderId };

      try {
        const response = await axios.post(UNISMS_ENDPOINT, payload, {
          headers: { 'Content-Type': 'application/json' },
          auth: { username: apiKey, password: '' },
          timeout: UNISMS_TIMEOUT,
        });
        return response.data;
      } catch (err) {
        const providerBody = err?.response?.data;
        const status = err?.response?.status;

        // Only retry on sender_id errors (422)
        if (status === 422 && isInvalidSenderIdError(providerBody)) {
          continue;
        }

        // For any other error, throw immediately so fallback kicks in
        const details = typeof providerBody === 'object' ? JSON.stringify(providerBody) : String(providerBody || err.message);
        const e = new Error(`UniSMS failed (HTTP ${status || 'unknown'}): ${details}`);
        e.status = status;
        e.provider = 'unisms';
        e.recipient = recipient;
        throw e;
      }
    }
  }

  throw new Error('UniSMS: all sender_id candidates exhausted');
};

/**
 * Send SMS via Semaphore.co API.
 */
const sendViaSemaphore = async (phone, message) => {
  if (!SEMAPHORE_API_KEY) throw new Error('Semaphore API key not configured');

  const recipient = toLocalPh(phone);
  const payload = { api_key: SEMAPHORE_API_KEY, number: recipient, message: String(message) };

  try {
    const response = await axios.post(SEMAPHORE_ENDPOINT, null, {
      params: payload,
      timeout: SEMAPHORE_TIMEOUT,
    });
    return response.data;
  } catch (err) {
    const providerBody = err?.response?.data;
    const status = err?.response?.status;
    const details = typeof providerBody === 'object' ? JSON.stringify(providerBody) : String(providerBody || err.message);
    const e = new Error(`Semaphore failed (HTTP ${status || 'unknown'}): ${details}`);
    e.status = status;
    e.provider = 'semaphore';
    e.recipient = phone;
    throw e;
  }
};

/**
 * Send SMS via Twilio API.
 */
const sendViaTwilio = async (phone, message) => {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio not fully configured');
  }

  const recipient = toE164PhStrict(phone);

  try {
    const twilio = require('twilio');
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const result = await client.messages.create({
      body: String(message),
      from: TWILIO_PHONE_NUMBER,
      to: recipient,
    });
    return result;
  } catch (err) {
    const e = new Error(`Twilio failed: ${err.message}`);
    e.provider = 'twilio';
    e.recipient = phone;
    throw e;
  }
};

// ── Main sendSMS with provider fallback chain ────────────────────────

const PROVIDERS = [
  { name: 'unisms', send: sendViaUnisms },
  { name: 'semaphore', send: sendViaSemaphore },
  { name: 'twilio', send: sendViaTwilio },
];

/**
 * Send SMS via provider fallback chain:
 * 1. UniSMS (primary)
 * 2. Semaphore.co (backup)
 * 3. Twilio (last resort)
 *
 * Returns the first successful provider's response data.
 * If all providers fail, throws the last error encountered.
 */
const sendSMS = async (phone, message, { metadata } = {}) => {
  void metadata;

  let lastError;

  for (const provider of PROVIDERS) {
    try {
      const result = await provider.send(phone, message);
      console.log(`SMS sent via ${provider.name} to ${phone}`);
      return result;
    } catch (err) {
      console.warn(`SMS provider ${provider.name} failed:`, err.message);
      lastError = err;
    }
  }

  // All providers failed
  const finalError = new Error(`All SMS providers failed. Last: ${lastError?.message || 'Unknown'}`);
  finalError.provider = lastError?.provider || 'unknown';
  finalError.recipient = phone;
  finalError.status = lastError?.status;
  throw finalError;
};

// ── Exports ──────────────────────────────────────────────────────────

module.exports = sendSMS;
module.exports.toE164PhStrict = toE164PhStrict;
module.exports.sendViaUnisms = sendViaUnisms;
module.exports.sendViaSemaphore = sendViaSemaphore;
module.exports.sendViaTwilio = sendViaTwilio;


