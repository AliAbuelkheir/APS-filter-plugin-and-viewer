const express = require('express');
const formidable = require('express-formidable');
const https = require('https');
const { listObjects, uploadObject, translateObject, getManifest, urnify, initializeFilterPlugin, getInternalToken } = require('../services/app.js');
const { create } = require('../../filterPlugin/models/SavedQuery.js');
const { PolicyKey } = require('@aps_sdk/oss');
const { APS_BUCKET } = require('../config.js');

let router = express.Router();

// Get configuration info
router.get('/api/config', function (req, res) {
    res.json({
        bucket: APS_BUCKET
    });
});


router.get('/api/models', async function (req, res, next) {
    try {
        const objects = await listObjects();
        
        res.json(objects);
    } catch (err) {
        console.error('Error in /api/models:', err);
        next(err);
    }
});

router.get('/api/models/:urn/status', async function (req, res, next) {
    try {
        const manifest = await getManifest(req.params.urn);
        if (manifest) {
            let messages = [];
            if (manifest.derivatives) {
                for (const derivative of manifest.derivatives) {
                    messages = messages.concat(derivative.messages || []);
                    if (derivative.children) {
                        for (const child of derivative.children) {
                            messages.concat(child.messages || []);
                        }
                    }
                }
            }
            res.json({ status: manifest.status, progress: manifest.progress, messages });
        } else {
            res.json({ status: 'n/a' });
        }
    } catch (err) {
        next(err);
    }
});

router.post('/api/models', formidable({ maxFileSize: Infinity }), async function (req, res, next) {
    const file = req.files['model-file'];
    if (!file) {
        res.status(400).send('The required field ("model-file") is missing.');
        return;
    }
    try {
        const obj = await uploadObject(file.name, file.path);
        
        // The new uploadObject returns the response from the complete upload API
        // We need to construct the objectId from bucket and object name for translation
        const objectId = `urn:adsk.objects:os.object:${APS_BUCKET}/${file.name}`;
        const urn = urnify(objectId);
        
        await translateObject(urn, req.fields['model-zip-entrypoint']);
        
        res.json({
            name: file.name,
            urn: urn
        });

    } catch (err) {
        next(err);
    }
});

// Upload URLs endpoints for chunked uploads
router.get('/dm/uploadurls', async function (req, res, next) {
    const query = req.query;
    const bucketName = query.bucketName || APS_BUCKET;
    
    console.log('Upload URLs request:', {
        bucketName,
        objectName: query.objectName,
        index: query.index,
        count: query.count,
        uploadKey: query.uploadKey ? 'present' : 'not present'
    });
    
    try {
        const accessToken = await getInternalToken();
        
        const options = {
            hostname: 'developer.api.autodesk.com',
            port: 443,
            path: `/oss/v2/buckets/${encodeURIComponent(bucketName)}/objects/${encodeURIComponent(query.objectName)}/signeds3upload?parts=${query.count}&firstPart=${query.index}`,
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            method: 'GET'
        };

        if (query.uploadKey) {
            options.path += `&uploadKey=${query.uploadKey}`;
        }
        
        console.log('Making request to Autodesk API:', options.path);
        
        const req2 = https.request(options, res2 => {
            console.log(`GET uploadurls statusCode: ${res2.statusCode}`);
            
            let str = '';
            res2.on('data', d => {
                str += d.toString();
            });

            res2.on('end', () => {
                try {
                    console.log('Raw response from Autodesk:', str);
                    let json = JSON.parse(str);
                    console.log('Parsed response:', json);
                    res.json(json);
                } catch (e) {
                    console.error('Failed to parse upload URLs response:', e);
                    console.error('Raw response was:', str);
                    res.status(500).json({ error: 'Failed to parse response', raw: str });
                }
            });
        });

        req2.on('error', (e) => {
            console.log(`GET uploadurls error: ${e.message}`);
            res.status(500).json({ error: e.message });
        });

        req2.end();
    } catch (err) {
        console.error('Upload URLs request failed:', err);
        next(err);
    }
});

// Complete upload endpoint
router.post('/dm/uploadurls', express.json(), async function (req, res, next) {
    const query = req.query;
    const bucketName = query.bucketName || APS_BUCKET;
    
    try {
        const accessToken = await getInternalToken();
        
        const options = {
            hostname: 'developer.api.autodesk.com',
            port: 443,
            path: `/oss/v2/buckets/${encodeURIComponent(bucketName)}/objects/${encodeURIComponent(query.objectName)}/signeds3upload`,
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json" 
            },
            method: 'POST'
        };

        const req2 = https.request(options, res2 => {
            console.log(`POST uploadurls statusCode: ${res2.statusCode}`);
            
            let str = '';
            res2.on('data', d => {
                str += d.toString();
            });

            res2.on('end', () => {
                try {
                    let json = JSON.parse(str);
                    res.json(json);
                } catch (e) {
                    console.error('Failed to parse complete upload response:', e);
                    res.status(500).json({ error: 'Failed to parse response' });
                }
            });
        });

        req2.on('error', (e) => {
            console.log(`POST uploadurls error: ${e.message}`);
            res.status(500).json({ error: e.message });
        });

        req2.write(JSON.stringify({
            uploadKey: req.body.uploadKey
        }));
        req2.end();
    } catch (err) {
        next(err);
    }
});

// Translate model endpoint
router.post('/api/models/translate', express.json(), async function (req, res, next) {
    try {
        const { urn, rootFilename } = req.body;
        
        if (!urn) {
            return res.status(400).json({ error: 'URN is required' });
        }

        const result = await translateObject(urn, rootFilename);
        res.json(result);
        
    } catch (err) {
        console.error('Translation failed:', err);
        next(err);
    }
});

module.exports = router;