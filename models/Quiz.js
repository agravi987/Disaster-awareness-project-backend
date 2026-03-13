/**
 * models/Quiz.js - Quiz Mongoose Schema
 * 
 * A Quiz is created by a teacher and can be:
 *   - Assigned to individual students or entire groups
 *   - Each Quiz has multiple questions, each with multiple options
 *     and one correct answer (stored as the index of the correct option).
 * 
 * Student submissions (attempts) are also stored here.
 */

const mongoose = require('mongoose');

// Sub-schema for individual questions
const questionSchema = new mongoose.Schema({
    questionText: {
        type: String,
        required: [true, 'Question text is required'],
    },
    // Array of answer option strings
    options: {
        type: [String],
        validate: {
            validator: (arr) => arr.length >= 2,
            message: 'A question must have at least 2 options',
        },
    },
    // Index of the correct answer in the options array (0-based)
    correctAnswerIndex: {
        type: Number,
        required: true,
    },
});

// Sub-schema for student quiz submissions
const submissionSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Student's selected answer index for each question
    answers: [Number],
    // Calculated score (number of correct answers)
    score: {
        type: Number,
        default: 0,
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
});

const quizSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Quiz title is required'],
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        // Teacher who created this quiz
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        questions: [questionSchema],
        // Individual students this quiz is assigned to
        assignedStudents: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        // Groups this quiz is assigned to
        assignedGroups: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Group',
            },
        ],
        // All student submissions/attempts for this quiz
        submissions: [submissionSchema],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Quiz', quizSchema);
