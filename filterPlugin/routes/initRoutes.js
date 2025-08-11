const express = require('express');
const router = express.Router();
const { setup, getAllCategoriesAndFields } = require('../services/modelDataService');

/**
 * Setup model data endpoint
 * Sets up model data and categories using the new setup method
 * 
 * @route POST /api/init/setup
 * @param {string} urn - The URN of the model
 * @param {string} guid - The GUID to use for data retrieval
 * @returns {Object} Success status and setup details
 */
router.post('/setup', async (req, res) => {
  try {
    const { urn, guid } = req.body;
    
    // Validate required parameters
    if (!urn || !guid) {
      return res.status(400).json({
        success: false,
        error: 'Both URN and GUID are required'
      });
    }

    console.log(`Setting up model data for URN: ${urn} with GUID: ${guid}`);

    // Call the new setup function
    const result = await setup(urn, guid);

    return res.json({
      success: true,
      message: result.message,
      data: {
        urn: urn,
        guid: guid,
        itemCount: result.itemCount,
        categories: result.categories,
        usingFallback: result.usingFallback || false
      }
    });
  } catch (error) {
    console.error('Failed to setup model data:', error);
    
    // Provide detailed error information
    let errorMessage = error.message || 'Failed to setup model data';
    let statusCode = 500;
    
    if (error.response) {
      statusCode = error.response.status;
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      if (error.response.status === 404) {
        errorMessage = 'Model or GUID not found. Please verify the URN and GUID are correct.';
      } else if (error.response.status === 401) {
        errorMessage = 'Authentication failed. Please check your credentials.';
      } else if (error.response.status === 403) {
        errorMessage = 'Access forbidden. Please check your permissions for this model.';
      }
    } else if (error.request) {
      errorMessage = 'Network error. Please check your connection and try again.';
    }
    
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        originalError: error.message,
        stack: error.stack
      } : undefined
    });
  }
});



module.exports = router;