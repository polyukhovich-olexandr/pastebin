const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const mime = require('mime-types');
const bcrypt = require('bcryptjs');
const { sessionTokens } = require('./buckets');
const { checkAndCleanExpiredBucket } = require('../utils/bucketUtils');

async function verifyToken(bucketId, token) {
    if (!token) return false;
    
    const session = sessionTokens.get(token);
    if (!session) return false;
    
    const [[bucket]] = await db.execute(
        `SELECT id FROM buckets WHERE url = ?`,
        [bucketId]
    );
    
    if (!bucket || bucket.id !== session.bucketId) return false;
    if (session.expiresAt < Date.now()) return false;
    
    return true;
}

router.get('/b/:bucket/:file/download', async (req, res, next) => {

    const bucketUrl = req.params.bucket;
    const storedName = req.params.file;

    const token = req.headers['x-access-token'] || req.query.token;

    try {
        const bucketStatus = await checkAndCleanExpiredBucket(bucketUrl);
        if (bucketStatus.expired) {
            return res.status(403).redirect('/403');
        }
        if (!bucketStatus.exists) {
            return res.status(404).redirect('/403');
        }
        
        const [[bucket]] = await db.execute(
            `SELECT id, password_hash FROM buckets WHERE url = ?`,
            [bucketUrl]
        );

        if (!bucket) {
            return res.status(403).redirect('/403');
        }

        if (bucket.password_hash && !(await verifyToken(bucketUrl, token))) {
            return res.status(403).redirect('/403');
        }

        const [[file]] = await db.execute(
            `SELECT original_name FROM files WHERE stored_name = ? AND bucket_id = ?`,
            [storedName, bucket.id]
        );

        if (!file) {
            console.log('File not found');
            return res.status(404).redirect('/403');
        }

        const filePath = path.join(__dirname, '../private/uploads', storedName);

        if (!fs.existsSync(filePath)) {
            console.log('File path does not exist:', filePath);
            return res.status(404).redirect('/403');
        }

        res.download(filePath, file.original_name);
    } catch (err) {
        console.error('Download error:', err);
        next(err);
    }
});

router.get('/b/:bucket/:file/view', async (req, res, next) => {
    const bucketUrl = req.params.bucket;
    const storedName = req.params.file;
    const token = req.query.token || req.headers['x-access-token'];

    try {
        const bucketStatus = await checkAndCleanExpiredBucket(bucketUrl);
        if (bucketStatus.expired) {
            return res.status(403).redirect('/403');
        }
        if (!bucketStatus.exists) {
            return res.status(404).redirect('/403');
        }
        
        const [[bucket]] = await db.execute(
            `SELECT id, password_hash FROM buckets WHERE url = ?`,
            [bucketUrl]
        );

        if (!bucket) {
            return res.status(404).redirect('/403');
        }

        if (bucket.password_hash && !(await verifyToken(bucketUrl, token))) {
            return res.status(403).redirect('/403');
        }

        const [[file]] = await db.execute(
            `SELECT original_name FROM files WHERE stored_name = ? AND bucket_id = ?`,
            [storedName, bucket.id]
        );

        if (!file) {
            return res.status(404).redirect('/403');
        }

        const filePath = path.join(__dirname, '../private/uploads', storedName);

        if (!fs.existsSync(filePath)) {
            return res.status(404).redirect('/403');
        }

        const mimeType = mime.lookup(file.original_name) || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);

        res.sendFile(filePath);
    } catch (err) {
        console.error('View error:', err);
        next(err);
    }
});

router.get('/b/:bucket/download', async (req, res, next) => {
    const bucketUrl = req.params.bucket;
    const format = req.query.format || 'zip';
    const token = req.query.token || req.headers['x-access-token'];

    try {
        const bucketStatus = await checkAndCleanExpiredBucket(bucketUrl);
        if (bucketStatus.expired) {
            return res.status(403).redirect('/403');
        }
        if (!bucketStatus.exists) {
            return res.status(404).redirect('/403');
        }
        
        const [[bucket]] = await db.execute(
            `SELECT id, password_hash FROM buckets WHERE url = ?`,
            [bucketUrl]
        );

        if (!bucket) {
            return res.status(404).redirect('/403');
        }

        if (bucket.password_hash && !(await verifyToken(bucketUrl, token))) {
            return res.status(403).redirect('/403');
        }

        const [files] = await db.execute(
            `SELECT original_name, stored_name FROM files WHERE bucket_id = ?`,
            [bucket.id]
        );

        if (!files || files.length === 0) {
            return res.status(404).redirect('/403');
        }

        let archive;
        let filename;

        if (format === 'tar.gz') {
            archive = archiver('tar', { gzip: true, gzipOptions: { level: 9 } });
            filename = `bucket-${bucketUrl}.tar.gz`;
        } else {
            archive = archiver('zip', { zlib: { level: 9 } });
            filename = `bucket-${bucketUrl}.zip`;
        }

        res.attachment(filename);
        archive.pipe(res);

        for (const file of files) {
            const filePath = path.join(__dirname, '../private/uploads', file.stored_name);
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: file.original_name });
            }
        }

        await archive.finalize();
    } catch (err) {
        console.error('Archive error:', err);
        if (!res.headersSent) {
            res.status(500).redirect('/403');
        }
        next(err);
    }
});

module.exports = router;