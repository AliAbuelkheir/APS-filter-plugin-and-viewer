const path = require('path');

// Load .env from the same directory as this config file
require('dotenv').config({ 
    path: path.join(__dirname, '.env') 
});

let { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_BUCKET, PORT } = process.env;
if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    console.warn('Missing some of the environment variables.');
    process.exit(1);
}
APS_BUCKET = APS_BUCKET || `${APS_CLIENT_ID.toLowerCase()}-basic-app`;
PORT = PORT || 8080;

const FRONTEND_PATH = path.join(__dirname, '../frontend');

module.exports = {
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    APS_BUCKET,
    PORT,
    FRONTEND_PATH
};