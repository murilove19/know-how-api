const questionGeneratorService = require('../services/QuestionGeneratorService');

async function generateQuestions(req, res) {
  try {
    res.json(await questionGeneratorService.generateQuestions(req.body));
  } catch (error) {
    if (!error.status) {
      error.status = 500;
      error.message = 'Erro ao conectar com o gerador de IA: ' + error.message;
    }
    throw error;
  }
}

module.exports = { generateQuestions };
