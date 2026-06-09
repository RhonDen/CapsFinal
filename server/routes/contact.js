const express = require('express');
const { body, param, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const ContactMessage = require('../models/ContactMessage');

const router = express.Router();

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const validate = (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }

  return true;
};

router.post(
  '/messages',
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').trim().isEmail().withMessage('A valid email is required.'),
    body('message').trim().notEmpty().withMessage('Message is required.'),
  ],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const { name, email, message } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const windowStart = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await ContactMessage.countDocuments({
      email: normalizedEmail,
      createdAt: { $gte: windowStart },
    });

    if (recentCount >= 2) {
      return res.status(429).json({
        error: 'You have reached the two-message limit for this email. Please try again later.',
      });
    }

    const createdMessage = await ContactMessage.create({
      name,
      email: normalizedEmail,
      message,
      ipAddress: req.ip || '',
    });

    return res.status(201).json({
      message: 'Your message has been sent to the admin inbox.',
      data: {
        id: createdMessage._id,
        name: createdMessage.name,
        email: createdMessage.email,
        createdAt: createdMessage.createdAt,
      },
    });
  })
);

router.get(
  '/messages',
  auth,
  asyncHandler(async (req, res) => {
    const messages = await ContactMessage.find({})
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ messages });
  })
);

router.patch(
  '/messages/:id/read',
  auth,
  [param('id').isMongoId().withMessage('Invalid message id.')],
  asyncHandler(async (req, res) => {
    if (!validate(req, res)) {
      return;
    }

    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    return res.json({ message });
  })
);

module.exports = router;
