export class Query {
    constructor(name, conditions, color = null, description = '') {
        this.id = this.generateId();
        this.name = name;
        this.description = description;
        this.conditions = conditions; // The JSON object sent to the filter plugin
        this.isActive = false; // Whether this query is currently applied to the model
        this.color = color || this.getDefaultColor();
        this.createdAt = new Date();
        this.updatedAt = new Date();
        this.externalIds = []; // External IDs from the API response
        this.dbIds = []; // Results from the query execution
    }

    // Generate a unique ID for the query
    generateId() {
        return 'query_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Get a default color from available colors
    getDefaultColor() {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Update the query's color
    setColor(color) {
        this.color = color;
        this.updatedAt = new Date();
    }

    // Update the query's name
    setName(name) {
        this.name = name;
        this.updatedAt = new Date();
    }

    // Update the query's description
    setDescription(description) {
        this.description = description;
        this.updatedAt = new Date();
    }

    // Update the query conditions
    setConditions(conditions) {
        this.conditions = conditions;
        this.updatedAt = new Date();
    }

    // Set the results from query execution
    setResults(dbIds, externalIds = []) {
        this.dbIds = dbIds;
        this.externalIds = externalIds;
        this.updatedAt = new Date();
    }

    // Mark query as active/inactive
    setActive(isActive) {
        this.isActive = isActive;
        this.updatedAt = new Date();
    }

    // Toggle active state
    toggleActive() {
        this.isActive = !this.isActive;
        this.updatedAt = new Date();
    }

    // Get a human-readable summary of the query
    getSummary() {
        const objectCount = this.dbIds.length;
        const objectText = objectCount === 1 ? 'object' : 'objects';
        return `${objectCount} ${objectText} found`;
    }

    // Generate a preview string of the query conditions
    getConditionsPreview() {
        // Transform conditions first to show what will actually be sent to backend
        const transformedConditions = this.transformConditionsForBackend(this.conditions);
        return this.conditionsToString(transformedConditions);
    }

    // Convert conditions to human-readable string (recursive)
    conditionsToString(conditions, indent = 0) {
        const spaces = '  '.repeat(indent);
        
        if (!conditions) {
            return `${spaces}[No conditions]`;
        }

        // Handle single condition shortcut format: { conditions: { category, field, operator, value } }
        if (conditions.conditions && !conditions.logic && !Array.isArray(conditions.conditions)) {
            const condition = conditions.conditions;
            if (condition.category && condition.field && condition.operator && condition.value !== undefined) {
                return `${spaces}${condition.category}.${condition.field} ${condition.operator} "${condition.value}"`;
            }
        }

        // Handle single condition wrapped in conditions object (legacy)
        if (conditions.conditions && !conditions.logic && Array.isArray(conditions.conditions) && conditions.conditions.length === 1) {
            return this.conditionsToString(conditions.conditions[0], indent);
        }

        // Handle single condition object directly
        if (conditions.category && conditions.field && conditions.operator && conditions.value !== undefined) {
            return `${spaces}${conditions.category}.${conditions.field} ${conditions.operator} "${conditions.value}"`;
        }

        // Handle group with logic and multiple conditions
        if (conditions.logic && conditions.conditions && Array.isArray(conditions.conditions)) {
            const conditionsStr = conditions.conditions
                .map(condition => this.conditionsToString(condition, indent + 1))
                .join(`\n${spaces}${conditions.logic}\n`);
            return `${spaces}(\n${conditionsStr}\n${spaces})`;
        }

        // Handle array of conditions (transform to AND group)
        if (Array.isArray(conditions)) {
            if (conditions.length === 1) {
                // For consistency, wrap single conditions in brackets too
                const condition = this.conditionsToString(conditions[0], indent + 1);
                return `${spaces}(\n${condition}\n${spaces})`;
            } else if (conditions.length > 1) {
                const conditionsStr = conditions
                    .map(condition => this.conditionsToString(condition, indent + 1))
                    .join(`\n${spaces}AND\n`);
                return `${spaces}(\n${conditionsStr}\n${spaces})`;
            }
        }

        return `${spaces}[Invalid condition structure]`;
    }

    // Convert query to CSV format (single row)
    toCSVRow() {
        // Helper to escape CSV field values
        const escapeCsv = (value) => {
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        };
        
        // Convert conditions to JSON string for CSV storage
        const conditionsJson = JSON.stringify(this.conditions);
        
        return [
            escapeCsv(this.id),
            escapeCsv(this.name),
            escapeCsv(this.description),
            escapeCsv(conditionsJson),
            escapeCsv(this.color)
        ].join(',');
    }
    
    // Parse CSV row into Query instance
    static fromCSVRow(csvRow) {
        // Parse CSV, handling quoted fields with commas
        const parseCSVRow = (row) => {
            const result = [];
            let inQuotes = false;
            let currentField = '';
            
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                
                if (char === '"') {
                    if (i + 1 < row.length && row[i + 1] === '"') {
                        // Handle escaped quotes
                        currentField += '"';
                        i++; // Skip next quote
                    } else {
                        // Toggle quote state
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    // End of field
                    result.push(currentField);
                    currentField = '';
                } else {
                    // Normal character
                    currentField += char;
                }
            }
            
            // Add the last field
            result.push(currentField);
            return result;
        };
        
        try {
            // Parse the CSV row
            const [id, name, description, conditionsJson, color] = parseCSVRow(csvRow);
            
            // Parse conditions from JSON
            const conditions = JSON.parse(conditionsJson);
            
            // Create new query object
            const query = new Query(name, conditions, color, description);
            query.id = id;
            
            return query;
        } catch (error) {
            console.error('Error parsing CSV row:', error);
            throw new Error(`Failed to parse query from CSV: ${error.message}`);
        }
    }

    // Export query to JSON (for saving/sharing)
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            conditions: this.conditions,
            isActive: this.isActive,
            color: this.color,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            externalIds: this.externalIds,
            dbIds: this.dbIds
        };
    }

