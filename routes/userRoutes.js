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
} = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// All routes require a valid token AND the 'teacher' role
router.use(protect, authorizeRoles('teacher'));

router.route('/students')
    .get(getAllStudents)
    .post(createStudent);

router.route('/students/:id')
    .get(getStudentById)
    .put(updateStudent)
    .delete(deleteStudent);

module.exports = router;
