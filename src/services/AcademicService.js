const courseRepository = require('../repositories/CourseRepository');
const classRepository = require('../repositories/ClassRepository');
const enrollmentRepository = require('../repositories/EnrollmentRepository');
const moduleRepository = require('../repositories/ModuleRepository');
const activityRepository = require('../repositories/ActivityRepository');
const questionRepository = require('../repositories/QuestionRepository');
const attemptRepository = require('../repositories/AttemptRepository');
const certificateRepository = require('../repositories/CertificateRepository');
const semesterRepository = require('../repositories/SemesterRepository');
const classSemesterRepository = require('../repositories/ClassSemesterRepository');
const profileRepository = require('../repositories/ProfileRepository');
const httpError = require('../utils/httpError');

async function listCourses() {
  const { data } = await courseRepository.request('/cursos?select=*&order=nome.asc');
  return data || [];
}

async function createCourse({ nome, descricao }) {
  if (!nome) throw httpError(400, 'Nome obrigatório');
  const { data } = await courseRepository.create({ nome, descricao });
  return Array.isArray(data) ? data[0] : data;
}

async function listClasses({ professor_id, curso_id }) {
  let filter = '?select=*';
  if (professor_id) filter += `&professor_id=eq.${professor_id}`;
  if (curso_id) {
    const { data: profs } = await profileRepository.findByRoleAndCourse('professor', curso_id, 'id');
    if (!profs || profs.length === 0) return [];
    const ids = profs.map((p) => p.id).join(',');
    const { data } = await classRepository.request(`/turmas?professor_id=in.(${ids})&select=*`);
    return data || [];
  }
  const { data } = await classRepository.request(`/turmas${filter}`);
  return data || [];
}

async function createClass({ nome, professor_id, instituicao_id, semestre_id }) {
  if (!nome || !professor_id) throw httpError(400, 'Dados incompletos');
  const { data } = await classRepository.create({ nome, professor_id, instituicao_id: instituicao_id || 1 });
  const turma = Array.isArray(data) ? data[0] : data;
  if (semestre_id) {
    await classSemesterRepository.create({ turma_id: turma.id, semestre_id, horas_disponiveis: 5, horas_utilizadas: 0 });
  }
  return turma;
}

async function listEnrollments({ turma_id, aluno_id }) {
  if (turma_id) {
    const { data } = await enrollmentRepository.request(`/matriculas?turma_id=eq.${turma_id}&select=*,profiles!aluno_id(id,nome,email,ra,primeiro_acesso)`);
    return (data || []).map((m) => ({ ...m, nome: m.profiles?.nome, email: m.profiles?.email, ra: m.profiles?.ra, primeiro_acesso: m.profiles?.primeiro_acesso }));
  }
  if (aluno_id) {
    const { data } = await enrollmentRepository.request(`/matriculas?aluno_id=eq.${aluno_id}&ativo=eq.1&select=*`);
    return data || [];
  }
  const { data } = await enrollmentRepository.findAll();
  return data || [];
}

async function createEnrollment({ ra, turma_id }) {
  if (!ra || !turma_id) throw httpError(400, 'Dados incompletos');
  const { data: alunoData } = await profileRepository.findStudentByRa(ra);
  if (!alunoData || alunoData.length === 0) throw httpError(404, 'Aluno não encontrado');
  const aluno = alunoData[0];
  const { status } = await enrollmentRepository.create({ aluno_id: aluno.id, turma_id, ativo: 1 });
  if (status >= 400) throw httpError(400, 'Aluno já matriculado');
  return { mensagem: 'Matriculado!', aluno };
}

async function listModules({ aluno_id, turma_id }) {
  if (aluno_id) {
    const { data: mats } = await enrollmentRepository.request(`/matriculas?aluno_id=eq.${aluno_id}&ativo=eq.1&select=turma_id`);
    if (!mats || mats.length === 0) return [];
    const turmaIds = mats.map((m) => m.turma_id).join(',');
    const { data } = await moduleRepository.request(`/modulos?turma_id=in.(${turmaIds})&select=*`);
    return data || [];
  }
  if (turma_id) {
    const { data } = await moduleRepository.request(`/modulos?turma_id=eq.${turma_id}&select=*`);
    return data || [];
  }
  const { data } = await moduleRepository.findAll();
  return data || [];
}

async function createModule(payload) {
  const { titulo, descricao, professor_id, turma_id, nota_minima, gera_horas, horas_maximas, data_inicio, data_fim, cor } = payload;
  if (!titulo || !professor_id || !turma_id) throw httpError(400, 'Dados incompletos');
  const { data } = await moduleRepository.create({ titulo, descricao, professor_id, turma_id, nota_minima: nota_minima || 7, gera_horas: gera_horas || 1, horas_maximas: horas_maximas || 4, data_inicio, data_fim, cor: cor || '#2563EB' });
  return Array.isArray(data) ? data[0] : data;
}

async function listActivities({ modulo_id }) {
  const filter = modulo_id ? `?modulo_id=eq.${modulo_id}&select=*` : '?select=*';
  const { data } = await activityRepository.request(`/atividades${filter}`);
  return data || [];
}