    // Create a Query instance from JSON (for loading saved queries)
    static fromJSON(jsonData) {
        // Handle conditions that might be a JSON string (from cloud storage)
        let conditions = jsonData.conditions;
        if (typeof conditions === 'string') {
            try {
                conditions = JSON.parse(conditions);
            } catch (error) {
                console.error('Failed to parse conditions JSON string:', error);
                // Fallback to empty conditions if parsing fails
                conditions = {};
            }
        }
        
        const query = new Query(
            jsonData.name,
            conditions,
            jsonData.color,
            jsonData.description
        );
        
        // Restore all properties that exist in the class
        query.id = jsonData.id || query.id;
        query.createdAt = jsonData.createdAt ? new Date(jsonData.createdAt) : query.createdAt;
        query.updatedAt = jsonData.updatedAt ? new Date(jsonData.updatedAt) : query.updatedAt;
        query.dbIds = jsonData.dbIds || [];
        query.externalIds = jsonData.externalIds || [];
        query.isActive = jsonData.isActive || false;
        
        return query;
    }
    
    // Additional methods from previous implementation...
    // Validate that the query has valid conditions
    isValid() {
        return this.name && this.name.trim() !== '' && this.conditions && this.hasValidConditions(this.conditions);
    }

    // Recursively validate conditions structure
    hasValidConditions(conditions) {
        if (!conditions) return false;

        // Handle single condition shortcut format: { conditions: { category, field, operator, value } }
        if (conditions.conditions && !conditions.logic && !Array.isArray(conditions.conditions)) {
            const condition = conditions.conditions;
            return condition.category && condition.field && condition.operator && condition.value !== undefined &&
                   condition.category.trim() !== '' && condition.field.trim() !== '' && condition.operator.trim() !== '';
        }

        // Handle single condition wrapped in conditions object (legacy)
        if (conditions.conditions && !conditions.logic && Array.isArray(conditions.conditions)) {
            return conditions.conditions.length > 0 && 
                   conditions.conditions.every(condition => this.hasValidConditions(condition));
        }

        // Handle single condition object directly
        if (conditions.category && conditions.field && conditions.operator && conditions.value !== undefined) {
            return conditions.category.trim() !== '' && 
                   conditions.field.trim() !== '' && 
                   conditions.operator.trim() !== '';
        }

        // Handle group with logic and conditions
        if (conditions.logic && conditions.conditions && Array.isArray(conditions.conditions)) {
            return conditions.conditions.length > 0 && 
                   conditions.conditions.every(condition => this.hasValidConditions(condition));
        }

        // Handle array of conditions (will be transformed to AND group)
        if (Array.isArray(conditions)) {
            return conditions.length > 0 && 
                   conditions.every(condition => this.hasValidConditions(condition));
        }

        return false;
    }

