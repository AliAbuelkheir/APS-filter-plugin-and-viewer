const auth = require('./authService.js');
const axios = require('axios');

let modelData = [];
let categoriesMap = {};
let guid; // Add missing guid declaration

const FakeModelData = [
  // Basic matching string
  {
    objectid: 1,
    name: "Wall A",
    externalId: "ext-001",
    properties: {
      Constraints: { Level: "Level 1" },
      Dimensions: { Area: "12.5 m^2", Volume: "4.0 m^3" },
    }
  },

  // Basic numeric comparison
  {
    objectid: 2,
    name: "Floor B",
    externalId: "ext-002",
    properties: {
      Constraints: { Level: "Level 2" },
      Dimensions: { Area: "25.0 m^2", Volume: "10.0 m^3" },
    }
  },

  // contains operator
  {
    objectid: 3,
    name: "Window C",
    externalId: "ext-003",
    properties: {
      Constraints: { Level: "Level 1 - South" },
      Dimensions: { Area: "9.5 m^2" },
    }
  },

  // missing category
  {
    objectid: 4,
    name: "Door D",
    externalId: "ext-004",
    properties: {
      Dimensions: { Area: "4.5 m^2" }
    }
  },

  // missing field in existing category
  {
    objectid: 5,
    name: "Roof E",
    externalId: "ext-005",
    properties: {
      Constraints: { },
      Dimensions: { Volume: "7.2 m^3" }
    }
  },

  // Nested property + numeric less than
  {
    objectid: 6,
    name: "Wall F",
    externalId: "ext-006",
    properties: {
      Constraints: { Level: "Level 3" },
      Dimensions: { Area: "5.0 m^2" }
    }
  },

  // Case sensitivity test
  {
    objectid: 7,
    name: "Beam G",
    externalId: "ext-007",
    properties: {
      Constraints: { Level: "LEVEL 1" },
      Dimensions: { Area: "10.0 m^2" }
    }
  },

  // Null value
  {
    objectid: 8,
    name: "Ceiling H",
    externalId: "ext-008",
    properties: {
      Constraints: { Level: null },
      Dimensions: { Area: "15.0 m^2" }
    }
  },

  // Empty string
  {
    objectid: 9,
    name: "Floor I",
    externalId: "ext-009",
    properties: {
      Constraints: { Level: "" },
      Dimensions: { Area: "" }
    }
  },

  // Unexpected type: string "20.0" used for comparison
  {
    objectid: 10,
    name: "Column J",
    externalId: "ext-010",
    properties: {
      Constraints: { Level: "Level 2" },
      Dimensions: { Area: "20.0" } // no units
    }
  },

  // Area as a number
  {
    objectid: 11,
    name: "Slab K",
    externalId: "ext-011",
    properties: {
      Constraints: { Level: "Level 3" },
      Dimensions: { Area: 20.0 }
    }
  },

  // Complex nested AND + OR test target
  {
    objectid: 12,
    name: "Ramp L",
    externalId: "ext-012",
    properties: {
      Constraints: { Level: "Ground Floor" },
      Dimensions: { Area: "50.0 m^2", Volume: "15.0 m^3" }
    }
  },

  // Object with overlapping but different values
  {
    objectid: 13,
    name: "Wall M",
    externalId: "ext-013",
    properties: {
      Constraints: { Level: "Level 1" },
      Dimensions: { Area: "12.5 m^2", Volume: "12.0 m^3" }
    }
  },

  // Object with deeply different values to ensure negative filter test
  {
    objectid: 14,
    name: "Foundation N",
    externalId: "ext-014",
    properties: {
      Constraints: { Level: "Basement" },
      Dimensions: { Area: "100.0 m^2", Volume: "80.0 m^3" }
    }
  },

  // Object with missing Dimensions entirely
  {
    objectid: 15,
    name: "Curtain Wall O",
    externalId: "ext-015",
    properties: {
      Constraints: { Level: "Level 5" }
    }
  }
];

function getModelData() {
    if (!modelData || modelData.length === 0) {
        console.warn('No model data available. Make sure setup() has been called first.');
        return [];
    }
    
    console.log(`Returning model data with ${modelData.length} items`);
    return modelData;
}

// Testing flag controlled by environment or query param
const useTestData = process.env.USE_TEST_DATA === 'true';

