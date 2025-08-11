const { AuthenticationClient, Scopes } = require('@aps_sdk/authentication');
const { OssClient, Region, PolicyKey } = require('@aps_sdk/oss');
const { ModelDerivativeClient, View, OutputType } = require('@aps_sdk/model-derivative');
const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_BUCKET } = require('../config.js');

const authenticationClient = new AuthenticationClient();
const ossClient = new OssClient();
const modelDerivativeClient = new ModelDerivativeClient();



const service = module.exports = {};

service.getInternalToken = async () => {
    const credentials = await authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [
        Scopes.DataRead,
        Scopes.DataCreate,
        Scopes.DataWrite,
        Scopes.BucketCreate,
        Scopes.BucketRead
    ]);
    return credentials.access_token;
}

service.getViewerToken = async () => {
    return await authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [Scopes.ViewablesRead]);
};

service.ensureBucketExists = async (bucketKey) => {
    const accessToken = await service.getInternalToken();
    try {
        await ossClient.getBucketDetails(bucketKey, { accessToken });
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            await ossClient.createBucket(Region.Emea, { bucketKey: bucketKey, policyKey: PolicyKey.Temporary }, { accessToken});
        } else {
            throw err;  
        }
    }
};

service.listObjects = async () => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await service.getInternalToken();
    let resp = await ossClient.getObjects(APS_BUCKET, { limit: 64, accessToken });
    let objects = resp.items;
    while (resp.next) {
        const startAt = new URL(resp.next).searchParams.get('startAt');
        resp = await ossClient.getObjects(APS_BUCKET, { limit: 64, startAt, accessToken });
        objects = objects.concat(resp.items);
    }
    
    // Fetch detailed information including policy key for each object
    const detailedObjects = await Promise.all(
    objects.map(async (obj) => {
        try {
        console.log(`Fetching details for object: ${obj.objectId}`);
        const objectDetails = await ossClient.getObjectDetails(APS_BUCKET, obj.objectKey, { accessToken, _with: ['createdDate'] });

        return {
            name: obj.objectKey,
            urn: Buffer.from(obj.objectId).toString('base64'),
            size: objectDetails.size || null,
            createdDate: new Date(objectDetails.createdDate).toDateString() || null,
        }
        } catch (err) {
                console.warn(`Could not fetch details for object ${obj.objectKey}:`, err.message);
                // Return object without policy key if details fetch fails
                return {
                    ...obj,
                };
            }
        })
    );
    
    return detailedObjects;
};

