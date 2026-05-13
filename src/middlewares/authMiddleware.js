const authService = require('../services/AuthService');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ erro: 'Token de autenticação obrigatório' });
  }

  try {
    req.user = authService.verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

module.exports = authenticate;
