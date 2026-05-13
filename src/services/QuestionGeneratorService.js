const env = require('../config/env');
const questionRepository = require('../repositories/QuestionRepository');
const httpError = require('../utils/httpError');

async function generateQuestions({ texto, numQuestoes, tema, modulo_id, atividade_id, professor_id }) {
  if (!texto || !modulo_id) throw httpError(400, 'Dados incompletos');

  const response = await fetch(env.n8nGenerateQuestionsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, numQuestoes: numQuestoes || 5, tema, modulo_id, atividade_id, professor_id }),
  });

  const data = await response.json();
  if (!data.sucesso) throw httpError(500, data.erro || 'Erro ao gerar questões');

  const questoesSalvas = [];
  for (const q of data.questoes) {
    const { data: questao } = await questionRepository.create({
      atividade_id,
      enunciado: q.enunciado,
      alternativas: JSON.stringify(q.alternativas),
      resposta_correta: q.resposta_correta,
      status: 'pendente',
    });
    questoesSalvas.push(Array.isArray(questao) ? questao[0] : questao);
  }

  return { sucesso: true, questoes: questoesSalvas, total: questoesSalvas.length };
}

module.exports = { generateQuestions };
