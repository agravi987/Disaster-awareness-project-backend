/**
 * controllers/groupController.js - Group Management (Teacher Only)
 * 
 * Handles CRUD operations for student groups:
 * - createGroup: Create a new group with optional list of student IDs
 * - getAllGroups: Get all groups created by the logged-in teacher
 * - updateGroup: Rename group or change its student list
 * - deleteGroup: Remove a group
 * - addStudentToGroup / removeStudentFromGroup: Manage group membership
 */

const Group = require('../models/Group');

/**
 * @desc    Create a new group
 * @route   POST /api/groups
 * @access  Private/Teacher
 */
const createGroup = async (req, res) => {
    const { name, description, students } = req.body;
    try {
        const group = await Group.create({
            name,
            description,
            teacher: req.user._id, // Automatically set to the logged-in teacher
            students: students || [],
        });

        const populated = await group.populate('students', 'name email');
        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get all groups for the logged-in teacher
 * @route   GET /api/groups
 * @access  Private/Teacher
 */
const getAllGroups = async (req, res) => {
    try {
        const groups = await Group.find({ teacher: req.user._id }).populate(
            'students',
            'name email'
        );
        res.json(groups);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get a single group by ID
 * @route   GET /api/groups/:id
 * @access  Private/Teacher
 */
const getGroupById = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id).populate(
            'students',
            'name email'
        );
        if (!group) return res.status(404).json({ message: 'Group not found' });
        res.json(group);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Update group name/description/students
 * @route   PUT /api/groups/:id
 * @access  Private/Teacher
 */
const updateGroup = async (req, res) => {
    const { name, description, students } = req.body;
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        if (name) group.name = name;
        if (description !== undefined) group.description = description;
        if (students) group.students = students;

        const saved = await group.save();
        await saved.populate('students', 'name email');
        res.json(saved);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Delete a group
 * @route   DELETE /api/groups/:id
 * @access  Private/Teacher
 */
const deleteGroup = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        await group.deleteOne();
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createGroup,
    getAllGroups,
    getGroupById,
    updateGroup,
    deleteGroup,
};