async function createActivity(payload) {
  const { modulo_id, professor_id, titulo, descricao, tipo_horas, data_inicio, data_fim, duracao, horas, nota_minima_horas, gera_horas } = payload;
  if (!modulo_id || !titulo) throw httpError(400, 'Dados incompletos');

  if (gera_horas && horas > 0) {
    const { data: modData } = await moduleRepository.request(`/modulos?id=eq.${modulo_id}&select=turma_id`);
    if (modData && modData[0]) {
      const { data: tsData } = await classSemesterRepository.request(`/turma_semestre?turma_id=eq.${modData[0].turma_id}&select=*`);
      if (tsData && tsData[0]) {
        const saldo = tsData[0].horas_disponiveis - tsData[0].horas_utilizadas;
        if (horas > saldo) throw httpError(400, `Saldo insuficiente. Disponível: ${saldo}h`);
        await classSemesterRepository.updateById(tsData[0].id, { horas_utilizadas: tsData[0].horas_utilizadas + horas });
      }
    }
  }

  const { data } = await activityRepository.create({ modulo_id, professor_id, titulo, descricao, tipo_horas: tipo_horas || 'academica', data_inicio, data_fim, duracao: duracao || 300, horas: horas || 0, nota_minima_horas: nota_minima_horas || 6, gera_horas: gera_horas || 0 });
  return Array.isArray(data) ? data[0] : data;
}

async function listQuestions({ atividade_id }) {
  if (!atividade_id) throw httpError(400, 'atividade_id obrigatório');
  const { data } = await questionRepository.request(`/questoes?atividade_id=eq.${atividade_id}&select=*`);
  return (data || []).map((q) => ({ ...q, alternativas: typeof q.alternativas === 'string' ? JSON.parse(q.alternativas) : q.alternativas }));
}

async function createQuestion({ atividade_id, enunciado, alternativas, resposta_correta }) {
  if (!atividade_id || !enunciado || !alternativas) throw httpError(400, 'Dados incompletos');
  const { data } = await questionRepository.create({ atividade_id, enunciado, alternativas: JSON.stringify(alternativas), resposta_correta });
  return Array.isArray(data) ? data[0] : data;
}

async function listAttempts({ aluno_id }) {
  if (!aluno_id) throw httpError(400, 'aluno_id obrigatório');
  const { data } = await attemptRepository.request(`/tentativas?aluno_id=eq.${aluno_id}&order=created_at.desc&select=*`);
  return data || [];
}

async function createAttempt({ aluno_id, atividade_id, respostas, nota }) {
  if (!aluno_id || !atividade_id || respostas === undefined || nota === undefined) throw httpError(400, 'Dados incompletos');

  const { data: tentData } = await attemptRepository.create({ aluno_id, atividade_id, respostas: JSON.stringify(respostas), nota });
  const { data: ativData } = await activityRepository.request(`/atividades?id=eq.${atividade_id}&select=*`);
  let certificado = null;

  if (ativData && ativData[0]) {
    const ativ = ativData[0];
    const notaMinima = ativ.gera_horas ? ativ.nota_minima_horas : 6;
    if (nota >= notaMinima) {
      const { data: modData } = await moduleRepository.request(`/modulos?id=eq.${ativ.modulo_id}&select=*`);
      if (modData && modData[0]) {
        await certificateRepository.create({ aluno_id, modulo_id: modData[0].id }, { headers: { Prefer: 'return=representation,resolution=ignore-duplicates' } });
        const { data: certData } = await certificateRepository.request(`/certificados?aluno_id=eq.${aluno_id}&modulo_id=eq.${modData[0].id}&select=*`);
        certificado = certData && certData[0] ? { ...certData[0], horas: ativ.horas, modulo_titulo: modData[0].titulo } : null;
      }
    }
  }

  return { tentativa: Array.isArray(tentData) ? tentData[0] : tentData, certificado };
}

async function listCertificates({ aluno_id }) {
  if (!aluno_id) throw httpError(400, 'aluno_id obrigatório');
  const { data } = await certificateRepository.request(`/certificados?aluno_id=eq.${aluno_id}&select=*,modulos!modulo_id(titulo,horas_maximas)`);
  return (data || []).map((c) => ({ ...c, modulo_titulo: c.modulos?.titulo, horas: c.modulos?.horas_maximas }));
}

async function listSemesters() {
  const { data } = await semesterRepository.request('/semestres?select=*&order=id.desc');
  return data || [];
}

async function createSemester({ nome, data_inicio, data_fim }) {
  if (!nome || !data_inicio || !data_fim) throw httpError(400, 'Dados incompletos');
  await semesterRepository.request('/semestres?ativo=eq.1', { method: 'PATCH', body: JSON.stringify({ ativo: 0 }) });
  const { data } = await semesterRepository.create({ nome, data_inicio, data_fim, ativo: 1 });
  return Array.isArray(data) ? data[0] : data;
}

async function listClassSemester({ turma_id }) {
  if (!turma_id) throw httpError(400, 'turma_id obrigatório');
  const { data } = await classSemesterRepository.request(`/turma_semestre?turma_id=eq.${turma_id}&select=*,semestres!semestre_id(nome,ativo)`);
  return data || [];
}

module.exports = {
  createActivity,
  createAttempt,
  createCertificate: listCertificates,
  createClass,
  createCourse,
  createEnrollment,
  createModule,
  createQuestion,
  createSemester,
  listActivities,
  listAttempts,
  listCertificates,
  listClassSemester,
  listClasses,
  listCourses,
  listEnrollments,
  listModules,
  listQuestions,
  listSemesters,
};
