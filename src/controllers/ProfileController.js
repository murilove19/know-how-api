const profileService = require('../services/ProfileService');

async function list(req, res) {
  res.json(await profileService.list(req.query));
}

async function getById(req, res) {
  res.json(await profileService.getById(req.params.id));
}

async function createAdmin(req, res) {
  res.status(201).json(await profileService.createAdmin(req.body));
}

async function createProfessor(req, res) {
  res.status(201).json(await profileService.createProfessor(req.body));
}

async function createStudent(req, res) {
  res.status(201).json(await profileService.createStudent(req.body));
}

module.exports = {
  createAdmin,
  createProfessor,
  createStudent,
  getById,
  list,
};
