/**
 * routes/groupRoutes.js - Group Management Routes (Teacher Only)
 * 
 * GET    /api/groups       -> List all groups (teacher's groups)
 * POST   /api/groups       -> Create a group
 * GET    /api/groups/:id   -> Get one group
 * PUT    /api/groups/:id   -> Update group
 * DELETE /api/groups/:id   -> Delete group
 */

const express = require('express');
const router = express.Router();
const {
    createGroup,
    getAllGroups,
    getGroupById,
    updateGroup,
    deleteGroup,
} = require('../controllers/groupController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.use(protect, authorizeRoles('teacher'));

router.route('/').get(getAllGroups).post(createGroup);
router.route('/:id').get(getGroupById).put(updateGroup).delete(deleteGroup);

module.exports = router;