    // Transform conditions to match backend expected format
    transformConditionsForBackend(conditions) {
        // Handle the case where conditions is already in proper backend format
        if (conditions.logic && conditions.conditions) {
            return conditions;
        }

        // Handle single condition shortcut - if conditions has a conditions property that's an object
        if (conditions.conditions && !Array.isArray(conditions.conditions)) {
            return conditions; // Already in single condition shortcut format
        }

        // Handle array of conditions - check if it's a single condition in an array
        if (Array.isArray(conditions) && conditions.length === 1) {
            const singleCondition = conditions[0];
            // Check if it's a simple condition object (not a nested query)
            if (singleCondition.category && singleCondition.field && singleCondition.operator) {
                // Convert to single condition shortcut format
                return {
                    conditions: singleCondition
                };
            }
        }

        // Handle array of multiple conditions - wrap in AND logic
        if (Array.isArray(conditions) && conditions.length > 1) {
            return {
                logic: "AND",
                conditions: conditions
            };
        }

        // Handle single condition object directly
        if (conditions.category && conditions.field && conditions.operator) {
            return {
                conditions: conditions
            };
        }

        // Handle conditions wrapped in a conditions property that's an array
        if (conditions.conditions && Array.isArray(conditions.conditions)) {
            if (conditions.conditions.length === 1) {
                const singleCondition = conditions.conditions[0];
                if (singleCondition.category && singleCondition.field && singleCondition.operator) {
                    // Convert to single condition shortcut format
                    return {
                        conditions: singleCondition
                    };
                }
            } else if (conditions.conditions.length > 1) {
                // Multiple conditions - use provided logic or default to AND
                return {
                    logic: conditions.logic || "AND",
                    conditions: conditions.conditions
                };
            }
        }

        // Fallback - return as is
        return conditions;
    }

    // Perform the actual query execution against the API
    async performQuery(apiEndpoint = 'http://localhost:8082/api/query') {
        if (!this.isValid()) {
            throw new Error('Cannot perform query: Invalid query structure');
        }

        // Transform conditions to match backend expected format
        const queryPayload = this.transformConditionsForBackend(this.conditions);
        
        console.log(`Performing query "${this.name}":`, JSON.stringify(queryPayload, null, 2));

        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(queryPayload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            let result;
            try {
                result = await response.json();
            } catch (parseError) {
                throw new Error(`Failed to parse API response as JSON: ${parseError.message}`);
            }
            
            console.log(`API response for query "${this.name}":`, result);
            
            if (result && result.success) {
                // Store the external IDs from the API response
                this.externalIds = result.dbIds || [];
                this.updatedAt = new Date();
                
                // Convert external IDs to viewer dbIds if viewer is available
                if (this.externalIds.length > 0 && window.viewer && window.viewer.model) {
                    await this.convertExternalIdsToDbIds();
                } else {
                    this.dbIds = [];
                }
                
                // Mark as active since query was successful
                this.setActive(true);
                // this.isolate();
                // this.show();

                return {
                    success: true,
                    externalIds: this.externalIds,
                    dbIds: this.dbIds,
                    message: `Found ${this.dbIds.length} objects in the model`
                };
                
            } else {
                return {
                    success: false,
                    error: (result && result.error) || 'Query execution failed - invalid response format',
                    externalIds: [],
                    dbIds: []
                };
            }
        } catch (error) {
            console.error(`Query execution error for "${this.name}":`, error);
            return {
                success: false,
                error: `Request failed: ${error.message}`,
                externalIds: [],
                dbIds: []
            };
        }
    }

