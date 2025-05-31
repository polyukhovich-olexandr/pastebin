const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/html/index.html'));
});

router.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/html/success.html'));
});

module.exports = router;