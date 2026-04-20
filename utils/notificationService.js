const Notification = require('../models/Notification');
const User = require('../models/User');
const { publishNotificationToUser } = require('./realtimeNotifications');

const toUniqueIds = (ids = []) => {
    const normalized = ids
        .filter(Boolean)
        .map((id) => id.toString().trim())
        .filter(Boolean);
    return [...new Set(normalized)];
};

const getAllStudentIds = async () => {
    const students = await User.find({ role: 'student' }).select('_id').lean();
    return students.map((student) => student._id.toString());
};

const createNotificationsForRecipients = async ({
    recipientIds = [],
    actorId = null,
    kind = 'general',
    entityType = 'general',
    entityId = null,
    batchKey = null,
    title = '',
    message = '',
    meta = {},
}) => {
    const uniqueRecipientIds = toUniqueIds(recipientIds);
    if (!uniqueRecipientIds.length || !title) {
        return { insertedCount: 0 };
    }

    const docs = uniqueRecipientIds.map((recipientId) => ({
        recipient: recipientId,
        actor: actorId,
        kind,
        entityType,
        entityId,
        batchKey,
        title,
        message,
        meta,
    }));

    const insertedDocs = await Notification.insertMany(docs, { ordered: false });

    insertedDocs.forEach((doc) => {
        publishNotificationToUser(doc.recipient.toString(), {
            type: 'notification:new',
            notification: {
                id: doc._id.toString(),
                kind: doc.kind,
                title: doc.title,
                message: doc.message,
                isRead: doc.isRead,
                createdAt: doc.createdAt,
                entityType: doc.entityType,
                entityId: doc.entityId,
                meta: doc.meta,
            },
        });
    });

    return { insertedCount: insertedDocs.length };
};

module.exports = {
    getAllStudentIds,
    createNotificationsForRecipients,
};
