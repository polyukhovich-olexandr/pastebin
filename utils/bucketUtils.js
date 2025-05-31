const db = require('../db');
const path = require('path');
const fs = require('fs');

async function checkAndCleanExpiredBucket(bucketId) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[bucket]] = await connection.execute(
            `SELECT id, expires_at FROM buckets WHERE url = ? FOR UPDATE`,
            [bucketId]
        );

        if (!bucket) return { exists: false };

        const isExpired = new Date(bucket.expires_at) <= new Date();
        if (!isExpired) return { exists: true, expired: false };

        
        const [files] = await connection.execute(
            `SELECT stored_name FROM files WHERE bucket_id = ?`,
            [bucket.id]
        );

        
        files.forEach(file => {
            const filePath = path.join(__dirname, '../private/uploads', file.stored_name);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {
                console.error(`Error deleting file ${filePath}:`, err);
            }
        });

        
        await connection.execute(`DELETE FROM files WHERE bucket_id = ?`, [bucket.id]);
        await connection.execute(`DELETE FROM buckets WHERE id = ?`, [bucket.id]);

        await connection.commit();
        return { exists: true, expired: true, deleted: true };
    } catch (err) {
        await connection.rollback();
        console.error('Error cleaning expired bucket:', err);
        return { exists: true, expired: true, deleted: false };
    } finally {
        connection.release();
    }
}

module.exports = {
    checkAndCleanExpiredBucket
};