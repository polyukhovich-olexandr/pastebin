const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { checkAndCleanExpiredBucket } = require('../utils/bucketUtils');

const sessionTokens = new Map();

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

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
            return res.status(404).redirect("/403");
        }
                
        const [bucket] = await db.execute(
            `SELECT id, password_hash FROM buckets WHERE url = ?`,
            [bucketId]
        );

        if (!bucket || bucket.length === 0) {
            return res.redirect(`/403`);
        }

        if (bucket[0].password_hash) {
            return res.status(401).json({ error: 'Password required' });
        }

        req.bucketId = bucket[0].id;
        next();
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}, async (req, res, next) => {
    try {
        const [files] = await db.execute(
            `SELECT id, original_name, stored_name, file_size AS size, comment 
             FROM files WHERE bucket_id = ?`,
            [req.bucketId]
        );
        
        res.json(files || []);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/b/:bucketId', async (req, res) => {
    try {
        const { bucketId } = req.params;
        const bucketStatus = await checkAndCleanExpiredBucket(bucketId);
        if (bucketStatus.expired) {
            return res.status(403).redirect("/403");
        }
        if (!bucketStatus.exists) {
            return res.status(404).redirect("/403");
        }
        
        const [buckets] = await db.execute(
            `SELECT id, url, created_at, expires_at, password_hash 
             FROM buckets WHERE url = ?`,
            [bucketId]
        );

        if (!buckets || buckets.length === 0) {
            return res.redirect(`/403`);
        }
        const bucket = buckets[0];

        const htmlPath = path.join(__dirname, '../src/html/bucket.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        const scripts = `
            <script>
                window.bucketData = ${JSON.stringify(bucket)};
            </script>
        `;
        html = html.replace('</body>', `${scripts}</body>`);

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('Bucket page error:', error);
        res.status(500).send('Internal server error');
    }
});

router.post('/api/b/:bucketId/verify', async (req, res) => {
    try {
        const { bucketId } = req.params;
        const { password } = req.body;
        
        const bucketStatus = await checkAndCleanExpiredBucket(bucketId);
        if (bucketStatus.expired) {
            return res.status(403).redirect("/403");
        }
        if (!bucketStatus.exists) {
            return res.status(404).redirect("/403");
        }

        const [bucket] = await db.execute(
            `SELECT id, password_hash FROM buckets WHERE url = ?`,
            [bucketId]
        );

        if (!bucket || bucket.length === 0) {
            return res.redirect(`/403`);
        }

        const isValid = await bcrypt.compare(password, bucket[0].password_hash);
        
        if (!isValid) {
            return res.status(403).json({ error: 'Invalid password' });
        }

        const token = generateToken();
        sessionTokens.set(token, {
            bucketId: bucket[0].id,
            expiresAt: Date.now() + 60 * 60 * 1000
        });

        res.json({ token });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function verifyToken(req, res, next) {
    const { bucketId } = req.params;
    try {
        const bucketStatus = await checkAndCleanExpiredBucket(bucketId);
        if (bucketStatus.expired) {
            return res.status(403).redirect("/403");
        }
        if (!bucketStatus.exists) {
            return res.status(404).redirect("/403");
        }
        
        const [result] = await db.execute(
            `SELECT id, password_hash FROM buckets WHERE url = ?`,
            [bucketId]
        );
        
        if (!result || result.length === 0) {
            return res.redirect(`/403`);
        }

        const bucket = result[0];
        req.bucketId = bucket.id;

        if (bucket.password_hash) {
            const token = req.headers['x-access-token'] || req.query.token;
            const session = sessionTokens.get(token);
            
            if (!token || !session || session.bucketId !== bucket.id || session.expiresAt < Date.now()) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
        }

        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    router,
    verifyToken,
    sessionTokens
};
