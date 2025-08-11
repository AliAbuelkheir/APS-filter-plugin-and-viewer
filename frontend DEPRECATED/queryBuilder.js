import { ToastManager } from './toastManager.js';
import { Query } from './Query.js';

export class QueryBuilder {
    constructor() {
        this.categories = {};
        this.conditionCounter = 0;
        this.groupCounter = 0;
        this.toast = new ToastManager();
        this.currentQueries = new Map(); // Use Map for better performance: id -> Query
        this.init();
    }

    async init() {
        await this.loadCategories();
        this.setupEventListeners();
    }

    async loadCategories() {
        try {
            const response = await fetch('http://localhost:8082/api/query/categories');
            const result = await response.json();
            if (result.success) {
                this.categories = result.data;
                console.log('Categories loaded:', this.categories);
                
                // Refresh any existing category dropdowns
                this.refreshAllCategoryDropdowns();
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('closeQueryPopup').onclick = () => this.hidePopup();
        document.getElementById('exportQueriesBtn').onclick = () => this.exportQueries();
        document.getElementById('addQueryBtn').onclick = () => this.showAddQueryPopup();

        // Close popup when clicking outside
        document.getElementById('queryBuilderPopup').onclick = (e) => {
            if (e.target.id === 'queryBuilderPopup') {
                this.hidePopup();
            }
        };

        // Close add query popup when clicking outside
        document.getElementById('addQueryPopup').onclick = (e) => {
            if (e.target.id === 'addQueryPopup') {
                this.hideAddQueryPopup();
            }
        };

        // Add query popup event listeners
        document.getElementById('closeAddQueryPopup').onclick = () => this.hideAddQueryPopup();
        document.getElementById('confirmAddQueryBtn').onclick = () => this.confirmAddQuery();
        document.getElementById('cancelAddQueryBtn').onclick = () => this.hideAddQueryPopup();
        document.getElementById('importCsvBtn').onclick = () => this.importFromCsv();
        document.getElementById('loadSavedQueryBtn').onclick = () => this.loadFromSaved();
    }

    refreshCurrentQueries() {
        const container = document.getElementById('currentQueriesContainer');
        
        // Check if container exists
        if (!container) {
            console.error('currentQueriesContainer element not found');
            return;
        }
        
        const queriesArray = Array.from(this.currentQueries.values());
        console.log('Refreshing current queries display. Found queries:', queriesArray.length);
        
        if (queriesArray.length === 0) {
            container.innerHTML = `
                <div class="no-queries">
                    <p>No queries currently applied to the model.</p>
                    <p>Click the + button to add your first query.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = queriesArray.map((query) => {
            // Safely get query data with fallbacks
            const queryName = query.name || 'Unnamed Query';
            const querySummary = query.getSummary ? query.getSummary() : `${query.dbIds ? query.dbIds.length : 0} objects`;
            const queryPreview = query.getConditionsPreview ? query.getConditionsPreview() : 'No preview available';
            const isActive = query.isActive || false;
            const queryColor = query.color || '#ff0000';
            const queryId = query.id || 'unknown';
            
            // Truncate preview text
            const truncatedPreview = queryPreview.length > 100 
                ? queryPreview.substring(0, 100) + '...' 
                : queryPreview;
            
            return `
                <div class="query-item" id="query-item-${queryId}">
                    <div class="query-info">
                        <div class="query-name">${queryName}</div>
                        <div class="query-count">${querySummary}</div>
                        <div class="query-preview">${truncatedPreview}</div>
                        <div class="query-status ${isActive ? 'active' : 'inactive'}">
                            ${isActive ? '🟢 Active' : '🔴 Inactive'}
                        </div>
                    </div>
                    <div class="query-controls">
                        <select class="color-selector" onchange="queryBuilder.updateQueryColor('${queryId}', this.value)">
                            <option value="#ff0000" ${queryColor === '#ff0000' ? 'selected' : ''}>🔴 Red</option>
                            <option value="#00ff00" ${queryColor === '#00ff00' ? 'selected' : ''}>🟢 Green</option>
                            <option value="#0000ff" ${queryColor === '#0000ff' ? 'selected' : ''}>🔵 Blue</option>
                            <option value="#ffff00" ${queryColor === '#ffff00' ? 'selected' : ''}>🟡 Yellow</option>
                            <option value="#ff00ff" ${queryColor === '#ff00ff' ? 'selected' : ''}>🟣 Purple</option>
                            <option value="#00ffff" ${queryColor === '#00ffff' ? 'selected' : ''}>🔵 Cyan</option>
                            <option value="#ffa500" ${queryColor === '#ffa500' ? 'selected' : ''}>🟠 Orange</option>
                        </select>
                        <button class="toggle-query-btn" onclick="queryBuilder.toggleQuery('${queryId}')" title="${isActive ? 'Hide Query' : 'Show Query'}">
                            ${isActive ? '👁️' : '👁️‍🗨️'}
                        </button>
                        <button class="refresh-query-btn" onclick="queryBuilder.refreshQuery('${queryId}')" title="Refresh Query">
                            🔄
                        </button>
                        <button class="edit-query-btn" onclick="queryBuilder.editQuery('${queryId}')" title="Edit Query">✏️</button>
                        <button class="delete-query-btn" onclick="queryBuilder.deleteQuery('${queryId}')" title="Delete Query">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log(`Refreshed current queries display: ${queriesArray.length} queries shown`);
    }


    async showPopup() {
        document.getElementById('queryBuilderPopup').classList.remove('hidden');
        
        // Debug current state
        console.log('Showing popup, current queries:', this.currentQueries.size);
        this.debugCurrentQueries();
        
        this.refreshCurrentQueries();
        
        try {
            await this.setupGuid();
        } catch (error) {
            console.error('Error in setupGuid:', error);
            this.toast.warning('Failed to setup GUID. Some features may not work correctly.');
        }
    }

    hidePopup() {
        document.getElementById('queryBuilderPopup').classList.add('hidden');
    }

    async showAddQueryPopup() {
        document.getElementById('addQueryPopup').classList.remove('hidden');
        await this.initializeAddQueryForm();
    }

    hideAddQueryPopup() {
        document.getElementById('addQueryPopup').classList.add('hidden');
        this.clearAddQueryForm();
    }

    async initializeAddQueryForm() {
        const container = document.getElementById('addQueryContainer');
        container.innerHTML = '';
        this.conditionCounter = 0;
        this.groupCounter = 0;
        
        // Ensure categories are loaded before adding the first group
        if (Object.keys(this.categories).length === 0) {
            await this.loadCategories();
        }
        
        this.addGroup();
    }

    clearAddQueryForm() {
        const container = document.getElementById('addQueryContainer');
        container.innerHTML = '';
    }

    // Add a debug method to check current queries
    debugCurrentQueries() {
        console.log('Current Queries Debug:');
        console.log('Map size:', this.currentQueries.size);
        console.log('Map contents:', this.currentQueries);
        
        this.currentQueries.forEach((query, id) => {
            console.log(`Query ${id}:`, {
                name: query.name,
                isActive: query.isActive,
                dbIds: query.dbIds ? query.dbIds.length : 0,
                color: query.color
            });
        });
        
        const container = document.getElementById('currentQueriesContainer');
        console.log('Container exists:', !!container);
        if (container) {
            console.log('Container innerHTML length:', container.innerHTML.length);
        }
    }

    async toggleQuery(queryId) {
        const query = this.currentQueries.get(queryId);
        if (!query) return;

        if (query.isActive) {
            // Hide the query
            this.hideQuery(queryId);
        } else {
            // Show the query - re-execute it
            await this.showQuery(queryId);
        }
    }

    hideQuery(queryId) {
        const query = this.currentQueries.get(queryId);
        if (query && query.isActive) {
            // Remove from color manager
            if (window.colorManager) {
                window.colorManager.removeQuery(queryId);
            }
            
            query.setActive(false);
            this.toast.success(`Hidden query "${query.name}"`);
            this.refreshCurrentQueries();
        }
    }

    async showQuery(queryId) {
        const query = this.currentQueries.get(queryId);
        if (!query) return;

        try {
            if (query.dbIds.length > 0) {
                // Query already has results, just show them
                if (window.colorManager) {
                    window.colorManager.addQuery(query.conditions, query.dbIds, query.name, query.color, queryId);
                }
                query.setActive(true);
                this.toast.success(`Showing query "${query.name}"`);
            } else {
                // No results, need to execute the query
                await this.refreshQuery(queryId);
            }
            
            this.refreshCurrentQueries();
        } catch (error) {
            console.error('Error showing query:', error);
            this.toast.error(`Failed to show query "${query.name}"`);
        }
    }

    async refreshQuery(queryId) {
        const query = this.currentQueries.get(queryId);
        if (!query) return;

        try {
            this.toast.info(`Refreshing query "${query.name}"...`);
            
            // Re-execute the query
            const result = await query.performQuery();
            
            if (result.success) {
                if (query.dbIds.length > 0) {
                    // Update color manager if query was active
                    if (query.isActive && window.colorManager) {
                        window.colorManager.updateQuery(queryId, query.dbIds);
                    }
                    
                    this.toast.success(`Refreshed "${query.name}": ${result.message}`);
                } else {
                    // No results found
                    if (query.isActive && window.colorManager) {
                        window.colorManager.removeQuery(queryId);
                    }
                    query.setActive(false);
                    this.toast.warning(`Refreshed "${query.name}": No objects found`);
                }
            } else {
                this.toast.error(`Failed to refresh "${query.name}": ${result.error}`);
            }
            
            this.refreshCurrentQueries();
        } catch (error) {
            console.error('Error refreshing query:', error);
            this.toast.error(`Failed to refresh query "${query.name}"`);
        }
    }

    editQuery(queryId) {
        const query = this.currentQueries.get(queryId);
        if (query) {
            // For now, show detailed information about the query
            const stats = query.getStats();
            const preview = query.getConditionsPreview();
            
            alert(`Query Details:\n\nName: ${stats.name}\nObjects: ${stats.objectCount}\nColor: ${stats.color}\nStatus: ${stats.isActive ? 'Active' : 'Inactive'}\nCreated: ${new Date(stats.dateCreated).toLocaleString()}\n\nConditions:\n${preview}\n\n[Edit functionality coming soon!]`);
        }
    }

    deleteQuery(queryId) {
        const query = this.currentQueries.get(queryId);
        if (query && confirm(`Are you sure you want to delete "${query.name}"?`)) {
            // Remove from color manager if active
            if (query.isActive && window.colorManager) {
                window.colorManager.removeQuery(queryId);
            }
            
            // Remove from current queries
            this.currentQueries.delete(queryId);
            
            this.toast.success(`Deleted query "${query.name}"`);
            this.refreshCurrentQueries();
        }
    }

    async confirmAddQuery() {
        const conditions = this.buildQuery();
        if (!conditions) {
            this.toast.warning('Please add at least one condition to create a query.');
            return;
        }

        const queryName = prompt('Enter a name for this query:', `Query ${new Date().toLocaleTimeString()}`);
        if (!queryName) return;

        const queryDescription = prompt('Enter a description for this query (optional):', '') || '';

        try {
            // Create a new Query instance
            const query = new Query(queryName, conditions, null, queryDescription);
            
            console.log('Created Query:', JSON.stringify(query.toJSON(), null, 2));

            this.toast.info(`Executing query "${query.name}"...`);

            // Execute the query using the Query class method
            const result = await query.performQuery();
            
            if (result.success) {
                if (query.dbIds.length > 0) {
                    // Add to current queries
                    this.currentQueries.set(query.id, query);

                    // Add to color manager
                    if (window.colorManager) {
                        window.colorManager.addQuery(query.conditions, query.dbIds, query.name, query.color, query.id);
                    }

                    this.toast.success(`Query "${query.name}" created successfully: ${result.message}`);
                    this.hideAddQueryPopup();
                    this.refreshCurrentQueries();
                } else {
                    this.toast.warning(`Query "${query.name}" executed but no objects found in the current model.`);
                }
            } else {
                this.toast.error(`Query "${query.name}" failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Error creating query:', error);
            this.toast.error(`Failed to create query: ${error.message}`);
        }
    }

    async setupGuid() {
        console.log('Setting up GUID...');
    }

    // Helper methods for Query management
    getAllQueries() {
        return Array.from(this.currentQueries.values());
    }

    getQueryById(queryId) {
        return this.currentQueries.get(queryId);
    }

    getActiveQueries() {
        return this.getAllQueries().filter(query => query.isActive);
    }

    getInactiveQueries() {
        return this.getAllQueries().filter(query => !query.isActive);
    }

    async clearAllQueries() {
        if (this.currentQueries.size > 0 && confirm('Are you sure you want to clear all queries?')) {
            // Clear from color manager
            if (window.colorManager) {
                this.currentQueries.forEach(query => {
                    if (query.isActive) {
                        window.colorManager.removeQuery(query.id);
                    }
                });
            }
            
            this.currentQueries.clear();
            this.refreshCurrentQueries();
            this.toast.success('All queries cleared');
        }
    }

    async hideAllQueries() {
        const activeQueries = this.getActiveQueries();
        if (activeQueries.length > 0) {
            activeQueries.forEach(query => {
                this.hideQuery(query.id);
            });
            this.toast.success(`Hidden ${activeQueries.length} queries`);
        } else {
            this.toast.info('No active queries to hide');
        }
    }

    async showAllQueries() {
        const inactiveQueries = this.getInactiveQueries();
        if (inactiveQueries.length > 0) {
            for (const query of inactiveQueries) {
                await this.showQuery(query.id);
            }
            this.toast.success(`Showing ${inactiveQueries.length} queries`);
        } else {
            this.toast.info('All queries are already active');
        }
    }

    // Export all current queries
    exportQueries() {
        const queries = this.getAllQueries();
        if (queries.length === 0) {
            this.toast.warning('No queries to export');
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            totalQueries: queries.length,
            queries: queries.map(query => query.toJSON())
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `queries_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.toast.success(`Exported ${queries.length} queries`);
    }

    importFromCsv() {
        // Empty method for now as requested
        console.log('Import from CSV functionality to be implemented');
        this.toast.info('CSV import functionality coming soon!');
    }

    loadFromSaved() {
        // Empty method for now as requested
        console.log('Load from saved queries functionality to be implemented');
        this.toast.info('Load saved queries functionality coming soon!');
    }

    // Add helper method to update category dropdown after categories load
    updateCategoryDropdown(conditionId) {
        const conditionRow = document.getElementById(conditionId);
        if (conditionRow) {
            const categorySelect = conditionRow.querySelector('.category-select');
            const currentValue = categorySelect.value;
            
            categorySelect.innerHTML = `
                <option value="">Select Category</option>
                ${Object.keys(this.categories).map(cat => 
                    `<option value="${cat}" ${cat === currentValue ? 'selected' : ''}>${cat}</option>`
                ).join('')}
            `;
        }
    }

    // Add method to refresh all category dropdowns
    refreshAllCategoryDropdowns() {
        const allCategorySelects = document.querySelectorAll('.category-select');
        allCategorySelects.forEach(select => {
            const conditionId = select.closest('.condition-row').id;
            this.updateCategoryDropdown(conditionId);
        });
    }

    // Updated addGroup method with better UI
    addGroup(containerId = 'addQueryContainer', isNested = false, indentLevel = 0) {
        const groupId = `group-${this.groupCounter++}`;
        const container = document.getElementById(containerId);
        
        const groupDiv = document.createElement('div');
        groupDiv.className = isNested ? 'condition-group nested' : 'condition-group';
        groupDiv.id = groupId;
        groupDiv.style.marginLeft = `${indentLevel * 20}px`;
        groupDiv.style.marginTop = '15px';
        
        if (isNested) {
            groupDiv.style.border = '2px dashed #007acc';
            groupDiv.style.padding = '15px';
            groupDiv.style.borderRadius = '8px';
            groupDiv.style.backgroundColor = '#f8f9ff';
        } else {
            groupDiv.style.border = '1px solid #ddd';
            groupDiv.style.padding = '15px';
            groupDiv.style.borderRadius = '8px';
            groupDiv.style.backgroundColor = '#fff';
        }
        
        const isRemovable = container.children.length > 0 || isNested;
        
        groupDiv.innerHTML = `
            <div class="group-header" style="display: flex; align-items: center; margin-bottom: 15px; gap: 15px;">
                ${isNested ? '<strong style="color: #007acc;">Nested Group:</strong>' : '<strong>Group:</strong>'}
                <div class="logic-toggle" data-group-id="${groupId}" style="display: flex; align-items: center; background: #f0f0f0; border-radius: 20px; padding: 2px;">
                    <button class="logic-btn and-btn active" onclick="queryBuilder.setGroupLogic('${groupId}', 'AND')" 
                            style="padding: 6px 12px; border: none; border-radius: 18px; background: #007acc; color: white; cursor: pointer; font-size: 12px; font-weight: bold;">AND</button>
                    <button class="logic-btn or-btn" onclick="queryBuilder.setGroupLogic('${groupId}', 'OR')" 
                            style="padding: 6px 12px; border: none; border-radius: 18px; background: transparent; color: #666; cursor: pointer; font-size: 12px; font-weight: bold;">OR</button>
                </div>
                ${isRemovable ? `<button class="remove-group" onclick="queryBuilder.removeGroup('${groupId}')" 
                    style="padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove ${isNested ? 'Nested ' : ''}Group</button>` : ''}
            </div>
            <div class="conditions-container" id="${groupId}-conditions">
                <!-- Conditions will be added here -->
            </div>
            <div class="group-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                <button class="btn btn-secondary btn-small" onclick="queryBuilder.addCondition('${groupId}')">+ Add Condition</button>
                <button class="btn btn-secondary btn-small" onclick="queryBuilder.addNestedGroup('${groupId}')">+ Add Nested Group</button>
            </div>
        `;
        
        container.appendChild(groupDiv);
        this.addCondition(groupId);
        return groupId;
    }

    // New method to handle logic toggle
    setGroupLogic(groupId, logic) {
        const groupDiv = document.getElementById(groupId);
        const andBtn = groupDiv.querySelector('.and-btn');
        const orBtn = groupDiv.querySelector('.or-btn');
        
        if (logic === 'AND') {
            andBtn.style.background = '#007acc';
            andBtn.style.color = 'white';
            andBtn.classList.add('active');
            orBtn.style.background = 'transparent';
            orBtn.style.color = '#666';
            orBtn.classList.remove('active');
        } else {
            orBtn.style.background = '#007acc';
            orBtn.style.color = 'white';
            orBtn.classList.add('active');
            andBtn.style.background = 'transparent';
            andBtn.style.color = '#666';
            andBtn.classList.remove('active');
        }
        
        console.log(`Group ${groupId} logic set to ${logic}`);
    }

    addCondition(groupId) {
        const conditionId = `condition-${this.conditionCounter++}`;
        const container = document.getElementById(`${groupId}-conditions`);
        
        const conditionDiv = document.createElement('div');
        conditionDiv.className = 'condition-row';
        conditionDiv.id = conditionId;
        conditionDiv.style.display = 'flex';
        conditionDiv.style.gap = '10px';
        conditionDiv.style.alignItems = 'center';
        conditionDiv.style.marginBottom = '10px';
        conditionDiv.style.padding = '10px';
        conditionDiv.style.background = '#f9f9f9';
        conditionDiv.style.borderRadius = '6px';
        conditionDiv.style.border = '1px solid #e0e0e0';
        
        // Build categories options
        const categoryOptions = Object.keys(this.categories).length > 0 
            ? Object.keys(this.categories).map(cat => `<option value="${cat}">${cat}</option>`).join('')
            : '<option value="" disabled>Loading categories...</option>';
        
        conditionDiv.innerHTML = `
            <select class="category-select" onchange="queryBuilder.onCategoryChange('${conditionId}', this.value)" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                <option value="">Select Category</option>
                ${categoryOptions}
            </select>
            
            <select class="field-select" disabled style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                <option value="">Select Field</option>
            </select>
            
            <select class="operator-select" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="starts_with">Starts With</option>
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
                <option value="greater_than_or_equal">Greater Than or Equal</option>
                <option value="less_than_or_equal">Less Than or Equal</option>
                <option value="does_not_contain">Does Not Contain</option>
            </select>
            
            <input type="text" class="value-input" placeholder="Enter value" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            
            <button class="remove-condition" onclick="queryBuilder.removeCondition('${conditionId}')" 
                    style="padding: 6px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">×</button>
        `;
        
        container.appendChild(conditionDiv);
        
        // If categories are still loading, try to reload them and update the dropdown
        if (Object.keys(this.categories).length === 0) {
            this.loadCategories().then(() => {
                this.updateCategoryDropdown(conditionId);
            });
        }
    }

    onCategoryChange(conditionId, category) {
        const conditionRow = document.getElementById(conditionId);
        const fieldSelect = conditionRow.querySelector('.field-select');
        
        fieldSelect.innerHTML = '<option value="">Select Field</option>';
        fieldSelect.disabled = !category;
        
        if (category && this.categories[category]) {
            this.categories[category].forEach(field => {
                const option = document.createElement('option');
                option.value = field;
                option.textContent = field;
                fieldSelect.appendChild(option);
            });
            fieldSelect.disabled = false;
        }
    }

    removeGroup(groupId) {
        const group = document.getElementById(groupId);
        if (group) {
            group.remove();
        }
    }

    removeCondition(conditionId) {
        const condition = document.getElementById(conditionId);
        if (condition) {
            condition.remove();
        }
    }

    addNestedGroup(parentGroupId) {
        const parentContainer = document.getElementById(`${parentGroupId}-conditions`);
        const parentGroup = document.getElementById(parentGroupId);
        const currentIndent = parseInt(parentGroup.style.marginLeft) || 0;
        const newIndent = currentIndent + 20;
        
        return this.addGroup(`${parentGroupId}-conditions`, true, newIndent / 20);
    }

    buildQuery() {
        const container = document.getElementById('addQueryContainer');
        const topLevelGroups = Array.from(container.children).filter(child => 
            child.classList.contains('condition-group') && !child.classList.contains('nested')
        );
        
        if (topLevelGroups.length === 0) {
            return null;
        }

        if (topLevelGroups.length === 1) {
            const singleGroupQuery = this.buildGroupQuery(topLevelGroups[0]);
            return singleGroupQuery;
        }

        // Multiple top-level groups - combine with AND
        const conditions = topLevelGroups
            .map(group => this.buildGroupQuery(group))
            .filter(q => q !== null);

        if (conditions.length === 0) {
            return null;
        }

        return {
            logic: 'AND',
            conditions: conditions
        };
    }

    buildGroupQuery(groupElement) {
        const logicToggle = groupElement.querySelector('.logic-toggle');
        const activeLogicBtn = logicToggle.querySelector('.logic-btn.active');
        const logic = activeLogicBtn ? activeLogicBtn.textContent : 'AND';
        
        const conditionsContainer = groupElement.querySelector('.conditions-container');
        const conditions = [];
        
        // Get direct condition rows (not from nested groups)
        const directConditionRows = Array.from(conditionsContainer.children).filter(child => 
            child.classList.contains('condition-row')
        );
        
        directConditionRows.forEach(row => {
            const condition = this.buildConditionFromRow(row);
            if (condition) {
                conditions.push(condition);
            }
        });
        
        // Get nested groups
        const nestedGroups = Array.from(conditionsContainer.children).filter(child => 
            child.classList.contains('condition-group') && child.classList.contains('nested')
        );
        
        nestedGroups.forEach(nestedGroup => {
            const nestedQuery = this.buildGroupQuery(nestedGroup);
            if (nestedQuery) {
                conditions.push(nestedQuery);
            }
        });
        
        if (conditions.length === 0) {
            return null;
        }
        
        // If only one condition and it's not a nested query, return it as-is for single condition shortcut
        if (conditions.length === 1 && !conditions[0].logic) {
            return {
                conditions: conditions[0]
            };
        }
        
        return {
            logic: logic,
            conditions: conditions
        };
    }

    buildConditionFromRow(row) {
        const category = row.querySelector('.category-select').value;
        const field = row.querySelector('.field-select').value;
        const operator = row.querySelector('.operator-select').value;
        const value = row.querySelector('.value-input').value;
        
        if (!category || !field || !operator || !value) {
            return null;
        }
        
        return {
            category,
            field,
            operator,
            value
        };
    }
}

// Create global instance
window.queryBuilder = new QueryBuilder();