service.uploadObject = async (objectName, filePath) => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await service.getInternalToken();
    const fs = require('fs');
    const https = require('https');

    try {
        // Get file size to determine number of parts
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;

        // Decide on number of parts (for example, 2MB per part)
        const partSizeThreshold = 2 * 1024 * 1024; // 2MB in bytes
        const numParts = Math.ceil(fileSize / partSizeThreshold);
        
        // Step 1: Get signed URLs for upload
        const uploadUrlsResponse = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'developer.api.autodesk.com',
                port: 443,
                path: `/oss/v2/buckets/${encodeURIComponent(APS_BUCKET)}/objects/${encodeURIComponent(objectName)}/signeds3upload?parts=${numParts}&firstPart=1`,
                headers: {
                    Authorization: `Bearer ${accessToken}`
                },
                method: 'GET'
            };

            const req = https.request(options, res => {
                console.log(`GET uploadurls statusCode: ${res.statusCode}`);
                
                let str = '';
                res.on('data', d => {
                    str += d.toString();
                });

                res.on('end', () => {
                    try {
                        const json = JSON.parse(str);
                        resolve(json);
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                });
            });

            req.on('error', (e) => {
                console.log(`GET uploadurls error: ${e.message}`);
                reject(e);
            });

            req.end();
        });
        
        const { uploadKey, urls } = uploadUrlsResponse;
        
        // Step 2: Upload parts using signed URLs
        const uploadPromises = [];
        
        for (let i = 0; i < numParts; i++) {
            const start = i * partSizeThreshold;
            const end = Math.min(start + partSizeThreshold, fileSize) - 1;
            
            const filePartBuffer = fs.readFileSync(filePath, { start, end });
            
            const uploadPromise = new Promise((resolve, reject) => {
                const url = new URL(urls[i]);
                const options = {
                    hostname: url.hostname,
                    port: url.port || (url.protocol === 'https:' ? 443 : 80),
                    path: url.pathname + url.search,
                    method: 'PUT',
                    headers: {
                        'Content-Length': filePartBuffer.length
                    }
                };

                const req = https.request(options, res => {
                    let str = '';
                    res.on('data', d => {
                        str += d.toString();
                    });

                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({ etag: res.headers.etag, partNumber: i + 1 });
                        } else {
                            reject(new Error(`Upload part ${i + 1} failed with status ${res.statusCode}: ${str}`));
                        }
                    });
                });

                req.on('error', (e) => {
                    reject(new Error(`Upload part ${i + 1} error: ${e.message}`));
                });

                req.write(filePartBuffer);
                req.end();
            });
            
            uploadPromises.push(uploadPromise);
        }
        
        const uploadResults = await Promise.all(uploadPromises);
        
        // Step 3: Complete the upload
        const completeResponse = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'developer.api.autodesk.com',
                port: 443,
                path: `/oss/v2/buckets/${encodeURIComponent(APS_BUCKET)}/objects/${encodeURIComponent(objectName)}/signeds3upload`,
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json" 
                },
                method: 'POST'
            };

            const req = https.request(options, res => {
                console.log(`POST uploadurls statusCode: ${res.statusCode}`);
                
                let str = '';
                res.on('data', d => {
                    str += d.toString();
                });

                res.on('end', () => {
                    try {
                        const json = JSON.parse(str);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(json);
                        } else {
                            reject(new Error(`Complete upload failed with status ${res.statusCode}: ${str}`));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse complete response: ${e.message}`));
                    }
                });
            });

            req.on('error', (e) => {
                console.log(`POST uploadurls error: ${e.message}`);
                reject(e);
            });

            const completeBody = JSON.stringify({
                uploadKey: uploadKey,
                parts: uploadResults.map(result => ({
                    partNumber: result.partNumber,
                    etag: result.etag.replace(/"/g, '') // Remove quotes from ETag
                }))
            });

            req.write(completeBody);
            req.end();
        });
        
        return completeResponse;
    } catch (error) {
        console.error('Error uploading file:', error.message);
        throw error;
    }
};

service.uploadObject2 = async (objectName, filePath) => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await service.getInternalToken();
    const obj = await ossClient.uploadObject(APS_BUCKET, objectName, filePath, { accessToken });
    return obj;
}



service.translateObject = async (urn, rootFilename) => {
    const accessToken = await service.getInternalToken();
    
    // Start translation job
    const job = await modelDerivativeClient.startJob({
        input: {
            urn,
            compressedUrn: !!rootFilename,
            rootFilename
        },
        output: {
            formats: [{
                views: [View._2d, View._3d],
                type: OutputType.Svf2
            }]
        }
    }, { accessToken });
    
    return job.result;
};

service.getManifest = async (urn) => {
    const accessToken = await service.getInternalToken();
    try {
        const manifest = await modelDerivativeClient.getManifest(urn, { accessToken });
        return manifest;
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            return null;
        } else {
            throw err;
        }
    }
};

service.urnify = (id) => Buffer.from(id).toString('base64').replace(/=/g, '');

service.getBucketKeyObjectName = (objectId) => {
    // the objectId comes in the form of
    // urn:adsk.objects:os.object:BUCKET_KEY/OBJECT_NAME
    var objectIdParams = objectId.split('/');
    var objectNameValue = objectIdParams[objectIdParams.length - 1];
    // then split again by :
    var bucketKeyParams = objectIdParams[objectIdParams.length - 2].split(':');
    // and get the BucketKey
    var bucketKeyValue = bucketKeyParams[bucketKeyParams.length - 1];

    var ret = {
        bucketKey: decodeURIComponent(bucketKeyValue),
        objectName: decodeURIComponent(objectNameValue)
    };

    return ret;
};