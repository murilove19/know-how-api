const express = require('express');
const authController = require('../controllers/AuthController');
const profileController = require('../controllers/ProfileController');
const academicController = require('../controllers/AcademicController');
const statsController = require('../controllers/StatsController');
const reportController = require('../controllers/ReportController');
const questionGeneratorController = require('../controllers/QuestionGeneratorController');
const authenticate = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/rbacMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/login', asyncHandler(authController.login));

router.use(authenticate);

router.get('/session', asyncHandler(authController.session));
router.put('/trocar-senha', asyncHandler(authController.changePassword));

router.get('/profiles', authorize('admin', 'professor'), asyncHandler(profileController.list));
router.get('/profiles/:id', authorize('admin', 'professor', 'aluno'), asyncHandler(profileController.getById));
router.post('/profiles/admin', authorize('admin'), asyncHandler(profileController.createAdmin));
router.post('/profiles/professor', authorize('admin'), asyncHandler(profileController.createProfessor));
router.post('/profiles/aluno', authorize('admin', 'professor'), asyncHandler(profileController.createStudent));

router.get('/cursos', authorize('admin', 'professor', 'aluno'), asyncHandler(academicController.listCourses));
router.post('/cursos', authorize('admin'), asyncHandler(academicController.createCourse));

router.get('/turmas', authorize('admin', 'professor', 'aluno'), asyncHandler(academicController.listClasses));
router.post('/turmas', authorize('admin', 'professor'), asyncHandler(academicController.createClass));

router.get('/matriculas', authorize('admin', 'professor', 'aluno'), asyncHandler(academicController.listEnrollments));
router.post('/matriculas', authorize('admin', 'professor'), asyncHandler(academicController.createEnrollment));

router.get('/modulos', authorize('admin', 'professor', 'aluno'), asyncHandler(academicController.listModules));
router.post('/modulos', authorize('admin', 'professor'), asyncHandler(academicController.createModule));

router.get('/atividades', authorize('admin', 'professor', 'aluno'), asyncHandler(academicController.listActivities));
router.post('/atividades', authorize('admin', 'professor'), asyncHandler(academicController.createActivity));

router.get('/questoes', authorize('admin', 'professor', 'aluno'), asyncHandler(academicController.listQuestions));
router.post('/questoes', authorize('admin', 'professor'), asyncHandler(academicController.createQuestion));

router.get('/tentativas', authorize('admin', 'professor', 'aluno'), asyncHandler(academicController.listAttempts));
router.post('/tentativas', authorize('aluno'), asyncHandler(academicController.createAttempt));

router.get('/certificados', authorize('admin', 'professor', 'aluno'), asyncHandler(academicController.listCertificates));

router.get('/semestres', authorize('admin', 'professor', 'aluno'), asyncHandler(academicController.listSemesters));
router.post('/semestres', authorize('admin'), asyncHandler(academicController.createSemester));

router.get('/turma-semestre', authorize('admin', 'professor'), asyncHandler(academicController.listClassSemester));

router.get('/stats', authorize('admin', 'professor'), asyncHandler(statsController.getStats));
router.get('/relatorios/turma/:turma_id', authorize('admin', 'professor'), asyncHandler(reportController.getClassReport));

router.post('/gerar-questoes', authorize('admin', 'professor'), asyncHandler(questionGeneratorController.generateQuestions));

module.exports = router;
