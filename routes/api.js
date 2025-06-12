const express = require('express');
const router = express.Router();
const db = require('../db');
const { checkAndCleanExpiredBucket } = require('../utils/bucketUtils');
const { verifyToken: verifyToken } = require('./buckets');

router.get('/api/b/:bucketId', async (req, res) => {
    try {
        const { bucketId } = req.params;
        
        const [result] = await db.execute(
            `SELECT url,
                    retention_period, created_at, expires_at,
                    CASE WHEN password_hash IS NOT NULL THEN true ELSE false END AS has_password
             FROM buckets
             WHERE url = ?`,
            [bucketId]
        );

        if (!result || result.length === 0) {
            return res.status(404).json({ error: 'Bucket not found' });
        }

        res.json(result[0]);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/b/:bucketId/files', async (req, res, next) => {
    if (req.headers['x-access-token'] || req.query.token) {
        return verifyToken(req, res, next);
    }
    
    try {
        const { bucketId } = req.params;
        
        const bucketStatus = await checkAndCleanExpiredBucket(bucketId);
        if (bucketStatus.expired) {
            return res.status(403).redirect("/403");
        }
        if (!bucketStatus.exists) {
            return res.status(404).redirect("/404");
        }
                
        const [bucket] = await db.execute(
            `SELECT id, password_hash FROM buckets WHERE url = ?`,
            [bucketId]
        );

        if (!bucket || bucket.length === 0) {
            return res.status(404).redirect(`/404`);
        }

        if (bucket[0].password_hash) {
            return res.status(401).json({ error: 'Password required' });
        }

        req.bucketId = bucket[0].id;
        next();
    } catch (error) {
        console.error('API Error:', error);
        next(err);
    }
}, async (req, res) => {
    try {
        const [files] = await db.execute(
            `SELECT id, original_name, stored_name, file_size AS size, comment 
             FROM files WHERE bucket_id = ?`,
            [req.bucketId]
        );
        
        res.json(files || []);
    } catch (error) {
        console.error('API Error:', error);
        next(err);
    }
});

router.get('/b/:bucketId/files/data', async (req, res) => {
    try {
        const { bucketId } = req.params;
        const token = req.headers['x-access-token'] || req.query.token;

        const bucketStatus = await checkAndCleanExpiredBucket(bucketId);
        if (bucketStatus.expired) {
            return res.status(403).json({ error: "Bucket expired" });
        }
        if (!bucketStatus.exists) {
            return res.status(404).json({ error: "Bucket not found" });
        }

        const [buckets] = await db.execute(
            `SELECT id, password_hash FROM buckets WHERE url = ?`,
            [bucketId]
        );

        if (!buckets || buckets.length === 0) {
            return res.status(404).json({ error: "Bucket not found" });
        }

        const bucket = buckets[0];

        if (bucket.password_hash) {
            const session = sessionTokens.get(token);

            if (!token || !session || session.bucketId !== bucket.id || session.expiresAt < Date.now()) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
        }

        const [files] = await db.execute(
            `SELECT files.* FROM files
             JOIN buckets ON files.bucket_id = buckets.id
             WHERE buckets.url = ?`,
            [bucketId]
        );

        res.json(files || []);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
module.exports = router;
