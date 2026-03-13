/**
 * routes/quizRoutes.js - Quiz Routes
 * 
 * GET    /api/quizzes           -> Get quizzes (teacher: all own | student: assigned)
 * POST   /api/quizzes           -> Create quiz (teacher)
 * GET    /api/quizzes/:id       -> Get single quiz
 * PUT    /api/quizzes/:id       -> Update quiz (teacher)
 * DELETE /api/quizzes/:id       -> Delete quiz (teacher)
 * POST   /api/quizzes/:id/assign  -> Assign quiz to students/groups (teacher)
 * POST   /api/quizzes/:id/submit  -> Submit quiz answers (student)
 * GET    /api/quizzes/:id/result  -> Get my quiz result (student)
 */

const express = require('express');
const router = express.Router();
const {
    createQuiz,
    getAllQuizzes,
    getQuizById,
    updateQuiz,
    deleteQuiz,
    assignQuiz,
    submitQuiz,
    getMyResult,
    getQuizAttempts,
    generateQuizAI,
} = require('../controllers/quizController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// All quiz routes require authentication
router.use(protect);

router.route('/')
    .get(getAllQuizzes)
    .post(authorizeRoles('teacher'), createQuiz);

// AI Generation route - teacher only
router.post('/generate', authorizeRoles('teacher'), generateQuizAI);

router.route('/:id')
    .get(getQuizById)
    .put(authorizeRoles('teacher'), updateQuiz)
    .delete(authorizeRoles('teacher'), deleteQuiz);

router.post('/:id/assign',  authorizeRoles('teacher'), assignQuiz);
router.post('/:id/submit',  authorizeRoles('student'), submitQuiz);
router.get('/:id/result',   authorizeRoles('student'), getMyResult);
router.get('/:id/attempts', authorizeRoles('teacher'), getQuizAttempts);

module.exports = router;
