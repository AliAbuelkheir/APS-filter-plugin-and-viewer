const SavedQuery = require('../models/SavedQuery');
const { connectToDatabase } = require('./databaseService');

async function getAllSavedQueries() {
    await connectToDatabase();
    
    try {
        const queries = await SavedQuery.find()
            .sort({ createdAt: -1 }) // Sort by newest first
            .lean(); // Return plain JavaScript objects instead of Mongoose documents
        
        return queries;
    } catch (error) {
        console.error('Error fetching saved queries:', error);
        throw new Error('Failed to fetch saved queries');
    }
}

async function saveQuery(id, name, query, createdBy = 'anonymous') {
    await connectToDatabase();
    
    try {
        // Check if a query with this ID already exists
        const existingQueryById = await SavedQuery.findById(id);
        if (existingQueryById) {
            throw new Error(`A query with the ID "${id}" already exists`);
        }
        
        // Check if a query with this name already exists
        const existingQuery = await SavedQuery.findOne({ name: name.trim() });
        
        if (existingQuery) {
            throw new Error(`A query with the name "${name}" already exists`);
        }
        
        const savedQuery = new SavedQuery({
            _id: id,
            name: name.trim(),
            query: query,
            createdBy: createdBy
        });
        
        const result = await savedQuery.save();
        console.log(`Saved query "${name}" with ID "${id}" successfully`);
        
        return result.toObject();
    } catch (error) {
        console.error('Error saving query:', error);
        throw error;
    }
}

async function updateQuery(id, updates) {
    await connectToDatabase();
    
    try {
        const updatedQuery = await SavedQuery.findByIdAndUpdate(
            id,
            { ...updates, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        
        if (!updatedQuery) {
            throw new Error('Query not found');
        }
        
        return updatedQuery.toObject();
    } catch (error) {
        console.error('Error updating query:', error);
        throw error;
    }
}

async function deleteQuery(id) {
    await connectToDatabase();
    
    try {
        const deletedQuery = await SavedQuery.findByIdAndDelete(id);
        
        if (!deletedQuery) {
            throw new Error('Query not found');
        }
        
        console.log(`Deleted query "${deletedQuery.name}" successfully`);
        return deletedQuery.toObject();
    } catch (error) {
        console.error('Error deleting query:', error);
        throw error;
    }
}

async function getQueryById(id) {
    await connectToDatabase();
    
    try {
        const query = await SavedQuery.findById(id).lean();
        
        if (!query) {
            throw new Error('Query not found');
        }
        
        return query;
    } catch (error) {
        console.error('Error fetching query by ID:', error);
        throw error;
    }
}

module.exports = {
    getAllSavedQueries,
    saveQuery,
    updateQuery,
    deleteQuery,
    getQueryById
};