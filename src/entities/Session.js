const { sanitizeProfile } = require('./Profile');

function createSessionPayload(profile) {
  return {
    sub: String(profile.id),
    id: profile.id,
    role: profile.role,
    curso_id: profile.curso_id || null,
    instituicao_id: profile.instituicao_id || null,
    is_super_admin: Boolean(profile.is_super_admin),
  };
}

function createSessionResponse(profile, token) {
  return {
    usuario: sanitizeProfile(profile),
    token,
  };
}

module.exports = {
  createSessionPayload,
  createSessionResponse,
};
