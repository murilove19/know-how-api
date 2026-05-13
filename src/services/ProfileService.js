const profileRepository = require('../repositories/ProfileRepository');
const enrollmentRepository = require('../repositories/EnrollmentRepository');
const { defaultPassword, hashPassword } = require('../utils/password');
const { sanitizeProfile, sanitizeProfiles } = require('../entities/Profile');
const httpError = require('../utils/httpError');

async function list({ role, curso_id }) {
  let filter = '?select=*';
  if (role) filter += `&role=eq.${role}`;
  if (curso_id) filter += `&curso_id=eq.${curso_id}`;
  const { data } = await profileRepository.request(`/profiles${filter}`);
  return sanitizeProfiles(data || []);
}

async function getById(id) {
  const { data } = await profileRepository.findById(id);
  if (!data || data.length === 0) throw httpError(404, 'Não encontrado');
  return sanitizeProfile(data[0]);
}

async function createAdmin({ nome, email, senha, curso_id }) {
  if (!nome || !email || !senha || !curso_id) throw httpError(400, 'Dados incompletos');
  const hashedPassword = await hashPassword(senha);
  const { data, status } = await profileRepository.create({
    nome,
    email,
    senha: hashedPassword,
    role: 'admin',
    curso_id,
    instituicao_id: 1,
    primeiro_acesso: 0,
    is_super_admin: 0,
  });
  if (status >= 400) throw httpError(400, 'Email já cadastrado');
  return sanitizeProfile(Array.isArray(data) ? data[0] : data);
}

async function createProfessor({ nome, email, ra, curso_id, instituicao_id }) {
  if (!nome || !email || !ra) throw httpError(400, 'Dados incompletos');
  const password = defaultPassword(ra);
  const hashedPassword = await hashPassword(password);
  const { data, status } = await profileRepository.create({
    nome,
    email,
    ra,
    senha: hashedPassword,
    role: 'professor',
    curso_id: curso_id || null,
    instituicao_id: instituicao_id || 1,
    primeiro_acesso: 1,
  });
  if (status >= 400) throw httpError(400, 'RA ou email já cadastrado');
  return { ...sanitizeProfile(Array.isArray(data) ? data[0] : data), senha_padrao: password };
}

async function createStudent({ nome, email, ra, turma_id, instituicao_id }) {
  if (!nome || !email || !ra || !turma_id) throw httpError(400, 'Dados incompletos');
  const password = defaultPassword(ra);
  const hashedPassword = await hashPassword(password);
  const { data, status } = await profileRepository.create({
    nome,
    email,
    ra,
    senha: hashedPassword,
    role: 'aluno',
    instituicao_id: instituicao_id || 1,
    primeiro_acesso: 1,
  });
  if (status >= 400) throw httpError(400, 'RA ou email já cadastrado');
  const student = Array.isArray(data) ? data[0] : data;
  await enrollmentRepository.create({ aluno_id: student.id, turma_id, ativo: 1 });
  return { ...sanitizeProfile(student), senha_padrao: password };
}

module.exports = {
  createAdmin,
  createProfessor,
  createStudent,
  getById,
  list,
};
