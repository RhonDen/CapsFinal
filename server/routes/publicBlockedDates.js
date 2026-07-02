const express = require('express');
const BlockedDate = require('../models/BlockedDate');
const { dateKeyFromDateValue } = require('../utils/schedule');

const router = express.Router();

// Public endpoint for patient portal.
// Returns all clinic-unavailable (blocked) dates + reasons.
router.get('/blocked-dates', async (req, res, next) => {
  try {
    const dates = await BlockedDate.findAll({ order: [['date', 'ASC']] });

    res.json(
      dates.map((item) => {
        const data = item.get ? item.get({ plain: true }) : item;
        return {
          ...data,
          dateKey: dateKeyFromDateValue(data.date),
        };
      })
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;

