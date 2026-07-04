const axios = require('axios');

const UNISMS_ENDPOINT = 'https://unismsapi.com/api/sms';

// Restore known-good behavior (previously worked):
// Use the same hardcoded API key pattern as the working state,
// but keep the required sender_id always included in the payload.
const apiKey = 'sk_b27982d7-8017-47b3-9433-b338b61a5fae';

// UniSMS sometimes rejects sender_id that is not provisioned.
// This app will try multiple candidate sender_id values.
// You can override/add candidates via UNISMS_SENDER_ID env var.


const getSenderIdCandidates = () => {
  const envValue = (process.env.UNISMS_SENDER_ID || '').trim();
  const candidates = [];
  if (envValue) candidates.push(envValue);

  // Common defaults seen in past runs / deployments.
  // Include your provisioned sender_id too.
  candidates.push('UnisoftSMS', 'UniSMS', 'AppointEase');


  // De-dupe while preserving order.
  return Array.from(new Set(candidates));
};

const isInvalidSenderIdError = (providerBody) => {
  // UniSMS error shape varies, so we check string/JSON broadly.
  const text = typeof providerBody === 'string' ? providerBody : JSON.stringify(providerBody || {});
  return (
    text.toLowerCase().includes('sender_id') &&
    (text.toLowerCase().includes('does not exists') ||
      text.toLowerCase().includes('does not exist') ||
      text.toLowerCase().includes('does_not_exists') ||
      text.toLowerCase().includes('invalid sender'))
  );
};

/**
 * Format a PH mobile number for UniSMS.
 * Expected inputs:
 * - "09xxxxxxxxx" -> "+63xxxxxxxxx"
 * - "+639xxxxxxxxx" -> kept as-is
 */
const toE164PhStrict = (phone) => {
  const raw = String(phone || '').trim();
  if (!raw) throw new Error('Invalid phone number: empty');

  const cleaned = raw.replace(/\s+/g, '');

  // Accept already-correct E.164 for PH.
  if (/^\+63\d{10}$/.test(cleaned)) return cleaned;

  // Normalize any separators/spaces/dashes to digits.
  const digits = cleaned.replace(/\D/g, '');

  // Local PH: 09xxxxxxxxx (11 digits starting with 09)
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;

  // If someone passes 63xxxxxxxxxx (12 digits starting with 63)
  if (/^63\d{10}$/.test(digits)) return `+${digits}`;

  throw new Error(`Invalid phone number format for PH. Received: ${raw}`);
};

/**
 * Build the UniSMS request payload.
 * UniSMS also supports optional `metadata` in request body.
 */
const buildUnismsPayload = ({
  phone,
  content,
  metadata,
  senderId,
}) => {
  const recipient = toE164PhStrict(phone);

  const payload = {
    recipient,
    content: String(content ?? ''),
    sender_id: senderId,
  };

  if (metadata && typeof metadata === 'object') {
    payload.metadata = metadata;
  }

  return { payload, recipient };
};

/**
 * Send SMS via UniSMS API.
 * Returns provider response data.
 *
 * On failure throws an Error with:
 * - err.status
 * - err.provider (provider response body)
 * - err.recipient
 * - err.payload (request payload)
 */
const sendSMS = async (phone, message, { metadata } = {}) => {
  const recipient = toE164PhStrict(phone);
  const senderIdCandidates = getSenderIdCandidates();

  let lastError;

  for (const senderId of senderIdCandidates) {
    const { payload } = buildUnismsPayload({
      phone,
      content: message,
      metadata,
      senderId,
    });

    try {
      const response = await axios.post(UNISMS_ENDPOINT, payload, {
        headers: { 'Content-Type': 'application/json' },
        auth: { username: apiKey, password: '' },
        timeout: 20000,
      });



      return response.data;
    } catch (err) {
      const providerBody = err?.response?.data;
      const status = err?.response?.status;

      // Improve visibility: log the raw provider response (or full error message)
      // so we can see the exact rejection reason.
      console.error('UniSMS raw failure:', {
        status,
        responseData: providerBody,
        responseHeaders: err?.response?.headers,
        requestConfig: {
          url: UNISMS_ENDPOINT,
          hasPayload: Boolean(payload),
        },
        errorMessage: err?.message,
      });

      // Retry ONLY when UniSMS indicates the sender_id is invalid.
      if (status === 422 && isInvalidSenderIdError(providerBody)) {
        lastError = err;
        continue;
      }

      // Otherwise, fail immediately with the first non-sender-id error.
      const details =
        typeof providerBody === 'object'
          ? JSON.stringify(providerBody)
          : String(providerBody || err.message);

      const e = new Error(`UniSMS send failed (HTTP ${status || 'unknown'}): ${details}`);
      e.status = status;
      e.provider = providerBody;
      e.recipient = recipient;
      e.payload = payload;

      // Keep a compact log too (useful if raw log is too large)
      console.error('UniSMS send failed (processed):', {
        status,
        provider: providerBody,
        recipient,
        payload,
      });

      throw e;
    }
  }

  // If we exhausted candidates, throw the last sender-id error.
  const providerBody = lastError?.response?.data;
  const status = lastError?.response?.status;
  const details =
    typeof providerBody === 'object'
      ? JSON.stringify(providerBody)
      : String(providerBody || lastError?.message || 'Unknown error');

  const e = new Error(`UniSMS send failed (HTTP ${status || 'unknown'}): ${details}`);
  e.status = status;
  e.provider = providerBody;
  e.recipient = recipient;

  // Provide a best-effort payload for diagnosis (last candidate).
  try {
    e.payload = buildUnismsPayload({
      phone,
      content: message,
      metadata,
      senderId: senderIdCandidates[senderIdCandidates.length - 1],
    }).payload;
  } catch {
    // ignore
  }

  console.error('UniSMS send failed after sender_id retries:', {
    status,
    provider: providerBody,
    recipient,
  });

  throw e;
};


module.exports = sendSMS;
module.exports.toE164PhStrict = toE164PhStrict;
module.exports.buildUnismsPayload = buildUnismsPayload;


