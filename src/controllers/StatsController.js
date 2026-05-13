const statsService = require('../services/StatsService');

async function getStats(req, res) {
  res.json(await statsService.getStats(req.query));
}

module.exports = { getStats };
