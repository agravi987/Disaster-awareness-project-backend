/**
 * models/Group.js - Group Mongoose Schema
 * 
 * A Group is created by a teacher to organize students.
 * Teachers can assign quizzes to an entire group at once,
 * which simplifies managing large classes.
 */

const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Group name is required'],
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        // Teacher who manages this group
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // Array of student user IDs belonging to this group
        students: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Group', groupSchema);
