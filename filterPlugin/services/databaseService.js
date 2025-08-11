const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aps-filter-plugin';

let isConnected = false;

async function connectToDatabase() {
    if (isConnected) {
        return;
    }

    try {
        await mongoose.connect(MONGODB_URI, {
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });
        
        isConnected = true;
        console.log('Connected to MongoDB successfully');
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
            isConnected = false;
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
            isConnected = false;
        });
        
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        throw error;
    }
}

async function disconnectFromDatabase() {
    if (isConnected) {
        await mongoose.disconnect();
        isConnected = false;
        console.log('Disconnected from MongoDB');
    }
}

function isConnectedToDatabase() {
    return isConnected;
}

module.exports = {
    connectToDatabase,
    disconnectFromDatabase,
    isConnectedToDatabase
};