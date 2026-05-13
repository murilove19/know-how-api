const ROLES = Object.freeze({
  ALUNO: 'aluno',
  PROFESSOR: 'professor',
  INSTITUICAO: 'instituicao',
  ADMIN: 'admin',
});

function sanitizeProfile(profile) {
  if (!profile) return profile;
  const { senha, password, ...safeProfile } = profile;
  return safeProfile;
}

function sanitizeProfiles(profiles = []) {
  return profiles.map(sanitizeProfile);
}

module.exports = {
  ROLES,
  sanitizeProfile,
  sanitizeProfiles,
};
