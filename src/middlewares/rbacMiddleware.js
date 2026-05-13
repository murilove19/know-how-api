function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ erro: 'Usuário não autenticado' });
    if (allowedRoles.length === 0 || allowedRoles.includes(req.user.role)) return next();
    return res.status(403).json({ erro: 'Acesso negado para este perfil' });
  };
}

function allowOwner(paramName = 'id') {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ erro: 'Usuário não autenticado' });
    if (req.user.role === 'admin') return next();
    if (String(req.user.id) === String(req.params[paramName] || req.body[paramName] || req.query[paramName])) return next();
    return res.status(403).json({ erro: 'Acesso negado para este recurso' });
  };
}

module.exports = {
  allowOwner,
  authorize,
};
