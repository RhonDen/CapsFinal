const axios = require('axios');

/**
 * Sends an SMS through UniSender.
 * Keep this utility isolated so the provider can be swapped later without touching routes.
 */
const sendSMS = async (phone, message) => {
  try {
    const payload = new URLSearchParams({
      api_key: process.env.UNI_SMS_API_KEY,
      phone,
      sender: process.env.UNI_SMS_SENDER_ID || 'AppointEase',
      text: message,
      format: 'json',
    });

    const response = await axios.post('https://api.unisender.com/en/api/sendSms', payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  } catch (error) {
    console.error('SMS sending failed:', error.response?.data || error.message);
    throw new Error('SMS service unavailable');
  }
};

module.exports = sendSMS;
