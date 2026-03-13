/**
 * models/Course.js - Course Mongoose Schema
 * 
 * A Course is created by a teacher and contains:
 *   - title, description, category: basic info
 *   - teacher: reference to the User (teacher) who created it
 *   - lessons: array of embedded lesson sub-documents
 *     Each lesson has a title, video URL, and text material.
 */

const mongoose = require('mongoose');

// Sub-schema for individual lessons within a course
const lessonSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Lesson title is required'],
        trim: true,
    },
    // URL to video content (YouTube link, etc.)
    videoUrl: {
        type: String,
        default: '',
    },
    // Text-based learning material / description
    material: {
        type: String,
        default: '',
    },
    // Optional: link to a quiz for this specific lesson
    quiz: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        default: null,
    },
});

const courseSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Course title is required'],
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        // Category for organizing courses (e.g. "Earthquake Safety")
        category: {
            type: String,
            default: 'General',
        },
        // Whether a student can manually unenroll or if it is assigned mandatorily
        enrollmentType: {
            type: String,
            enum: ['optional', 'mandatory'],
            default: 'optional',
        },
        // Reference to the teacher who created this course
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // Embedded array of lessons - stored directly in the course document
        lessons: [lessonSchema],
        // URL to a thumbnail/cover image for the course
        thumbnail: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
