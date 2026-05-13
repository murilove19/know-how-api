const jwt = require('jsonwebtoken');
const env = require('../config/env');
const profileRepository = require('../repositories/ProfileRepository');
const { createSessionPayload, createSessionResponse } = require('../entities/Session');
const { hashPassword, isBcryptHash, verifyPassword } = require('../utils/password');
const httpError = require('../utils/httpError');

function signToken(profile) {
  return jwt.sign(createSessionPayload(profile), env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

async function login(loginValue, password) {
  if (!loginValue || !password) throw httpError(400, 'Login e senha obrigatórios');

  const { data } = await profileRepository.findByLogin(loginValue);
  const user = data && data[0];
  if (!user) throw httpError(401, 'Login ou senha incorretos');

  const validPassword = await verifyPassword(password, user.senha);
  if (!validPassword) throw httpError(401, 'Login ou senha incorretos');

  if (!isBcryptHash(user.senha)) {
    const hashedPassword = await hashPassword(password);
    await profileRepository.updateById(user.id, { senha: hashedPassword });
    user.senha = hashedPassword;
  }

  return createSessionResponse(user, signToken(user));
}

async function changePassword({ id, senhaAtual, novaSenha }, requester) {
  if (!id || !novaSenha) throw httpError(400, 'Dados incompletos');

  const targetId = Number(id);
  const isSelf = Number(requester.id) === targetId;
  const canResetWithoutCurrentPassword = requester.role === 'admin' && !senhaAtual;

  if (!isSelf && requester.role !== 'admin') {
    throw httpError(403, 'Você não tem permissão para alterar a senha deste usuário');
  }

  const { data } = await profileRepository.findById(targetId);
  const user = data && data[0];
  if (!user) throw httpError(404, 'Usuário não encontrado');

  if (!canResetWithoutCurrentPassword) {
    if (!senhaAtual) throw httpError(400, 'Senha atual obrigatória');
    const validPassword = await verifyPassword(senhaAtual, user.senha);
    if (!validPassword) throw httpError(401, 'Senha atual incorreta');
  }

  const hashedPassword = await hashPassword(novaSenha);
  const { data: updated } = await profileRepository.updateById(targetId, {
    senha: hashedPassword,
    primeiro_acesso: 0,
  });

  return updated && updated[0];
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {
  changePassword,
  login,
  verifyToken,
};
