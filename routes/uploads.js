const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

const uploadDir = path.join(__dirname, '../private/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(5).toString('hex');
        cb(null, uniqueSuffix);
    }
});

const upload = multer({ storage: storage });

async function deleteFilesFromDisk(fileNames) {
    for (const fileName of fileNames) {
        const filePath = path.join(uploadDir, fileName);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted file: ${filePath}`);
            }
        } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
        }
    }
}

async function cleanupExpiredBuckets() {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [expiredBuckets] = await connection.execute(
            `SELECT id FROM buckets WHERE expires_at <= NOW()`
        );

        if (expiredBuckets.length === 0) {
            console.log('No expired buckets to clean up');
            return;
        }

        const bucketIds = expiredBuckets.map(b => b.id);

        const placeholders = bucketIds.map(() => '?').join(', ');
        const [filesToDelete] = await connection.execute(
            `SELECT stored_name FROM files WHERE bucket_id IN (${placeholders})`,
            bucketIds
        );
        
        const fileNames = filesToDelete.map(f => f.stored_name);

        await deleteFilesFromDisk(fileNames);

        await connection.execute(
            `DELETE FROM files WHERE bucket_id IN (${placeholders})`,
            bucketIds
        );
        
        await connection.execute(
            `DELETE FROM buckets WHERE id IN (${placeholders})`,
            bucketIds
        );
        
        await connection.commit();
        console.log(`Successfully cleaned up ${bucketIds.length} expired buckets and ${fileNames.length} files`);
    } catch (error) {
        await connection.rollback();
        console.error('Bucket cleanup error:', error);
    } finally {
        connection.release();
    }
}

const cleanupInterval = setInterval(cleanupExpiredBuckets, 60 * 60 * 1000);

process.on('SIGINT', () => {
    clearInterval(cleanupInterval);
    process.exit();
});

process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
    process.exit();
});

router.post('/upload', upload.array('files'), async (req, res) => {
    try {
        const { retention, password } = req.body;
        const files = req.files;
        const comments = Array.isArray(req.body.comments) ? req.body.comments : [req.body.comments || ''];
        
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const bucketId = crypto.randomBytes(8).toString('hex');
        const passwordHash = password ? await bcrypt.hash(password, 10) : null;
        const expiresAt = calculateExpiryDate(retention);
        console.log("UPLOAD:", bucketId)

        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            const [bucketResult] = await connection.execute(
                'INSERT INTO buckets (url, password_hash, retention_period, expires_at) VALUES (?, ?, ?, ?)',
                [bucketId, passwordHash, retention, expiresAt]
            );

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const storedName = file.filename;
                
                await connection.execute(
                    'INSERT INTO files (bucket_id, original_name, stored_name, file_size, comment) VALUES (?, ?, ?, ?, ?)',
                    [bucketResult.insertId, file.originalname, storedName, file.size, comments[i] || '']
                );
            }

            await connection.commit();
            res.json({ 
                success: true,
                bucketId: bucketId,
                expiresAt: expiresAt.toISOString()
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Upload error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

function calculateExpiryDate(retention) {
    const now = new Date();
    const periods = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '3d': 3 * 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
    };
    return new Date(now.getTime() + (periods[retention] || periods['7d']));
}

module.exports = router;