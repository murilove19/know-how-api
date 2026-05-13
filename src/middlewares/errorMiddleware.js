function errorMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.status || 500;
  const message = status === 500 ? 'Erro interno do servidor' : error.message;

  if (status === 500) {
    console.error(error);
  }

  return res.status(status).json({ erro: message });
}

module.exports = errorMiddleware;
