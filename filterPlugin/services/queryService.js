const { getModelData } = require('./modelDataService');

let _modelDataItems = [];

async function executeQuery(requestBody) {
    try {
        console.log('Executing query with request body:', requestBody);

        // Handle undefined or null request body
        if (!requestBody) {
            throw new Error('Request body is missing or empty');
        }
        
        // The requestBody IS the query object
        let query = requestBody;

        //populate model data
        if (_modelDataItems.length === 0) {
            const modelData = getModelData();
            if (!modelData || modelData.length === 0) {
                throw new Error('Model data is empty or not initialized');
            }
            _modelDataItems = modelData;
        }
        // Execute the query to get matching DB IDs
        const matchingDbIds = evaluateQueryOnModel(query);
        
        console.log(`Found ${matchingDbIds.length} matching elements`);
        
        // Return the filtered DB IDs
        return {
            success: true,
            dbIds: matchingDbIds,
            message: 'Query executed successfully',
            count: matchingDbIds.length
        };
    } catch (error) {
        console.error('Error in executeQuery:', error);
        return {
            success: false,
            error: error.message,
            dbIds: []
        };
    }
}

/**
 * Evaluates a query on the model data and returns matching dbIds
 * @param {Object} query - The query object with logic and conditions
 * @returns {Array} - Array of dbIds that match the query
 */
function evaluateQueryOnModel(query) {
    console.log('Query structure received:', JSON.stringify(query, null, 2));

    if (!_modelDataItems || _modelDataItems.length === 0) {
        console.error('Model data is empty or not initialized');
        return [];
    }

    // Single condition case - handle both object format and single-element array
    if (query.conditions && !query.logic) {
        // If conditions is an object (not array) OR if it's an array with exactly one element
        if (!Array.isArray(query.conditions) || query.conditions.length === 1) {
            return evaluateSingleCondition(query);
        }
    }

    // Process the query recursively
    if (query.logic === 'AND') {
        return evaluateAndQuery(query);
    } else if (query.logic === 'OR') {
        return evaluateOrQuery(query);
    } else {
        // Default to AND if no logic specified but conditions is an array
        console.log('No logic specified, defaulting to AND');
        return evaluateAndQuery(query);
    }
}

/**
 * Evaluates a single condition query
 * @param {Object} query - The single condition query
 * @returns {Array} - Array of dbIds that match the condition
 */
function evaluateSingleCondition(query) {
    // Handle both object and array formats for single conditions
    let condition;
    
    if (Array.isArray(query.conditions)) {
        // If it's an array, take the first element
        condition = query.conditions[0];
    } else {
        // If it's an object, use it directly
        condition = query.conditions;
    }
    
    // Ensure this is a valid condition
    if (!condition || !condition.category || !condition.field || !condition.operator || !('value' in condition)) {
        console.error('Invalid single condition:', condition);
        console.error('Full query:', JSON.stringify(query, null, 2));
        return [];
    }
    
    console.log(`Evaluating single condition: ${condition.category}.${condition.field} ${condition.operator} ${condition.value}`);
    
    const matchingIds = evaluateConditionOnModel(condition);
    
    console.log(`Single condition matched ${matchingIds.length} items`);
    return matchingIds;
}

/**
 * Evaluates an AND query
 * @param {Object} query - The query with AND logic
 * @returns {Array} - Array of dbIds that match all conditions
 */
function evaluateAndQuery(query) {
    // Start with all dbIds
    let resultIds = _modelDataItems.map(item => item.externalId);
    
    // Apply each condition to filter the results
    for (const condition of query.conditions) {
        if (resultIds.length === 0) {
            // Short circuit if we've eliminated all results
            break;
        }
        
        if (condition.logic && condition.conditions) {
            // For nested queries, recursively evaluate
            const nestedIds = condition.logic === 'AND' ? 
                evaluateAndQuery(condition) : evaluateOrQuery(condition);
            
            // Keep only IDs that are in both sets
            resultIds = resultIds.filter(id => nestedIds.includes(id));
        } else {
            // For simple conditions, filter the current result set
            const matchingIds = evaluateConditionOnModel(condition);
            resultIds = resultIds.filter(id => matchingIds.includes(id));
        }
    }
    
    return resultIds;
}

