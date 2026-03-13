/**
 * controllers/userController.js - Student Management (Teacher Only)
 * 
 * Provides full CRUD operations for managing student accounts.
 * All routes here require the 'teacher' role.
 * 
 * - getAllStudents: List all users with the 'student' role
 * - getStudentById: Get a specific student's details
 * - createStudent: Create a student account directly (bypasses self-registration)
 * - updateStudent: Update student name/email/password
 * - deleteStudent: Remove a student account
 */

const User = require('../models/User');
const bcrypt = require('bcryptjs');

/**
 * @desc    Get all students
 * @route   GET /api/users/students
 * @access  Private/Teacher
 */
const getAllStudents = async (req, res) => {
    try {
        // Fetch all users with role 'student', exclude password from response
        const students = await User.find({ role: 'student' }).select('-password');
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get a single student by ID
 * @route   GET /api/users/students/:id
 * @access  Private/Teacher
 */
const getStudentById = async (req, res) => {
    try {
        const student = await User.findById(req.params.id).select('-password');
        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Create a new student account
 * @route   POST /api/users/students
 * @access  Private/Teacher
 */
const createStudent = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Always create as student role when teacher creates from dashboard
        const student = await User.create({
            name,
            email,
            password,
            role: 'student',
        });

        res.status(201).json({
            _id: student._id,
            name: student.name,
            email: student.email,
            role: student.role,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Update a student's details
 * @route   PUT /api/users/students/:id
 * @access  Private/Teacher
 */
const updateStudent = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const student = await User.findById(req.params.id);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Update the fields that were provided
        if (name) student.name = name;
        if (email) student.email = email;
        // Password will be re-hashed by the pre-save hook
        if (password) student.password = password;

        const updated = await student.save();

        res.json({
            _id: updated._id,
            name: updated.name,
            email: updated.email,
            role: updated.role,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Delete a student account
 * @route   DELETE /api/users/students/:id
 * @access  Private/Teacher
 */
const deleteStudent = async (req, res) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found' });
        }

        await student.deleteOne();
        res.json({ message: 'Student removed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
};
