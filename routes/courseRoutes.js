/**
 * routes/courseRoutes.js - Course and Lesson Routes
 * 
 * Mixed access: some routes are teacher-only, some are student-accessible.
 * 
 * GET    /api/courses           -> All courses (any logged-in user)
 * POST   /api/courses           -> Create course (teacher)
 * GET    /api/courses/enrolled  -> Student's enrolled courses (student)
 * GET    /api/courses/:id       -> Single course detail (any)
 * PUT    /api/courses/:id       -> Update course (teacher)
 * DELETE /api/courses/:id       -> Delete course (teacher)
 * POST   /api/courses/:id/enroll         -> Enroll in course (student)
 * POST   /api/courses/:id/lessons        -> Add lesson (teacher)
 * PUT    /api/courses/:id/lessons/:lid   -> Update lesson (teacher)
 * DELETE /api/courses/:id/lessons/:lid   -> Delete lesson (teacher)
 */

const express = require('express');
const router = express.Router();
const {
    createCourse,
    getAllCourses,
    getCourseById,
    updateCourse,
    deleteCourse,
    addLesson,
    updateLesson,
    deleteLesson,
    enrollCourse,
    getEnrolledCourses,
    assignCourse,
    unenrollCourse,
} = require('../controllers/courseController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Student can view their enrolled courses
router.get('/enrolled', authorizeRoles('student'), getEnrolledCourses);

// Any logged-in user can view courses, but only teachers can create
router.route('/')
    .get(getAllCourses)
    .post(authorizeRoles('teacher'), createCourse);

// Enroll route - students only
router.post('/:id/enroll', authorizeRoles('student'), enrollCourse);

// Unenroll route - students only
router.post('/:id/unenroll', authorizeRoles('student'), unenrollCourse);

// Assign route - teachers only
router.post('/:id/assign', authorizeRoles('teacher'), assignCourse);

// Lesson routes - teacher only
router.post('/:id/lessons', authorizeRoles('teacher'), addLesson);
router.put('/:id/lessons/:lessonId', authorizeRoles('teacher'), updateLesson);
router.delete('/:id/lessons/:lessonId', authorizeRoles('teacher'), deleteLesson);

// Course detail + update/delete - teacher only for mutation
router.route('/:id')
    .get(getCourseById)
    .put(authorizeRoles('teacher'), updateCourse)
    .delete(authorizeRoles('teacher'), deleteCourse);

module.exports = router;