/**
 * Evaluates an OR query
 * @param {Object} query - The query with OR logic
 * @returns {Array} - Array of dbIds that match any condition
 */
function evaluateOrQuery(query) {
    // Use a Set to collect unique IDs
    const resultIds = new Set();
    
    // Process each condition
    for (const condition of query.conditions) {
        if (condition.logic && condition.conditions) {
            // For nested queries, recursively evaluate
            const nestedIds = condition.logic === 'AND' ? 
                evaluateAndQuery(condition) : evaluateOrQuery(condition);
            
            // Add all IDs to the result set
            nestedIds.forEach(id => resultIds.add(id));
        } else {
            // For simple conditions, add matching IDs to the result set
            const matchingIds = evaluateConditionOnModel(condition);
            matchingIds.forEach(id => resultIds.add(id));
        }
    }
    
    return Array.from(resultIds);
}

/**
 * Evaluates a single condition against the entire model
 * @param {Object} condition - The condition object
 * @returns {Array} - Array of dbIds that match the condition
 */
function evaluateConditionOnModel(condition) {
    // Ensure this is a valid condition
    if (!condition.category || !condition.field || !condition.operator || !('value' in condition)) {
        console.error('Invalid condition:', condition);
        return [];
    }
    
    console.log(`Evaluating condition: ${condition.category}.${condition.field} ${condition.operator} ${condition.value}`);
    
    const matchingIds = [];
    
    // Iterate through all model items for this condition
    console.log(`Checking ${_modelDataItems.length} items`);
    for (const item of _modelDataItems) {
        const propertyValue = findPropertyValue(item.properties, condition.category, condition.field);
        
        if (evaluatePropertyValue(propertyValue, condition.operator, condition.value)) {
            matchingIds.push(item.externalId);
            // Debug: Print successful matches
            console.log(`✓ MATCH FOUND - ExternalID: ${item.externalId}, Name: "${item.name}", Property Value: "${propertyValue}", Test Value: "${condition.value}", Operator: ${condition.operator}`);
        }
    }
    
    console.log(`Condition matched ${matchingIds.length} items`);
    return matchingIds;
}

/**
 * Evaluates a property value against an operator and test value
 * @param {*} propertyValue - The property value to test
 * @param {string} operator - The comparison operator
 * @param {*} testValue - The value to compare against
 * @returns {boolean} - Whether the property matches the condition
 */
function evaluatePropertyValue(propertyValue, operator, testValue) {
    // If property not found, return false
    if (propertyValue === undefined || propertyValue === null) {
        return false;
    }

    // Try to interpret both as numbers
    const propNum = parseFloat(propertyValue);
    const testNum = parseFloat(testValue);
    const bothAreNumbers = !isNaN(propNum) && !isNaN(testNum);

    // Normalize string values
    const stringPropertyValue = String(propertyValue).toLowerCase();
    const stringTestValue = String(testValue).toLowerCase();

    switch (operator) {
        case 'contains':
            return stringPropertyValue.includes(stringTestValue);

        case 'does_not_contain':
            return !stringPropertyValue.includes(stringTestValue);

        case 'starts_with':
            return stringPropertyValue.startsWith(stringTestValue);

        case 'equals':
            return stringPropertyValue === stringTestValue || 
                   (bothAreNumbers && propNum === testNum);

        case 'greater_than':
            return bothAreNumbers && propNum > testNum;

        case 'less_than':
            return bothAreNumbers && propNum < testNum;

        case 'greater_than_or_equal':
            return bothAreNumbers && propNum >= testNum;

        case 'less_than_or_equal':
            return bothAreNumbers && propNum <= testNum;

        default:
            return false;
    }
}


/**
 * Finds a property value in an item's properties
 * @param {Array} properties - The properties array from the model item
 * @param {string} category - The property category to look for
 * @param {string} field - The property field name to look for
 * @returns {*} - The property value or undefined if not found
 */
function findPropertyValue(properties, category, field) {
    if (!properties) return undefined;
    
    if (properties[category] && field in properties[category]) {
        return properties[category][field];
    }
    return undefined;
}

module.exports = {
    executeQuery
};