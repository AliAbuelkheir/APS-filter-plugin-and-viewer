import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '../contexts/QueryContext';
import DatabaseManagementModal from './DatabaseManagementModal';

const QueryManagerModal = ({ isOpen, onClose, onOpenNewQuery, onEditQuery }) => {
  const {
    queries,
    deleteQuery,
    updateQuery,
    toggleQueryActive,
    exportQueriesToCSV,
    handleFileUpload,
    isExecuting
  } = useQuery();

  const [colorPickerQuery, setColorPickerQuery] = useState(null);
  const [executingQueryId, setExecutingQueryId] = useState(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [databaseModalTab, setDatabaseModalTab] = useState('upload');
  const colorPickerRef = useRef(null);
  const exportDropdownRef = useRef(null);
  const importDropdownRef = useRef(null);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
        setColorPickerQuery(null);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
      if (importDropdownRef.current && !importDropdownRef.current.contains(event.target)) {
        setShowImportDropdown(false);
      }
    };

    if (colorPickerQuery || showExportDropdown || showImportDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [colorPickerQuery, showExportDropdown, showImportDropdown]);

  if (!isOpen) return null;

  const handleDeleteQuery = (queryId) => {
    if (window.confirm('Are you sure you want to delete this query?')) {
      deleteQuery(queryId);
    }
  };

  const handleToggleQuery = async (queryId) => {
    const query = queries.find(q => q.id === queryId);
    if (!query) return;

    try {
      setExecutingQueryId(queryId);
      await toggleQueryActive(queryId);
      
      // Show success message
      const action = query.isActive ? 'deactivated' : 'executed';
      const successMessage = document.createElement('div');
      successMessage.textContent = `Query "${query.name}" ${action} successfully!`;
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[100]';
      document.body.appendChild(successMessage);
      setTimeout(() => {
        if (document.body.contains(successMessage)) {
          document.body.removeChild(successMessage);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Failed to toggle query:', error);
      
      // Show error message
      const errorMessage = document.createElement('div');
      errorMessage.textContent = `Failed to execute query "${query.name}": ${error.message}`;
      errorMessage.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-[100]';
      document.body.appendChild(errorMessage);
      setTimeout(() => {
        if (document.body.contains(errorMessage)) {
          document.body.removeChild(errorMessage);
        }
      }, 5000);
    } finally {
      setExecutingQueryId(null);
    }
  };

  const handleEditQuery = (query) => {
    onEditQuery(query);
  };

  const handleColorChange = (queryId, color) => {
    updateQuery(queryId, { color });
    setColorPickerQuery(null);
  };

  const handleExport = () => {
    try {
      exportQueriesToCSV();
      setShowExportDropdown(false);
      // Show success message with a simple toast-like notification
      const successMessage = document.createElement('div');
      successMessage.textContent = 'Queries exported successfully!';
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[100]';
      document.body.appendChild(successMessage);
      setTimeout(() => {
        document.body.removeChild(successMessage);
      }, 3000);
    } catch (error) {
      alert(`Failed to export queries: ${error.message}`);
    }
  };

  const handleCloudExport = () => {
    setShowExportDropdown(false);
    setDatabaseModalTab('upload'); // Set to upload tab for exporting
    setShowDatabaseModal(true);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileUpload(file).then((importedQueries) => {
        setShowImportDropdown(false);
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.textContent = `Successfully imported ${importedQueries.length} queries!`;
        successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[100]';
        document.body.appendChild(successMessage);
        setTimeout(() => {
          document.body.removeChild(successMessage);
        }, 3000);
      }).catch((error) => {
        alert(`Failed to import queries: ${error.message}`);
      });
    }
    event.target.value = ''; // Reset file input
  };

  const handleCloudImport = () => {
    setShowImportDropdown(false);
    setDatabaseModalTab('download'); // Set to download tab for importing
    setShowDatabaseModal(true);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const colorOptions = [
    '#FF0080', '#00FF80', '#8000FF', '#FF8000', '#0080FF', '#FF4000',
    '#FFFF00', '#FF0040', '#00FFFF', '#FF0000', '#FF00FF', '#80FF80',
    '#FF8080', '#8080FF', '#FF4080', '#80FF40', '#4080FF', '#FF8040'
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden pointer-events-auto border border-gray-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Query Manager</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
          <div className="flex gap-3">
            <button
              onClick={onOpenNewQuery}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Query
            </button>
          </div>
          
          <div className="flex gap-2">
            {/* Export Dropdown */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Export
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showExportDropdown && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-[60]">
                  <button
                    onClick={handleExport}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 rounded-t-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M9 17h6a2 2 0 002-2V7a2 2 0 00-2-2H9a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Download CSV File
                  </button>
                  <button
                    onClick={handleCloudExport}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 rounded-b-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Save to Cloud Database
                  </button>
                </div>
              )}
            </div>

            {/* Import Dropdown */}
            <div className="relative" ref={importDropdownRef}>
              <button
                onClick={() => setShowImportDropdown(!showImportDropdown)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Import
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showImportDropdown && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-[60]">
                  <label className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer rounded-t-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Upload CSV File
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={handleCloudImport}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 rounded-b-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Load from Cloud Database
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Queries List */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {queries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg font-medium">No queries found</p>
              <p className="text-sm">Create your first query to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queries.map((query) => (
                <div
                  key={query.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow group"
                  title={`${query.name}${query.description ? '\n\n' + query.description : ''}\n\nConditions: ${query.getConditionsPreview()}\n\nCreated: ${formatDate(query.createdAt)}${query.updatedAt && query.updatedAt !== query.createdAt ? '\nUpdated: ' + formatDate(query.updatedAt) : ''}${query.dbIds && query.dbIds.length > 0 ? '\n\n' + query.getSummary() : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Color indicator and picker */}
                    <div className="flex-shrink-0 relative">
                      <button
                        onClick={() => setColorPickerQuery(colorPickerQuery === query.id ? null : query.id)}
                        className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-500 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 relative group/color"
                        style={{ backgroundColor: query.color }}
                        title="Click to change color"
                      >
                        {/* Subtle edit icon overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity duration-200">
                          <svg className="w-3 h-3 text-white drop-shadow-sm" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                          </svg>
                        </div>
                      </button>
                      {colorPickerQuery === query.id && (
                        <div 
                          ref={colorPickerRef}
                          className="absolute left-0 top-full mt-2 p-3 bg-white rounded-lg shadow-xl border border-gray-200 z-[70]"
                          style={{ minWidth: '200px' }}
                        >
                          <div className="grid grid-cols-6 gap-2">
                            {colorOptions.map((color) => (
                              <button
                                key={color}
                                onClick={() => handleColorChange(query.id, color)}
                                className="w-7 h-7 rounded-full border-2 border-gray-300 hover:border-gray-500 hover:scale-110 transition-all duration-200 shadow-sm hover:shadow-md"
                                style={{ backgroundColor: color }}
                                title={`Change to ${color}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Query content */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-gray-900 truncate">{query.name}</h3>
                        {query.isActive && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      
                      {query.description && (
                        <p className="text-sm text-gray-600 mb-2">{query.description}</p>
                      )}
                      
                      <div className="text-sm text-gray-600 mb-2 font-mono bg-gray-50 p-2 rounded max-h-16 overflow-y-auto">
                        {query.getConditionsPreview()}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div>
                          <span>Created: {formatDate(query.createdAt)}</span>
                          {query.updatedAt && query.updatedAt !== query.createdAt && (
                            <span className="ml-3">Updated: {formatDate(query.updatedAt)}</span>
                          )}
                        </div>
                        <div className="text-right">
                          {query.dbIds && query.dbIds.length > 0 && (
                            <span>{query.getSummary()}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      <button
                        onClick={() => handleToggleQuery(query.id)}
                        disabled={executingQueryId === query.id}
                        className={`p-2 rounded-lg transition-colors relative ${
                          query.isActive
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-50'
                        } ${executingQueryId === query.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={
                          executingQueryId === query.id 
                            ? 'Executing query...' 
                            : query.isActive 
                              ? 'Deactivate query' 
                              : 'Execute query'
                        }
                      >
                        {executingQueryId === query.id ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {query.isActive ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            )}
                          </svg>
                        )}
                      </button>                      <button
                        onClick={() => handleEditQuery(query)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit query"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      <button
                        onClick={() => handleDeleteQuery(query.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete query"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 text-sm text-gray-500">
          Total queries: {queries.length} | Active: {queries.filter(q => q.isActive).length}
        </div>
      </div>

      {/* Database Management Modal */}
      <DatabaseManagementModal
        isOpen={showDatabaseModal}
        onClose={() => setShowDatabaseModal(false)}
        initialTab={databaseModalTab}
      />
    </div>
  );
};

export default QueryManagerModal;
