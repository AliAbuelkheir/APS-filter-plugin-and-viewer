const express = require('express');
const router = express.Router();
const queryService = require('../services/queryService');
const savedQueryService = require('../services/savedQueryService');
const modelDataService = require('../services/modelDataService');


// Model initialization endpoint
router.post('/initialize', async (req, res) => {
  try {
    const { urn } = req.body;
    
    // Validate URN
    if (!urn) {
      return res.status(400).json({
        success: false,
        error: 'Model URN is required'
      });
    }
    
    console.log(`Initializing model with URN: ${urn}`);
    
    // Call the init function with the provided URN
    await init(urn);
    
    return res.json({
      success: true,
      message: `Model with URN ${urn} initialized successfully`
    });
  } catch (error) {
    console.error('Failed to initialize model:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize model'
    });
  }
});

// Get all saved queries
router.get('/saved', async (req, res) => {
    try {
        const savedQueries = await savedQueryService.getAllSavedQueries();
        
        res.json({
            success: true,
            data: savedQueries,
            count: savedQueries.length
        });
    } catch (err) {
        console.error('Error getting saved queries:', err);
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to get saved queries'
        });
    }
});

// Save a new query
router.post('/saved', async (req, res) => {
    try {
        const { id, name, query, createdBy } = req.body;
        
        if (!id || !name || !query) {
            return res.status(400).json({
                success: false,
                error: 'ID, name and query are required'
            });
        }
        
        const savedQuery = await savedQueryService.saveQuery(id, name, query, createdBy);
        
        res.status(201).json({
            success: true,
            data: savedQuery,
            message: 'Query saved successfully'
        });
    } catch (err) {
        console.error('Error saving query:', err);
        res.status(400).json({
            success: false,
            error: err.message || 'Failed to save query'
        });
    }
});

// Get a specific saved query by ID
router.get('/saved/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = await savedQueryService.getQueryById(id);
        
        res.json({
            success: true,
            data: query
        });
    } catch (err) {
        console.error('Error getting query by ID:', err);
        res.status(404).json({
            success: false,
            error: err.message || 'Query not found'
        });
    }
});

// Update a saved query
router.put('/saved/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const updatedQuery = await savedQueryService.updateQuery(id, updates);
        
        res.json({
            success: true,
            data: updatedQuery,
            message: 'Query updated successfully'
        });
    } catch (err) {
        console.error('Error updating query:', err);
        res.status(400).json({
            success: false,
            error: err.message || 'Failed to update query'
        });
    }
});

// Delete a saved query
router.delete('/saved/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await savedQueryService.deleteQuery(id);
        
        res.json({
            success: true,
            message: 'Query deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting query:', err);
        res.status(404).json({
            success: false,
            error: err.message || 'Failed to delete query'
        });
    }
});

// Execute a query (existing endpoint)
router.post('/', async (req, res) => {
    try {
        const result = await queryService.executeQuery(req.body);
        res.status(200).json(result);
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to execute query',
            dbIds: []
        });
    }
});

// Get categories endpoint (existing)
router.get('/categories', async (req, res) => {
    try {
        // Remove the dropdownService require and use modelDataService directly
        const categoriesAndFields = modelDataService.getAllCategoriesAndFields();
        
        res.json({
            success: true,
            data: categoriesAndFields
        });
    } catch (err) {
        console.error('Error getting categories and fields:', err);
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to get categories and fields'
        });
    }
});

module.exports = router;