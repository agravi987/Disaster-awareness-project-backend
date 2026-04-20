const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        kind: {
            type: String,
            enum: [
                'course_created',
                'course_assigned',
                'quiz_created',
                'quiz_assigned',
                'course_completed',
                'quiz_submitted',
                'general',
            ],
            required: true,
            default: 'general',
        },
        entityType: {
            type: String,
            enum: ['course', 'quiz', 'general'],
            default: 'general',
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        batchKey: {
            type: String,
            default: null,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160,
        },
        message: {
            type: String,
            default: '',
            maxlength: 500,
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
