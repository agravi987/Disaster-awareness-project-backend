const Notification = require('../models/Notification');
const { registerNotificationStream } = require('../utils/realtimeNotifications');

const getMyNotifications = async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
    const onlyUnread = req.query.onlyUnread === 'true' || req.query.onlyUnread === '1';
    const query = { recipient: req.user._id };
    if (onlyUnread) query.isRead = false;

    try {
        const [notifications, unreadCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate('actor', 'name role email'),
            Notification.countDocuments({ recipient: req.user._id, isRead: false }),
        ]);

        res.json({ notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ message: 'Failed to load notifications', error: error.message });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            recipient: req.user._id,
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (!notification.isRead) {
            notification.isRead = true;
            await notification.save();
        }

        const unreadCount = await Notification.countDocuments({
            recipient: req.user._id,
            isRead: false,
        });

        res.json({ notification, unreadCount });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark notification as read', error: error.message });
    }
};

const markAllNotificationsRead = async (req, res) => {
    try {
        const result = await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { $set: { isRead: true } }
        );

        res.json({
            message: 'All notifications marked as read',
            modifiedCount: result.modifiedCount,
            unreadCount: 0,
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark all notifications as read', error: error.message });
    }
};

const getMyNotificationActivity = async (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Teacher activity is only available for teacher accounts.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

    try {
        const activity = await Notification.aggregate([
            { $match: { actor: req.user._id } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: { $ifNull: ['$batchKey', { $concat: ['$kind', '-', { $toString: '$_id' }] }] },
                    kind: { $first: '$kind' },
                    title: { $first: '$title' },
                    message: { $first: '$message' },
                    entityType: { $first: '$entityType' },
                    entityId: { $first: '$entityId' },
                    meta: { $first: '$meta' },
                    createdAt: { $max: '$createdAt' },
                    totalRecipients: { $sum: 1 },
                    unreadRecipients: {
                        $sum: {
                            $cond: [{ $eq: ['$isRead', false] }, 1, 0],
                        },
                    },
                },
            },
            { $sort: { createdAt: -1 } },
            { $limit: limit },
        ]);

        res.json({ activity });
    } catch (error) {
        res.status(500).json({ message: 'Failed to load teacher notification activity', error: error.message });
    }
};

const streamNotifications = (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const cleanup = registerNotificationStream(req.user._id.toString(), res);

    req.on('close', cleanup);
    req.on('error', cleanup);
};

module.exports = {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getMyNotificationActivity,
    streamNotifications,
};
