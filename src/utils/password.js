const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

function defaultPassword(ra) {
  return `${ra}${new Date().getFullYear()}*`;
}

function isBcryptHash(password) {
  return typeof password === 'string' && /^\$2[aby]\$\d{2}\$/.test(password);
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(plainPassword, storedPassword) {
  if (!storedPassword) return false;
  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(plainPassword, storedPassword);
  }
  return plainPassword === storedPassword;
}

module.exports = {
  defaultPassword,
  hashPassword,
  isBcryptHash,
  verifyPassword,
};
