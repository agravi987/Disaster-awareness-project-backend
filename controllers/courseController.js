/**
 * controllers/courseController.js - Course & Lesson Management
 * 
 * Teachers can create, update, and delete courses.
 * Students can view all courses and enroll.
 * 
 * Functions:
 *  - createCourse (teacher)
 *  - getAllCourses (public)
 *  - getCourseById (public)
 *  - updateCourse (teacher)
 *  - deleteCourse (teacher)
 *  - addLesson (teacher)
 *  - updateLesson (teacher)
 *  - deleteLesson (teacher)
 *  - enrollCourse (student)
 *  - getEnrolledCourses (student)
 */

const Course = require('../models/Course');
const User = require('../models/User');
const { deleteImageFromCloudinary } = require('./uploadController');
const {
    getAllStudentIds,
    createNotificationsForRecipients,
} = require('../utils/notificationService');

/** @desc Create a new course | @route POST /api/courses | @access Teacher */
const createCourse = async (req, res) => {
    const { title, description, category, enrollmentType, thumbnail } = req.body;
    try {
        const course = await Course.create({
            title,
            description,
            category,
            enrollmentType,
            thumbnail,
            teacher: req.user._id,
        });

        try {
            const studentIds = await getAllStudentIds();
            await createNotificationsForRecipients({
                recipientIds: studentIds,
                actorId: req.user._id,
                kind: 'course_created',
                entityType: 'course',
                entityId: course._id,
                batchKey: `course-created-${course._id.toString()}`,
                title: `New Course Available: ${course.title}`,
                message: `${req.user.name} published a new course${course.category ? ` in ${course.category}` : ''}.`,
                meta: {
                    route: `/student/courses/${course._id}`,
                    teacherName: req.user.name,
                    category: course.category || 'General',
                },
            });
        } catch (notificationError) {
            console.error('Course creation notification failed:', notificationError.message);
        }

        res.status(201).json(course);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** @desc Get all courses | @route GET /api/courses | @access Public */
const getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find().populate('teacher', 'name email');
        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** @desc Get single course with lessons | @route GET /api/courses/:id | @access Public */
const getCourseById = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id).populate(
            'teacher',
            'name'
        );
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json(course);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** @desc Update course details | @route PUT /api/courses/:id | @access Teacher */
const updateCourse = async (req, res) => {
    const { title, description, category, enrollmentType, thumbnail } = req.body;
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (title) course.title = title;
        if (description !== undefined) course.description = description;
        if (category) course.category = category;
        if (enrollmentType) course.enrollmentType = enrollmentType;
        
        if (thumbnail !== undefined && thumbnail !== course.thumbnail) {
            // Delete the old thumbnail from Cloudinary
            if (course.thumbnail) {
                await deleteImageFromCloudinary(course.thumbnail);
            }
            course.thumbnail = thumbnail;
        }

        const updated = await course.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** @desc Delete a course | @route DELETE /api/courses/:id | @access Teacher */
const deleteCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        
        // Delete the thumbnail image from Cloudinary if it exists
        if (course.thumbnail) {
            await deleteImageFromCloudinary(course.thumbnail);
        }

        await course.deleteOne();

        // Remove this course from all users' enrolledCourses array to fix ghost courses in student portal
        await User.updateMany(
            { enrolledCourses: req.params.id },
            { $pull: { enrolledCourses: req.params.id } }
        );

        res.json({ message: 'Course deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Add a lesson to a course
 * @route   POST /api/courses/:id/lessons
 * @access  Teacher
 */
const addLesson = async (req, res) => {
    const { title, videoUrl, material, quiz } = req.body;
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // Push a new lesson into the lessons array
        course.lessons.push({ title, videoUrl, material, quiz });
        const updated = await course.save();
        res.status(201).json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Update a lesson
 * @route   PUT /api/courses/:id/lessons/:lessonId
 * @access  Teacher
 */
const updateLesson = async (req, res) => {
    const { title, videoUrl, material, quiz } = req.body;
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // Find the specific lesson sub-document by its id
        const lesson = course.lessons.id(req.params.lessonId);
        if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

        if (title) lesson.title = title;
        if (videoUrl !== undefined) lesson.videoUrl = videoUrl;
        if (material !== undefined) lesson.material = material;
        if (quiz !== undefined) lesson.quiz = quiz;

        await course.save();
        res.json(course);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Delete a lesson from a course
 * @route   DELETE /api/courses/:id/lessons/:lessonId
 * @access  Teacher
 */
const deleteLesson = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // Use Mongoose's pull method to remove the sub-document
        course.lessons.pull({ _id: req.params.lessonId });
        await course.save();
        res.json({ message: 'Lesson removed', course });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Enroll the current student in a course
 * @route   POST /api/courses/:id/enroll
 * @access  Student
 */
const enrollCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const user = await User.findById(req.user._id);

        // Check if already enrolled
        if (user.enrolledCourses.includes(course._id)) {
            return res.status(400).json({ message: 'Already enrolled' });
        }

        user.enrolledCourses.push(course._id);
        await user.save();
        res.json({ message: 'Enrolled successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get all courses the student is enrolled in
 * @route   GET /api/courses/enrolled
 * @access  Student
 */
const getEnrolledCourses = async (req, res) => {
    try {
        // Populate the enrolledCourses references in the user's document
        const user = await User.findById(req.user._id).populate({
            path: 'enrolledCourses',
            populate: { path: 'teacher', select: 'name' },
        });
        res.json(user.enrolledCourses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Unenroll from an optional course
 * @route   POST /api/courses/:id/unenroll
 * @access  Student
 */
const unenrollCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.enrollmentType === 'mandatory') {
            return res.status(403).json({ message: 'You cannot unenroll from a mandatory course. Please contact your teacher.' });
        }

        const user = await User.findById(req.user._id);

        // Check if actually enrolled
        if (!user.enrolledCourses.includes(course._id)) {
            return res.status(400).json({ message: 'You are not enrolled in this course' });
        }

        // Pull the course from the enrolled array
        user.enrolledCourses.pull(course._id);
        await user.save();

        res.json({ message: 'Unenrolled successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Assign a course to students or groups
 * @route   POST /api/courses/:id/assign
 * @access  Teacher
 */
const assignCourse = async (req, res) => {
    let { studentIds, groupIds } = req.body;
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const Group = require('../models/Group');

        let allStudentIdsToAssign = new Set();

        // 1. Add explicitly provided student IDs (handle string or array)
        if (studentIds) {
            if (!Array.isArray(studentIds)) studentIds = [studentIds];
            studentIds.forEach(id => allStudentIdsToAssign.add(id));
        }

        // 2. Fetch all groups and extract their student IDs (handle string or array)
        if (groupIds) {
            if (!Array.isArray(groupIds)) groupIds = [groupIds];
            if (groupIds.length > 0) {
                const groups = await Group.find({ _id: { $in: groupIds } });
                groups.forEach(group => {
                    group.students.forEach(studentId => {
                        allStudentIdsToAssign.add(studentId.toString());
                    });
                });
            }
        }

        const uniqueStudentIds = Array.from(allStudentIdsToAssign);

        if (uniqueStudentIds.length === 0) {
            return res.status(400).json({ message: 'No students selected for assignment' });
        }

        // 3. Update all those students to include this courseId using $addToSet (prevents duplicates)
        const result = await User.updateMany(
            { _id: { $in: uniqueStudentIds } },
            { $addToSet: { enrolledCourses: course._id } }
        );

        console.log(`Course assigned to ${uniqueStudentIds.length} students. MongoDB modified ${result.modifiedCount} documents.`);

        try {
            await createNotificationsForRecipients({
                recipientIds: uniqueStudentIds,
                actorId: req.user._id,
                kind: 'course_assigned',
                entityType: 'course',
                entityId: course._id,
                batchKey: `course-assigned-${course._id.toString()}-${Date.now()}`,
                title: `Course Assigned: ${course.title}`,
                message: `${req.user.name} assigned this course to you.`,
                meta: {
                    route: `/student/courses/${course._id}`,
                    teacherName: req.user.name,
                },
            });
        } catch (notificationError) {
            console.error('Course assignment notification failed:', notificationError.message);
        }

        res.json({ message: `Course assigned to ${uniqueStudentIds.length} students successfully` });

    } catch (error) {
        console.error('Assign Course Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
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
};
