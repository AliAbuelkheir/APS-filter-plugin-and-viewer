const express = require('express');
const { getViewerToken } = require('../services/app.js');

let router = express.Router();

router.get('/api/auth/token', async function (req, res, next) {
    try {
        res.json(await getViewerToken());
    } catch (err) {
        next(err);
    }
});

module.exports = router;