/**
 * routes/uploadRoutes.js - Image Upload Route
 *
 * POST /api/upload  - Upload an image to Cloudinary (authenticated teachers)
 *
 * Uses multer (already in package.json) with memoryStorage so no
 * temporary files are written to disk.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { uploadImage } = require('../controllers/uploadController');

// Store file in memory as a Buffer (no disk writes)
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
});

// POST /api/upload — protected, accepts single image field named "image"
router.post('/', protect, upload.single('image'), uploadImage);

module.exports = router;
