const reportService = require('../services/ReportService');

async function getClassReport(req, res) {
  res.json(await reportService.getClassReport(req.params.turma_id));
}

module.exports = { getClassReport };
