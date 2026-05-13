const sb = require('../config/supabase');

async function getStats({ curso_id }) {
  if (curso_id) {
    const { data: profs } = await sb(`/profiles?role=eq.professor&curso_id=eq.${curso_id}&select=id`);
    const profIds = (profs || []).map((p) => p.id);
    const turmasCount = profIds.length > 0 ? (await sb(`/turmas?professor_id=in.(${profIds.join(',')})&select=id`)).data?.length || 0 : 0;
    return {
      professores: profIds.length,
      turmas: turmasCount,
      alunos: 0,
    };
  }

  const [alunos, professores, admins, turmas, modulos, atividades, tentativas] = await Promise.all([
    sb('/profiles?role=eq.aluno&select=id'),
    sb('/profiles?role=eq.professor&select=id'),
    sb('/profiles?role=eq.admin&select=id'),
    sb('/turmas?select=id'),
    sb('/modulos?select=id'),
    sb('/atividades?select=id'),
    sb('/tentativas?select=id'),
  ]);

  return {
    alunos: alunos.data?.length || 0,
    professores: professores.data?.length || 0,
    admins: admins.data?.length || 0,
    turmas: turmas.data?.length || 0,
    modulos: modulos.data?.length || 0,
    atividades: atividades.data?.length || 0,
    tentativas: tentativas.data?.length || 0,
  };
}

module.exports = { getStats };