// Main setup method - sets up modelData and categoriesMap with provided URN and GUID
async function setup(urn, guid) {
    try {
        console.log(`Setting up model data for URN: ${urn} with GUID: ${guid}`);
        
        // If using test data, skip API calls
        if (useTestData) {
            console.log('Using test data for model setup');
            modelData = [...FakeModelData];
            
            // Build categories map from test data
            categoriesMap = {};
            modelData.forEach(item => {
                const properties = item.properties;
                if (!properties) return;
                
                Object.keys(properties).forEach(categoryKey => {
                    if (!categoriesMap[categoryKey]) {
                        categoriesMap[categoryKey] = new Set();
                    }
                    
                    Object.keys(properties[categoryKey]).forEach(fieldKey => {
                        categoriesMap[categoryKey].add(fieldKey);
                    });
                });
            });
            
            console.log('Test data setup complete:', {
                itemCount: modelData.length,
                categories: Object.keys(categoriesMap)
            });
            
            return {
                success: true,
                itemCount: modelData.length,
                categories: Object.keys(categoriesMap),
                message: `Successfully loaded ${modelData.length} test items with ${Object.keys(categoriesMap).length} categories`
            };
        }
        
        // Get access token for API calls
        const accessToken = await auth.getInternalToken();

        //Approach 1: Use manifest to resolve GUID: https://aps.autodesk.com/en/docs/model-derivative/v2/reference/http/manifest/urn-manifest-GET/
        const manifestResponse = await axios.get(
          `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const manifest = manifestResponse.data;
        //console.log("Full manifest response:", manifest);

        function findMetadataGuid(manifest, viewableGuid) {
          console.log(`[findMetadataGuid] Searching for viewable GUID: ${viewableGuid}`);
          if (!manifest || !manifest.derivatives || !Array.isArray(manifest.derivatives)) {
            console.error('[findMetadataGuid] Invalid manifest or no derivatives found.');
            return null;
          }
          console.log(`[findMetadataGuid] Found ${manifest.derivatives.length} derivatives in manifest.`);
        
          // Recursive function to find if a viewable GUID exists within a node's hierarchy
          function isViewableInNode(node, guid) {
            // Print the guid and role of the current node for debugging
            if (node.guid) {
              console.log(`  - Traversing Node: GUID=${node.guid}, Role=${node.role || 'N/A'}, Type=${node.type}`);
            }

            if (node.guid === guid) {
              return true;
            }
            if (node.children && Array.isArray(node.children)) {
              // Use .some() for an early exit as soon as a match is found
              return node.children.some(child => isViewableInNode(child, guid));
            }
            return false;
          }
        
          for (const derivative of manifest.derivatives) {
            console.log('[findMetadataGuid] Processing derivative:', derivative.name, derivative.outputType);
        
            // Check if the viewable GUID exists anywhere in this derivative's hierarchy
            if (isViewableInNode(derivative, viewableGuid)) {
              console.log(`[findMetadataGuid]   ✅ Found viewable GUID ${viewableGuid} within this derivative.`);
        
              // If the viewable is found, find the property database, which is a direct child of the derivative.
              const metadataNode = derivative.children.find(c => c.role === "Autodesk.CloudPlatform.PropertyDatabase");
        
              if (metadataNode) {
                console.log(`[findMetadataGuid]   ✅ Found associated metadata node. Returning its GUID: ${metadataNode.guid}`);
                return metadataNode.guid;
              } else {
                console.log(`[findMetadataGuid]   ❌ Viewable found, but no associated metadata node in this derivative's direct children.`);
              }
            }
          }
        
          console.log(`[findMetadataGuid] ❌ No derivative found containing both the viewable ${viewableGuid} and a metadata node.`);
          return null;
        }

        const metadataGuid = findMetadataGuid(manifest, guid);
        if (!metadataGuid) {
          console.error(`Could not find metadata GUID for viewable GUID ${guid}`);
          throw new Error(`Unable to resolve metadata GUID from manifest`);
        }

        console.log("✅ Resolved metadata GUID:", metadataGuid);

        // guid = metadataGuid; // Store the resolved GUID for later use

        // Get Available viewable GUIDs from Model Derivative API by URN
        const metadataResponse = await axios.get(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/metadata`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        // console.log('Full metadata response:', JSON.stringify(metadataResponse.data, null, 2));

        console.log('Found', metadataResponse.data.data.metadata.length, 'metadata items');

        const metadataArray = metadataResponse.data.data.metadata;

        console.log('Available GUIDs:', metadataArray.map(item => `${item.guid} (${item.name})`));

        // const guidData = metadataArray.find(item => item.guid === guid);
        // if (!guidData) {
        //     console.error(`GUID ${guid} not found in metadata for URN ${urn}`);
        //     console.error('Available GUIDs:', metadataArray.map(item => `${item.guid} (${item.name})`));
        //     throw new Error(`GUID ${guid} not found in metadata for URN ${urn}. Available GUIDs: ${metadataArray.map(item => `${item.guid} (${item.name})`).join(', ')}`);
        // }

        // console.log(`Found GUID ${guid} in metadata:`);

        const tempGUID = metadataArray.find(item => item.role === '3d')?.guid;

        // Get the model data using the provided GUID
        const modelDataResponse = await axios.get(
            `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/metadata/${tempGUID}/properties`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Model data response status:', modelDataResponse.status);
        console.log('Model data response received:', modelDataResponse.data);

        // Check if the response contains the expected data
        if (!modelDataResponse.data || !modelDataResponse.data.data || !modelDataResponse.data.data.collection) {
            console.error('Invalid response structure:', modelDataResponse.data);
            throw new Error('Invalid response from Model Derivative API - missing collection data');
        }
        
        // Get the response data and store it in the module-level variable
        modelData = modelDataResponse.data.data.collection;
        console.log('Model data initialized with', modelData.length, 'items');
        
        if (modelData.length > 0) {
            console.log('Model data sample:', JSON.stringify(modelData[0], null, 2));
        }
        
        // Reset categoriesMap for fresh initialization
        categoriesMap = {};

        // Process model data to build categories map
        modelData.forEach(item => {
            const properties = item.properties;
            if (!properties) {
                return;
            }
            
            Object.keys(properties).forEach(categoryKey => {
                if (!categoriesMap[categoryKey]) {
                    categoriesMap[categoryKey] = new Set();
                }
                
                // Add all fields for this category
                Object.keys(properties[categoryKey]).forEach(fieldKey => {
                    categoriesMap[categoryKey].add(fieldKey);
                });
            });
        });
        
        console.log('Categories processed:', Object.keys(categoriesMap).length, 'categories found');
        
        return {
            success: true,
            itemCount: modelData.length,
            categories: Object.keys(categoriesMap),
            message: `Successfully loaded ${modelData.length} items with ${Object.keys(categoriesMap).length} categories`
        };
        
    } catch (error) {
        console.error('Error in setup:', error);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            //console.error('Response headers:', error.response.headers);
            console.error('Response data:', error.response.data);
            
            if (error.response.status === 404) {
                // Fallback to test data on 404
                console.warn('Model not found, falling back to test data');
                modelData = [...FakeModelData];
                
                // Build categories map from test data
                categoriesMap = {};
                modelData.forEach(item => {
                    const properties = item.properties;
                    if (!properties) return;
                    
                    Object.keys(properties).forEach(categoryKey => {
                        if (!categoriesMap[categoryKey]) {
                            categoriesMap[categoryKey] = new Set();
                        }
                        
                        Object.keys(properties[categoryKey]).forEach(fieldKey => {
                            categoriesMap[categoryKey].add(fieldKey);
                        });
                    });
                });
                
                return {
                    success: true,
                    itemCount: modelData.length,
                    categories: Object.keys(categoriesMap),
                    message: `Fallback: Using test data with ${modelData.length} items and ${Object.keys(categoriesMap).length} categories`,
                    usingFallback: true
                };
            } else if (error.response.status === 401) {
                throw new Error('Authentication failed. Please check your credentials.');
            } else if (error.response.status === 403) {
                throw new Error('Access forbidden. Please check your permissions for this model.');
            }
        }
        
        throw new Error(`Failed to setup model data: ${error.message}`);
    }
}

// Get all categories and their fields
function getAllCategoriesAndFields() {
    // Convert Sets to sorted Arrays when requested
    const result = {};
    Object.keys(categoriesMap).forEach(category => {
        result[category] = Array.from(categoriesMap[category]).sort();
    });
    return result;
}



module.exports = {
    setup,                      // Main setup method
    getAllCategoriesAndFields, // Get all categories and fields
    getModelData,              // Get model data
};

