const authService = require('../services/AuthService');
const { sanitizeProfile } = require('../entities/Profile');

async function login(req, res) {
  const session = await authService.login(req.body.login, req.body.senha);
  res.json(session);
}

async function changePassword(req, res) {
  const profile = await authService.changePassword(req.body, req.user);
  res.json(sanitizeProfile(profile));
}

async function session(req, res) {
  res.json({ usuario: req.user });
}

module.exports = {
  changePassword,
  login,
  session,
};
