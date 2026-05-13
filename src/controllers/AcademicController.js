const academicService = require('../services/AcademicService');

async function listCourses(req, res) { res.json(await academicService.listCourses()); }
async function createCourse(req, res) { res.status(201).json(await academicService.createCourse(req.body)); }
async function listClasses(req, res) { res.json(await academicService.listClasses(req.query)); }
async function createClass(req, res) { res.status(201).json(await academicService.createClass(req.body)); }
async function listEnrollments(req, res) { res.json(await academicService.listEnrollments(req.query)); }
async function createEnrollment(req, res) { res.status(201).json(await academicService.createEnrollment(req.body)); }
async function listModules(req, res) { res.json(await academicService.listModules(req.query)); }
async function createModule(req, res) { res.status(201).json(await academicService.createModule(req.body)); }
async function listActivities(req, res) { res.json(await academicService.listActivities(req.query)); }
async function createActivity(req, res) { res.status(201).json(await academicService.createActivity(req.body)); }
async function listQuestions(req, res) { res.json(await academicService.listQuestions(req.query)); }
async function createQuestion(req, res) { res.status(201).json(await academicService.createQuestion(req.body)); }
async function listAttempts(req, res) { res.json(await academicService.listAttempts(req.query)); }
async function createAttempt(req, res) { res.status(201).json(await academicService.createAttempt(req.body)); }
async function listCertificates(req, res) { res.json(await academicService.listCertificates(req.query)); }
async function listSemesters(req, res) { res.json(await academicService.listSemesters()); }
async function createSemester(req, res) { res.status(201).json(await academicService.createSemester(req.body)); }
async function listClassSemester(req, res) { res.json(await academicService.listClassSemester(req.query)); }

module.exports = {
  createActivity,
  createAttempt,
  createClass,
  createCourse,
  createEnrollment,
  createModule,
  createQuestion,
  createSemester,
  listActivities,
  listAttempts,
  listCertificates,
  listClassSemester,
  listClasses,
  listCourses,
  listEnrollments,
  listModules,
  listQuestions,
  listSemesters,
};
