const sb = require('../config/supabase');

async function getClassReport(turmaId) {
  const { data: mats } = await sb(`/matriculas?turma_id=eq.${turmaId}&select=*,profiles!aluno_id(id,nome,ra)`);
  const alunos = (mats || []).map((m) => ({ id: m.profiles?.id, nome: m.profiles?.nome, ra: m.profiles?.ra }));

  const { data: modulos } = await sb(`/modulos?turma_id=eq.${turmaId}&select=*`);
  const modIds = (modulos || []).map((m) => m.id);
  let atividades = [];
  if (modIds.length > 0) {
    const { data: ativs } = await sb(`/atividades?modulo_id=in.(${modIds.join(',')})&select=*`);
    atividades = ativs || [];
  }

  const alunoIds = alunos.map((a) => a.id).filter(Boolean);
  let tentativas = [];
  if (alunoIds.length > 0) {
    const { data: tents } = await sb(`/tentativas?aluno_id=in.(${alunoIds.join(',')})&select=*`);
    tentativas = tents || [];
  }

  const statsPorAluno = alunos.map((aluno) => {
    const tentsAluno = tentativas.filter((t) => t.aluno_id === aluno.id);
    const notas = tentsAluno.map((t) => t.nota);
    const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : null;
    const aprovadas = tentsAluno.filter((t) => t.nota >= 6).length;
    const horas = aprovadas * 2;
    return { ...aluno, totalAtividades: tentsAluno.length, media, aprovadas, horas };
  });

  const statsPorAtividade = atividades.map((ativ) => {
    const tentsAtiv = tentativas.filter((t) => t.atividade_id === ativ.id);
    const notas = tentsAtiv.map((t) => t.nota);
    const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : null;
    const aprovados = tentsAtiv.filter((t) => t.nota >= 6).length;
    const taxa = tentsAtiv.length ? Math.round((aprovados / tentsAtiv.length) * 100) : 0;
    return { ...ativ, totalRespostas: tentsAtiv.length, media, aprovados, taxa };
  });

  return { alunos: statsPorAluno, atividades: statsPorAtividade };
}

module.exports = { getClassReport };
