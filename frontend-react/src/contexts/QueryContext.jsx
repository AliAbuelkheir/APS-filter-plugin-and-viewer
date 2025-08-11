import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { Query } from '../classes/Query';

// Action types
const QUERY_ACTIONS = {
  ADD_QUERY: 'ADD_QUERY',
  UPDATE_QUERY: 'UPDATE_QUERY',
  UPDATE_AND_REEXECUTE_QUERY: 'UPDATE_AND_REEXECUTE_QUERY',
  DELETE_QUERY: 'DELETE_QUERY',
  TOGGLE_QUERY_ACTIVE: 'TOGGLE_QUERY_ACTIVE',
  SET_QUERY_ACTIVE: 'SET_QUERY_ACTIVE',
  EXECUTE_QUERY: 'EXECUTE_QUERY',
  SET_EXECUTING: 'SET_EXECUTING',
  SET_QUERY_RESULTS: 'SET_QUERY_RESULTS',
  CLEAR_QUERY_RESULTS: 'CLEAR_QUERY_RESULTS',
  IMPORT_QUERIES: 'IMPORT_QUERIES',
  RESET_QUERIES: 'RESET_QUERIES',
  SELECT_QUERY: 'SELECT_QUERY'
};

// Initial state
const initialState = {
  queries: [],
  selectedQueryId: null,
  isExecuting: false,
  lastExecutedQueryId: null
};

// Load queries from localStorage on initialization
const loadInitialState = () => {
  try {
    const savedQueries = localStorage.getItem('queries');
    if (savedQueries) {
      const parsedQueries = JSON.parse(savedQueries);
      return {
        ...initialState,
        queries: parsedQueries.map(queryData => Query.fromJSON(queryData))
      };
    }
  } catch (error) {
    console.error('Failed to load queries from localStorage:', error);
  }
  return initialState;
};

// Reducer
function queryReducer(state, action) {
  switch (action.type) {
    case QUERY_ACTIONS.ADD_QUERY:
      console.log('Adding new query:', action.payload.conditions);
      for (const query of state.queries) {
        console.log('existing query:', query.name, query.conditions);
      }
      return {
        ...state,
        queries: [...state.queries, action.payload],
        selectedQueryId: action.payload.id
      };

    case QUERY_ACTIONS.UPDATE_QUERY:
      return {
        ...state,
        queries: state.queries.map(query => {
          if (query.id === action.payload.id) {
            // Create a new Query instance with updated data
            const updatedQueryData = { ...query, ...action.payload.updates, updatedAt: new Date() };
            return Query.fromJSON(updatedQueryData);
          }
          return query;
        })
      };

    case QUERY_ACTIONS.UPDATE_AND_REEXECUTE_QUERY:
      return {
        ...state,
        queries: state.queries.map(query => {
          if (query.id === action.payload.id) {
            // Create a new Query instance with updated data
            const updatedQueryData = { ...query, ...action.payload.updates, updatedAt: new Date() };
            return Query.fromJSON(updatedQueryData);
          }
          return query;
        }),
        isExecuting: true
      };

    case QUERY_ACTIONS.DELETE_QUERY:
      return {
        ...state,
        queries: state.queries.filter(query => query.id !== action.payload),
        selectedQueryId: state.selectedQueryId === action.payload ? null : state.selectedQueryId
      };

    case QUERY_ACTIONS.TOGGLE_QUERY_ACTIVE:
      return {
        ...state,
        queries: state.queries.map(query => {
          if (query.id === action.payload) {
            const updatedQueryData = { ...query, isActive: !query.isActive, updatedAt: new Date() };
            return Query.fromJSON(updatedQueryData);
          }
          return query;
        })
      };

    case QUERY_ACTIONS.SET_QUERY_ACTIVE:
      return {
        ...state,
        queries: state.queries.map(query => {
          if (query.id === action.payload.queryId) {
            const updatedQueryData = { ...query, isActive: action.payload.isActive, updatedAt: new Date() };
            return Query.fromJSON(updatedQueryData);
          }
          return query;
        })
      };
      
    case QUERY_ACTIONS.EXECUTE_QUERY:
      return {
        ...state,
        isExecuting: true
      };

    case QUERY_ACTIONS.SET_EXECUTING:
      return {
        ...state,
        isExecuting: action.payload
      };

    case QUERY_ACTIONS.SET_QUERY_RESULTS:
      return {
        ...state,
        queries: state.queries.map(query => {
          if (query.id === action.payload.queryId) {
            const updatedQueryData = { 
              ...query, 
              dbIds: action.payload.dbIds || [], 
              externalIds: action.payload.externalIds || [], 
              isActive: true,
              updatedAt: new Date()
            };
            return Query.fromJSON(updatedQueryData);
          }
          return query;
        }),
        lastExecutedQueryId: action.payload.queryId,
        isExecuting: false
      };

    case QUERY_ACTIONS.CLEAR_QUERY_RESULTS:
      return {
        ...state,
        queries: state.queries.map(query => {
          if (query.id === action.payload) {
            const updatedQueryData = { ...query, dbIds: [], externalIds: [], isActive: false, updatedAt: new Date() };
            return Query.fromJSON(updatedQueryData);
          }
          return query;
        })
      };

    case QUERY_ACTIONS.IMPORT_QUERIES:
      // Merge imported queries with existing ones, replacing duplicates by ID
      const existingIds = state.queries.map(q => q.id);
      const newQueries = action.payload.filter(q => !existingIds.includes(q.id));
      const updatedExisting = state.queries.map(q => {
        const importedMatch = action.payload.find(imported => imported.id === q.id);
        return importedMatch ? importedMatch : q;
      });
      
      // Debug: Print conditions of each imported query
      console.log('=== IMPORTED QUERIES DEBUG ===');
      action.payload.forEach((query, index) => {
        console.log(`Query ${index + 1} (${query.name}):`, {
          id: query.id,
          name: query.name,
          conditions: query.conditions,
          conditionsType: typeof query.conditions,
          conditionsLength: Array.isArray(query.conditions) ? query.conditions.length : 'N/A',
          isQueryInstance: query instanceof Query
        });
        if (Array.isArray(query.conditions) && query.conditions.length > 0) {
          query.conditions.forEach((condition, condIndex) => {
            console.log(`  Condition ${condIndex + 1}:`, condition);
          });
        }
      });
      console.log('=== END IMPORTED QUERIES DEBUG ===');
      
      return {
        ...state,
        queries: [...updatedExisting, ...newQueries]
      };

    case QUERY_ACTIONS.RESET_QUERIES:
      return {
        ...initialState,
        queries: []
      };
      
    case QUERY_ACTIONS.SELECT_QUERY:
      return {
        ...state,
        selectedQueryId: action.payload
      };

    default:
      return state;
  }
}

