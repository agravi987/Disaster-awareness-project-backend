/**
 * controllers/uploadController.js - Cloudinary Image Upload
 *
 * Accepts a multipart image upload, streams it to Cloudinary,
 * and returns the secure URL + public_id back to the frontend.
 *
 * The Cloudinary SDK is configured via .env variables:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

/**
 * @desc    Upload an image to Cloudinary
 * @route   POST /api/upload
 * @access  Private (Teacher)
 * @body    multipart/form-data with field name "image"
 */
const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        // Upload buffer to Cloudinary using upload_stream
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'disaster-awareness-platform',
                    resource_type: 'image',
                    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        res.json({
            url:       result.secure_url,
            public_id: result.public_id,
        });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        res.status(500).json({ message: 'Image upload failed. Check Cloudinary credentials.' });
    }
};

/**
 * Helper to delete an image from Cloudinary by its URL
 * Used when a course is deleted to prevent orphaned images.
 */
const deleteImageFromCloudinary = async (imageUrl) => {
    try {
        if (!imageUrl || !imageUrl.includes('cloudinary.com')) return;
        
        // Extract public ID from URL (e.g. disaster-awareness-platform/filename)
        const parts = imageUrl.split('/');
        const filename = parts.pop(); // e.g. "image123.jpg"
        const folder = parts.pop();   // e.g. "disaster-awareness-platform"
        
        const publicId = `${folder}/${filename.split('.')[0]}`;
        
        await cloudinary.uploader.destroy(publicId);
        console.log(`Deleted Cloudinary image: ${publicId}`);
    } catch (error) {
        console.error('Failed to delete image from Cloudinary:', error);
    }
};

module.exports = { uploadImage, deleteImageFromCloudinary };
