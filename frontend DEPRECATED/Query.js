export class Query {
    constructor(name, conditions, color = null, description = '') {
        this.id = this.generateId();
        this.name = name;
        this.conditions = conditions; // The JSON object sent to the filter plugin
        this.color = color || this.getDefaultColor();
        this.description = description;
        this.dateCreated = new Date().toISOString();
        this.dbIds = []; // Results from the query execution
        this.externalIds = []; // External IDs from the API response
        this.isActive = false; // Whether this query is currently applied to the model
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
    }

    // Update the query's name
    setName(name) {
        this.name = name;
        }

    // Update the query's description
    setDescription(description) {
        this.description = description;
    }

    // Update the query conditions
    setConditions(conditions) {
        this.conditions = conditions;
    }

    // Set the results from query execution
    setResults(dbIds, externalIds = []) {
        this.dbIds = dbIds;
        this.externalIds = externalIds;
    }

    // Mark query as active/inactive
    setActive(isActive) {
        this.isActive = isActive;
    }

    // Get a human-readable summary of the query
    getSummary() {
        const objectCount = this.dbIds.length;
        const objectText = objectCount === 1 ? 'object' : 'objects';
        return `${objectCount} ${objectText} found`;
    }

    // Generate a preview string of the query conditions
    getConditionsPreview() {
        return this.conditionsToString(this.conditions);
    }

    // Convert conditions to human-readable string (recursive)
    conditionsToString(conditions, indent = 0) {
        const spaces = '  '.repeat(indent);
        
        if (!conditions) {
            return `${spaces}[No conditions]`;
        }

        // Handle single condition wrapped in conditions object
        if (conditions.conditions && !conditions.logic) {
            return this.conditionsToString(conditions.conditions, indent);
        }

        // Handle single condition object
        if (conditions.category && conditions.field && conditions.operator && conditions.value) {
            return `${spaces}${conditions.category}.${conditions.field} ${conditions.operator} "${conditions.value}"`;
        }

        // Handle group with logic and multiple conditions
        if (conditions.logic && conditions.conditions && Array.isArray(conditions.conditions)) {
            const conditionsStr = conditions.conditions
                .map(condition => this.conditionsToString(condition, indent + 1))
                .join(`\n${spaces}${conditions.logic}\n`);
            return `${spaces}(\n${conditionsStr}\n${spaces})`;
        }

        return `${spaces}[Invalid condition structure]`;
    }

    // Get query statistics
    getStats() {
        return {
            id: this.id,
            name: this.name,
            objectCount: this.dbIds.length,
            color: this.color,
            isActive: this.isActive,
            dateCreated: this.dateCreated
        };
    }

    // Export query to JSON (for saving/sharing)
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            conditions: this.conditions,
            color: this.color,
            description: this.description,
            dateCreated: this.dateCreated,
            dbIds: this.dbIds,
            externalIds: this.externalIds,
            isActive: this.isActive
        };
    }

    // Create a Query instance from JSON (for loading saved queries)
    static fromJSON(jsonData) {
        const query = new Query(
            jsonData.name,
            jsonData.conditions,
            jsonData.color,
            jsonData.description
        );
        
        // Restore all properties that exist in the class
        query.id = jsonData.id || query.id;
        query.dateCreated = jsonData.dateCreated || query.dateCreated;
        query.dbIds = jsonData.dbIds || [];
        query.externalIds = jsonData.externalIds || [];
        query.isActive = jsonData.isActive || false;
        
        return query;
    }

    // Create a copy of the query with a new name
    clone(newName = null) {
        const clonedQuery = new Query(
            newName || `${this.name} (Copy)`,
            JSON.parse(JSON.stringify(this.conditions)), // Deep clone conditions
            this.color,
            this.description
        );
        
        // Copy the execution results if they exist
        clonedQuery.dbIds = [...this.dbIds];
        clonedQuery.externalIds = [...this.externalIds];
        
        return clonedQuery;
    }

    // Validate that the query has valid conditions
    isValid() {
        return this.name && this.name.trim() !== '' && this.conditions && this.hasValidConditions(this.conditions);
    }

    // Recursively validate conditions structure
    hasValidConditions(conditions) {
        if (!conditions) return false;

        // Single condition wrapped in conditions object
        if (conditions.conditions && !conditions.logic) {
            return this.hasValidConditions(conditions.conditions);
        }

        // Single condition object
        if (conditions.category && conditions.field && conditions.operator && conditions.value) {
            return conditions.category.trim() !== '' && 
                   conditions.field.trim() !== '' && 
                   conditions.operator.trim() !== '' && 
                   conditions.value.trim() !== '';
        }

        // Group with logic and conditions
        if (conditions.logic && conditions.conditions && Array.isArray(conditions.conditions)) {
            return conditions.conditions.length > 0 && 
                   conditions.conditions.every(condition => this.hasValidConditions(condition));
        }

        return false;
    }

    // Perform the actual query execution against the API
    async performQuery() {
        if (!this.isValid()) {
            throw new Error('Cannot perform query: Invalid query structure');
        }

        console.log(`Performing query "${this.name}":`, JSON.stringify(this.conditions, null, 2));

        try {
            const response = await fetch('http://localhost:8082/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: this.conditions })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Query API result:', result);
            
            if (result.success) {
                // Store the external IDs from the API response
                this.externalIds = result.dbIds || [];
                
                console.log(`Query "${this.name}" successful: ${this.externalIds.length} external IDs found`);
                
                // Convert external IDs to viewer dbIds if viewer is available
                if (this.externalIds.length > 0 && window.viewer && window.viewer.model) {
                    await this.convertExternalIdsToDbIds();
                } else {
                    this.dbIds = [];
                    console.warn('No viewer available or no external IDs found');
                }
                
                // Mark as active since query was successful
                this.setActive(true);

                return {
                    success: true,
                    externalIds: this.externalIds,
                    dbIds: this.dbIds,
                    message: `Found ${this.dbIds.length} objects in the model`
                };
                
            } else {
                console.error('Query failed:', result.error);
                return {
                    success: false,
                    error: result.error || 'Query execution failed',
                    externalIds: [],
                    dbIds: []
                };
            }
        } catch (error) {
            console.error('Query request failed:', error);
            return {
                success: false,
                error: `Request failed: ${error.message}`,
                externalIds: [],
                dbIds: []
            };
        }
    }

    // Convert external IDs to viewer database IDs
    async convertExternalIdsToDbIds() {
        return new Promise((resolve) => {
            if (!window.viewer || !window.viewer.model) {
                console.warn('Viewer or model not available for external ID conversion');
                this.dbIds = [];
                resolve();
                return;
            }

            window.viewer.model.getExternalIdMapping((externalIdMap) => {
                console.log('Converting external IDs to dbIds for query:', this.name);
                console.log('External IDs to convert:', this.externalIds);
                
                // Map external IDs to internal dbIds
                this.dbIds = this.externalIds
                    .map(externalId => externalIdMap[externalId])
                    .filter(dbId => dbId !== undefined);
                
                console.log(`Converted ${this.externalIds.length} external IDs to ${this.dbIds.length} dbIds`);
                
                if (this.dbIds.length === 0) {
                    console.warn('No matching dbIds found for external IDs in the current model');
                }

                
                //TEMPORARY: Apply color to the dbIds if a color is set
                this.Show();
                
                resolve();
            });
        });
    }

    // Clear query results (useful for re-executing queries)
    clearResults() {
        this.dbIds = [];
        this.externalIds = [];
        this.setActive(false);
    }

    // Re-execute the query (clears previous results first)
    async rePerformQuery() {
        this.clearResults();
        return await this.performQuery();
    }

    Show() {
        if (window.viewer) {
            // Ensure color is a THREE.Color object
            const threeColor = new THREE.Color("#0000ff"); // e.g., '#ff0000'

            console.log(`Showing query "${this.name}" with color ${this.color}`);

            // this.dbIds.forEach(dbId => {
            //     window.viewer.setThemingColor(dbId, threeColor, window.viewer.model);
            // });

            this.dbIds.forEach(dbId => {
                window.viewer.isolate(dbId, true);
            });

            // Refresh the viewer to reflect changes
            window.viewer.impl.invalidate(true, true, true);
            window.viewer.refresh();
        }
    }

    hide() {
        if (!window.viewer) {
            console.warn('Viewer not available. Cannot hide query.');
            return;
        }
        if (this.dbIds.length === 0) {
            // Nothing to hide
            this.setActive(false);
            return;
        }

        console.log(`Hiding query "${this.name}"`);

        // Clear color from all dbIds for this query
        // Note: This resets the color. It does not affect other queries.
        this.dbIds.forEach(dbId => {
            window.viewer.setThemingColor(dbId, null);
        });

        this.setActive(false);
    }
}