// Create context
const QueryContext = createContext();

// Context provider component
export function QueryProvider({ children }) {
  const [state, dispatch] = useReducer(queryReducer, null, loadInitialState);

  // Save queries to localStorage when state changes
  useEffect(() => {
    try {
      const serializedQueries = JSON.stringify(
        state.queries.map(query => ({...query, dbIds: [], externalIds: []}))
      );
      localStorage.setItem('queries', serializedQueries);
    } catch (error) {
      console.error('Failed to save queries to localStorage:', error);
    }
  }, [state.queries]);

  // Actions
  const addQuery = useCallback((nameOrQuery, conditions, color, description) => {
    let newQuery;
    
    // If first parameter is already a Query instance, use it directly
    if (nameOrQuery instanceof Query) {
      newQuery = nameOrQuery;
    } else {
      // Otherwise, create a new Query instance from parameters
      newQuery = new Query(nameOrQuery || 'New Query', conditions || {}, color, description || '');
    }
    
    dispatch({ type: QUERY_ACTIONS.ADD_QUERY, payload: newQuery });
    return newQuery;
  }, []);

  const updateQuery = useCallback(async (queryId, updates) => {
    const queryData = state.queries.find(q => q.id === queryId);
    if (!queryData) {
      throw new Error('Query not found');
    }

    // Check if the query is currently active
    const isActive = queryData.isActive;

    if (isActive) {
      // Use UPDATE_AND_REEXECUTE_QUERY for active queries
      dispatch({
        type: QUERY_ACTIONS.UPDATE_AND_REEXECUTE_QUERY,
        payload: { id: queryId, updates }
      });

      // Re-execute the query
      try {
        const query = Query.fromJSON({ ...queryData, ...updates });
        const result = await query.performQuery();
        
        if (result.success) {
          // Collect all dbIds from currently active queries plus this updated query
          const allActiveDbIds = state.queries
            .filter(q => q.isActive && q.id !== queryId) // Exclude current query to avoid duplication
            .reduce((acc, q) => [...acc, ...(q.dbIds || [])], [])
            .concat(result.dbIds || []); // Add current query's dbIds
          
          // Remove duplicates
          const uniqueDbIds = [...new Set(allActiveDbIds)];
          
          // Isolate with all active query dbIds
          await query.isolate(uniqueDbIds);
          
          // Set query results
          dispatch({
            type: QUERY_ACTIONS.SET_QUERY_RESULTS,
            payload: {
              queryId,
              dbIds: result.dbIds,
              externalIds: result.externalIds
            }
          });
          
          console.log(`Query "${query.name}" updated and re-executed successfully`);
        } else {
          dispatch({ type: QUERY_ACTIONS.SET_EXECUTING, payload: false });
          console.error(`Query re-execution failed after update:`, result.error);
        }
      } catch (error) {
        dispatch({ type: QUERY_ACTIONS.SET_EXECUTING, payload: false });
        console.error('Error re-executing query after update:', error);
      }
    } else {
      // Use regular UPDATE_QUERY for inactive queries
      dispatch({
        type: QUERY_ACTIONS.UPDATE_QUERY,
        payload: { id: queryId, updates }
      });
    }
  }, [state.queries]);

  const deleteQuery = useCallback((queryId) => {
    dispatch({ type: QUERY_ACTIONS.DELETE_QUERY, payload: queryId });
  }, []);

  const toggleQueryActive = useCallback(async (queryId) => {
    const queryData = state.queries.find(q => q.id === queryId);
    if (!queryData) {
      throw new Error('Query not found');
    }

    // Ensure we have a Query class instance
    const query = queryData instanceof Query ? queryData : Query.fromJSON(queryData);

    // If query is currently inactive, activate it and execute
    if (!query.isActive) {
      try {
        // Set loading state
        dispatch({ type: QUERY_ACTIONS.SET_EXECUTING, payload: true });
        
        // Execute the query
        const result = await query.performQuery();
        
        if (result.success) {
          // Collect all dbIds from currently active queries plus this new query
          const allActiveDbIds = state.queries
            .filter(q => q.isActive && q.id !== queryId) // Exclude current query to avoid duplication
            .reduce((acc, q) => [...acc, ...(q.dbIds || [])], [])
            .concat(result.dbIds || []); // Add current query's dbIds
          
          // Remove duplicates
          const uniqueDbIds = [...new Set(allActiveDbIds)];
          
          // Isolate with all active query dbIds
          await query.isolate(uniqueDbIds);
          
          // Set query as active with results
          dispatch({
            type: QUERY_ACTIONS.SET_QUERY_RESULTS,
            payload: {
              queryId,
              dbIds: result.dbIds,
              externalIds: result.externalIds
            }
          });
          
          console.log(`Query "${query.name}" executed successfully:`, result);
          console.log(`Isolated total of ${uniqueDbIds.length} objects from all active queries`);
          return result;
        } else {
          // Query failed, don't activate it
          dispatch({ type: QUERY_ACTIONS.SET_EXECUTING, payload: false });
          console.error(`Query "${query.name}" execution failed:`, result.error);
          throw new Error(result.error);
        }
      } catch (error) {
        dispatch({ type: QUERY_ACTIONS.SET_EXECUTING, payload: false });
        console.error(`Query "${query.name}" execution error:`, error);
        throw error;
      }
    } else {
      // If query is currently active, deactivate it and clear results
      dispatch({ type: QUERY_ACTIONS.CLEAR_QUERY_RESULTS, payload: queryId });
      console.log(`Query "${query.name}" deactivated and results cleared`);
    }
  }, [state.queries]);
  
  const setQueryActive = useCallback((queryId, isActive) => {
    dispatch({ 
      type: QUERY_ACTIONS.SET_QUERY_ACTIVE, 
      payload: { queryId, isActive }
    });
  }, []);

  const executeQuery = useCallback(async (queryId) => {
    const queryData = state.queries.find(q => q.id === queryId);
    if (!queryData) {
      throw new Error('Query not found');
    }

    // Ensure we have a Query class instance
    const query = queryData instanceof Query ? queryData : Query.fromJSON(queryData);

    dispatch({ type: QUERY_ACTIONS.EXECUTE_QUERY });

    try {
      const result = await query.performQuery();
      
      if (result.success) {
        dispatch({
          type: QUERY_ACTIONS.SET_QUERY_RESULTS,
          payload: {
            queryId,
            dbIds: result.dbIds,
            externalIds: result.externalIds
          }
        });
        return result;
      } else {
        console.error('Query execution failed:', result.error);
        dispatch({ type: QUERY_ACTIONS.SET_EXECUTING, payload: false });
        return result;
      }
    } catch (error) {
      console.error('Query execution error:', error);
      dispatch({ type: QUERY_ACTIONS.SET_EXECUTING, payload: false });
      throw error;
    }
  }, [state.queries]);

  const clearQueryResults = useCallback((queryId) => {
    dispatch({ type: QUERY_ACTIONS.CLEAR_QUERY_RESULTS, payload: queryId });
  }, []);

  const cloneQuery = useCallback((queryId, newName) => {
    const originalQueryData = state.queries.find(q => q.id === queryId);
    if (originalQueryData) {
      // Ensure we have a Query class instance
      const originalQuery = originalQueryData instanceof Query ? originalQueryData : Query.fromJSON(originalQueryData);
      const clonedQuery = originalQuery.clone(newName);
      dispatch({ type: QUERY_ACTIONS.ADD_QUERY, payload: clonedQuery });
      return clonedQuery;
    }
    return null;
  }, [state.queries]);

  const selectQuery = useCallback((queryId) => {
    dispatch({ type: QUERY_ACTIONS.SELECT_QUERY, payload: queryId });
  }, []);

  // Import/Export functionality
  const exportQueriesToCSV = useCallback(() => {
    // Create CSV header
    const header = 'ID,Name,Description,Conditions,Color';
    
    // Convert each query to CSV row, ensuring they are Query instances
    const rows = state.queries.map(queryData => {
      const query = queryData instanceof Query ? queryData : Query.fromJSON(queryData);
      return query.toCSVRow();
    });
    
    // Combine header and rows
    const csv = [header, ...rows].join('\n');
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `queries_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return csv;
  }, [state.queries]);

  const importQueriesFromCSV = useCallback((csvContent) => {
    try {
      // Split CSV into lines
      const lines = csvContent.trim().split(/\r?\n/);
      
      // Skip header row
      const dataLines = lines.slice(1);
      
      // Parse each line to create Query objects
      const importedQueries = dataLines.map(line => Query.fromCSVRow(line));
      
      // Add to state
      dispatch({ type: QUERY_ACTIONS.IMPORT_QUERIES, payload: importedQueries });
      
      return importedQueries;
    } catch (error) {
      console.error('Failed to import queries from CSV:', error);
      throw error;
    }
  }, []);
  
  // Handle file upload for CSV import
  const handleFileUpload = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const csvContent = event.target.result;
          const queries = importQueriesFromCSV(csvContent);
          resolve(queries);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }, [importQueriesFromCSV]);

  // Reset all queries
  const resetQueries = useCallback(() => {
    dispatch({ type: QUERY_ACTIONS.RESET_QUERIES });
  }, []);

  // Computed values
  const selectedQuery = state.selectedQueryId 
    ? (() => {
        const queryData = state.queries.find(q => q.id === state.selectedQueryId);
        return queryData ? (queryData instanceof Query ? queryData : Query.fromJSON(queryData)) : null;
      })()
    : null;
    
  const activeQueries = state.queries.filter(q => q.isActive);
  const inactiveQueries = state.queries.filter(q => !q.isActive);
  
  // Get query by ID
  const getQueryById = useCallback((id) => {
    const queryData = state.queries.find(q => q.id === id);
    if (!queryData) return null;
    // Ensure we return a Query class instance
    return queryData instanceof Query ? queryData : Query.fromJSON(queryData);
  }, [state.queries]);

  // Context value
  const value = {
    // State
    queries: state.queries,
    selectedQueryId: state.selectedQueryId,
    selectedQuery,
    isExecuting: state.isExecuting,
    lastExecutedQueryId: state.lastExecutedQueryId,
    
    // Computed values
    activeQueries,
    inactiveQueries,
    queriesCount: state.queries.length,
    
    // Query CRUD operations
    addQuery,
    updateQuery,
    deleteQuery,
    cloneQuery,
    toggleQueryActive,
    setQueryActive,
    selectQuery,
    getQueryById,
    
    // Query execution
    executeQuery,
    clearQueryResults,
    
    // Import/Export
    exportQueriesToCSV,
    importQueriesFromCSV,
    handleFileUpload,
    resetQueries
  };

  return (
    <QueryContext.Provider value={value}>
      {children}
    </QueryContext.Provider>
  );
}

// Custom hook to use the context
export function useQuery() {
  const context = useContext(QueryContext);
  if (!context) {
    throw new Error('useQuery must be used within a QueryProvider');
  }
  return context;
}

// Export actions for external use
export { QUERY_ACTIONS };