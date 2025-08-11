import { ToastManager } from './toastManager.js';

export class SavedQueriesManager {
    constructor(queryBuilder) {
        this.queryBuilder = queryBuilder;
        this.savedQueries = [];
        this.toast = new ToastManager();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // document.getElementById('savedQueriesBtn').onclick = () => this.showSavedQueriesPopup();
        document.getElementById('closeSavedQueriesPopup').onclick = () => this.hideSavedQueriesPopup();
        document.getElementById('refreshSavedQueries').onclick = () => this.loadSavedQueries();

        document.getElementById('savedQueriesPopup').onclick = (e) => {
            if (e.target.id === 'savedQueriesPopup') {
                this.hideSavedQueriesPopup();
            }
        };
    }

    async showSavedQueriesPopup() {
        await this.loadSavedQueries();
        document.getElementById('savedQueriesPopup').classList.remove('hidden');
    }

    hideSavedQueriesPopup() {
        document.getElementById('savedQueriesPopup').classList.add('hidden');
    }

    async loadSavedQueries() {
        try {
            const response = await fetch('http://localhost:8082/api/query/saved');
            const result = await response.json();
            
            if (result.success) {
                this.savedQueries = result.data;
                this.renderSavedQueries();
            } else {
                console.error('Failed to load saved queries:', result.error);
                this.toast.error('Failed to load saved queries');
            }
        } catch (error) {
            console.error('Load saved queries failed:', error);
            this.toast.error('Failed to load saved queries. Please check the console for details.');
        }
    }

    renderSavedQueries() {
        const container = document.getElementById('savedQueriesList');
        
        if (this.savedQueries.length === 0) {
            container.innerHTML = `
                <div class="no-queries">
                    <p>No saved queries found.</p>
                    <p>Create and save queries using the Query Builder.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.savedQueries.map(query => `
            <div class="saved-query-item" data-id="${query._id}">
                <div class="query-info">
                    <h4 class="query-name">${this.escapeHtml(query.name)}</h4>
                    <div class="query-details">
                        <span class="query-date">Created: ${new Date(query.createdAt).toLocaleDateString()}</span>
                        <span class="query-author">By: ${this.escapeHtml(query.createdBy)}</span>
                    </div>
                    <div class="query-preview">
                        ${this.generateQueryPreview(query.query)}
                    </div>
                </div>
                <div class="query-actions">
                    <button class="btn btn-primary btn-small" onclick="savedQueriesManager.loadQuery('${query._id}')">
                        Apply Color
                    </button>
                    <button class="btn btn-danger btn-small" onclick="savedQueriesManager.deleteQuery('${query._id}')">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    generateQueryPreview(query) {
        if (!query.conditions) return 'Invalid query';

        if (!query.logic) {
            // Single condition
            const cond = query.conditions;
            return `${cond.category}.${cond.field} ${cond.operator} "${cond.value}"`;
        }

        // Multiple conditions
        const logic = query.logic.toUpperCase();
        let preview = `${logic} query with ${Array.isArray(query.conditions) ? query.conditions.length : 1} condition(s)`;
        
        if (Array.isArray(query.conditions) && query.conditions.length > 0) {
            const firstCond = query.conditions[0];
            if (firstCond.category) {
                preview += ` starting with ${firstCond.category}.${firstCond.field}`;
            }
        }
        
        return preview;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadQuery(queryId) {
        const query = this.savedQueries.find(q => q._id === queryId);
        if (!query) {
            this.toast.error('Query not found');
            return;
        }

        // Use the queryBuilder's executeQuery method to apply color
        const success = await this.queryBuilder.executeQuery(
            query.query, 
            `Query "${query.name}" applied successfully!`,
            query.name // Pass the query name for the legend
        );
        
        if (success) {
            this.hideSavedQueriesPopup();
        }
    }

    async deleteQuery(queryId) {
        const query = this.savedQueries.find(q => q._id === queryId);
        if (!query) {
            this.toast.error('Query not found');
            return;
        }

        if (!confirm(`Are you sure you want to delete the query "${query.name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:8082/api/query/saved/${queryId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.success) {
                this.toast.success(`Query "${query.name}" deleted successfully!`, 'Deleted');
                await this.loadSavedQueries(); // Refresh the list
            } else {
                this.toast.error(result.error || 'Unknown error', 'Delete Failed');
            }
        } catch (error) {
            console.error('Delete query failed:', error);
            this.toast.error('Failed to delete query. Check console for details.');
        }
    }
}