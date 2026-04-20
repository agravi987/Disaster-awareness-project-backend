const express = require('express');
const {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getMyNotificationActivity,
    streamNotifications,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getMyNotifications);
router.get('/activity', getMyNotificationActivity);
router.get('/stream', streamNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);

module.exports = router;
