/**
 * models/User.js - User Mongoose Schema
 * 
 * Defines the shape of user documents stored in MongoDB.
 * Each user has a:
 *   - name: display name
 *   - email: unique identifier for login
 *   - password: stored as a bcrypt hash (never plain text)
 *   - role: 'student' or 'teacher' - determines what they can access
 *   - enrolledCourses: array of course IDs the student is enrolled in
 *   - createdAt: timestamp added automatically
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: 6,
        },
        // role controls what dashboard and actions the user sees
        role: {
            type: String,
            enum: ['student', 'teacher'],
            default: 'student',
        },
        // courses this student has enrolled in (only relevant for students)
        enrolledCourses: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Course',
            },
        ],
        // courses the student has completed
        completedCourses: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Course',
            },
        ],
        // courses the student has dismissed from UI
        dismissedCourses: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Course',
            },
        ],
        // quizzes the student has dismissed from UI
        dismissedQuizzes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Quiz',
            },
        ],
    },
    {
        // Automatically adds createdAt and updatedAt timestamps
        timestamps: true,
    }
);

/**
 * Pre-save hook: Hash the password before saving if it was modified.
 * This ensures we NEVER store plain-text passwords in the database.
 */
userSchema.pre('save', async function () {
    // Only hash if the password field was changed (or is new)
    if (!this.isModified('password')) return;

    // bcrypt salt rounds - higher means more secure but slower (10 is a good balance)
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance method: Compare a plain-text password with the stored hash.
 * Used during login to verify the entered password.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
