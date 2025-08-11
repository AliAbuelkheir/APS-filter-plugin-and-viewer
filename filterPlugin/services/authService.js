const { AuthenticationClient, Scopes } = require('@aps_sdk/authentication');
const path = require('path');

// Load .env from the project root or specific location
require('dotenv').config({ 
    path: path.join(__dirname, '../.env') // Looks for .env in filterPlugin folder
});
const { APS_CLIENT_ID, APS_CLIENT_SECRET } = process.env;

const authenticationClient = new AuthenticationClient();

const auth = module.exports = {};


// Add validation
if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    throw new Error('APS_CLIENT_ID and APS_CLIENT_SECRET must be set in environment variables');
}

auth.getInternalToken = async () => {
    const credentials = await authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [
        Scopes.DataRead,
        Scopes.DataCreate,
        Scopes.DataWrite,
        Scopes.BucketCreate,
        Scopes.BucketRead
    ]);
    return credentials.access_token;
}