    isolate(allDbIds = null){
        if (!window.viewer || !window.viewer.model) {
            console.warn('Viewer or model not available for isolation');
            return;
        }

        // Use provided allDbIds or fall back to this query's dbIds
        const dbIdsToIsolate = allDbIds || this.dbIds;

        // Isolate the objects in the viewer
        window.viewer.isolate(dbIdsToIsolate);
        window.viewer.fitToView(dbIdsToIsolate);
        
        // Apply theming color to this query's objects (not all objects)
        console.log(`Isolating ${dbIdsToIsolate.length} objects for query "${this.name}"`);
        if (this.dbIds.length > 0 && this.color) {
            // Create THREE.Color object from hex color string
            const threeColor = new window.THREE.Color(this.color);
            
            // Convert to Vector4 (r, g, b, intensity) - all values in [0,1]
            const colorVector = new window.THREE.Vector4(threeColor.r, threeColor.g, threeColor.b, 0.8);
            
            // Apply theming color to each object in this query
            this.dbIds.forEach(dbId => {
                window.viewer.setThemingColor(dbId, colorVector, window.viewer.model, true);
            });
            
            console.log(`Isolated ${dbIdsToIsolate.length} total objects and themed ${this.dbIds.length} objects with color ${this.color} for query "${this.name}"`);
        } else if (this.dbIds.length > 0) {
            console.log(`Isolated ${dbIdsToIsolate.length} total objects for query "${this.name}"`);
        } else {
            console.log(`Isolated ${dbIdsToIsolate.length} objects in the viewer`);
        }
    }

    // // Show query results with theming colors (without isolation)
    // show() {
    //     if (!window.viewer || !window.viewer.model) {
    //         console.warn('Viewer or model not available for showing query');
    //         return;
    //     }

    //     if (this.dbIds.length === 0) {
    //         console.warn('No objects to show for this query');
    //         return;
    //     }

    //     // Apply theming color to the objects
    //     if (this.color) {
    //         // Create THREE.Color object from hex color string
    //         const threeColor = new window.THREE.Color(this.color);
            
    //         // Convert to Vector4 (r, g, b, intensity) - all values in [0,1]
    //         const colorVector = new window.THREE.Vector4(threeColor.r, threeColor.g, threeColor.b, 0.8);
            
    //         // Apply theming color to each object
    //         this.dbIds.forEach(dbId => {
    //             window.viewer.setThemingColor(dbId, colorVector, window.viewer.model, true);
    //         });
            
    //         console.log(`Applied theming color ${this.color} to ${this.dbIds.length} objects for query "${this.name}"`);
    //     }
        
    //     this.setActive(true);
    // }

    // Hide query results by clearing theming colors
    hide() {
        if (!window.viewer || !window.viewer.model) {
            console.warn('Viewer or model not available for hiding query');
            return;
        }

        if (this.dbIds.length === 0) {
            console.warn('No objects to hide for this query');
            this.setActive(false);
            return;
        }

        console.log(`Hiding query "${this.name}" by clearing theming colors`);

        // Clear theming color from all dbIds for this query by setting color to null
        this.dbIds.forEach(dbId => {
            window.viewer.setThemingColor(dbId, null, window.viewer.model);
        });

        this.setActive(false);
    }

    // Convert external IDs to viewer database IDs
    async convertExternalIdsToDbIds() {
        return new Promise((resolve) => {
            if (!window.viewer || !window.viewer.model) {
                this.dbIds = [];
                resolve();
                return;
            }

            window.viewer.model.getExternalIdMapping((externalIdMap) => {
                // Map external IDs to internal dbIds
                this.dbIds = this.externalIds
                    .map(externalId => externalIdMap[externalId])
                    .filter(dbId => dbId !== undefined);
                
                this.updatedAt = new Date();
                resolve();
            });
        });
    }
}