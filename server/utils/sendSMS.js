const axios = require('axios');

/**
 * Sends an SMS through UniSender.
 * Keep this utility isolated so the provider can be swapped later without touching routes.
 */
const sendSMS = async (phone, message) => {
  try {
    const response = await axios.post(
      process.env.UNI_SMS_SEND_URL || 'https://unismsapi.com/api/sms',
      {
        recipient: phone,
        content: message,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        auth: {
          username: process.env.UNI_SMS_API_KEY,
          password: '',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('SMS sending failed:', error.response?.data || error.message);
    throw new Error('SMS service unavailable');
  }
};

module.exports = sendSMS;

