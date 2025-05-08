import multer from "multer";

// Configure Multer to use memory storage (keep files in memory as buffer)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'application/pdf'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only CSV, PDF and image files (JPG, JPEG, PNG, WEBP) are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25 MB limit
        files: 1, // Only allow one file
        fields: 50, // Increased field limit
        parts: 100 // Increased parts limit
    },
    fileFilter: fileFilter
});

// Error handling middleware for multer
export const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 25MB'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files. Only one file is allowed'
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Unexpected field. Please use the field name "file" for file upload'
            });
        }
        if (err.code === 'LIMIT_PART_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many parts in the form data'
            });
        }
        if (err.code === 'LIMIT_FIELD_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many fields in the form data'
            });
        }
    }
    next(err);
};

export default upload;