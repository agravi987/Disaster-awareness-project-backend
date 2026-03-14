/**
 * routes/userRoutes.js - Student Management Routes (Teacher Only)
 * 
 * All routes are protected and restricted to the 'teacher' role.
 * 
 * GET    /api/users/students        -> Get all students
 * POST   /api/users/students        -> Create a student
 * GET    /api/users/students/:id    -> Get one student
 * PUT    /api/users/students/:id    -> Update student
 * DELETE /api/users/students/:id    -> Delete student
 */

const express = require('express');
const router = express.Router();
const {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getStudentProgress,
    completeCourse,
    dismissCourse,
    dismissQuiz,
    getMyProgress,
} = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// All routes here require a valid token
router.use(protect);

// --- Teacher Routes ---
router.route('/students')
    .get(authorizeRoles('teacher'), getAllStudents)
    .post(authorizeRoles('teacher'), createStudent);

router.route('/students/:id')
    .get(authorizeRoles('teacher'), getStudentById)
    .put(authorizeRoles('teacher'), updateStudent)
    .delete(authorizeRoles('teacher'), deleteStudent);

router.get('/students/:id/progress', authorizeRoles('teacher'), getStudentProgress);

// --- Student Routes ---
router.get('/me/progress', authorizeRoles('student'), getMyProgress);
router.post('/me/complete-course/:id', authorizeRoles('student'), completeCourse);
router.post('/me/dismiss-course/:id', authorizeRoles('student'), dismissCourse);
router.post('/me/dismiss-quiz/:id', authorizeRoles('student'), dismissQuiz);

module.exports = router;
