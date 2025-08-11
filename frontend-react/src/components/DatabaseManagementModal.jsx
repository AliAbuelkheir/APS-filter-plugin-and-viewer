import React, { useState, useEffect } from 'react';
import { useQuery } from '../contexts/QueryContext';
import { Query } from '../classes/Query';

const DatabaseManagementModal = ({ isOpen, onClose, initialTab = 'upload' }) => {
  const { queries, addQuery, updateQuery, deleteQuery } = useQuery();
  const [cloudQueries, setCloudQueries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedQueries, setSelectedQueries] = useState(new Set());
  const [selectedUploadQueries, setSelectedUploadQueries] = useState(new Set());
  const [activeTab, setActiveTab] = useState(initialTab); // Use initialTab prop
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchCloudQueries();
      setActiveTab(initialTab); // Set active tab when modal opens
    }
  }, [isOpen, initialTab]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchCloudQueries = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8082/api/query/saved');
      if (!response.ok) {
        throw new Error('Failed to fetch cloud queries');
      }
      const data = await response.json();
      setCloudQueries(data.success ? data.data : []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching cloud queries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadToCloud = async () => {
    if (selectedUploadQueries.size === 0) {
      alert('Please select queries to upload');
      return;
    }

    setLoading(true);
    setError(null);
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    const errorMessages = [];

    try {
      // Get selected queries to upload
      const queriesToUpload = queries.filter(query => selectedUploadQueries.has(query.id));
      
      for (const query of queriesToUpload) {
        try {
          const queryData = {
            id: query.id, // Include the query ID
            name: query.name,
            query: {
              conditions: query.conditions,
              description: query.description,
              color: query.color,
              createdAt: query.createdAt,
              updatedAt: query.updatedAt
            },
            createdBy: 'user' // You can modify this based on your auth system
          };

          const response = await fetch('http://localhost:8082/api/query/saved', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(queryData),
          });

          if (response.ok) {
            successCount++;
          } else {
            const errorData = await response.json();
            if (response.status === 409 || (errorData.error && errorData.error.includes('already exists'))) {
              // Query already exists
              duplicateCount++;
              console.warn(`Query already exists: ${query.name}`);
            } else {
              errorCount++;
              errorMessages.push(`${query.name}: ${errorData.error || 'Unknown error'}`);
              console.error(`Failed to upload query: ${query.name}`, errorData);
            }
          }
        } catch (err) {
          errorCount++;
          errorMessages.push(`${query.name}: ${err.message}`);
          console.error(`Error uploading query ${query.name}:`, err);
        }
      }

      // Show detailed success message
      let message = `Upload complete! ${successCount} queries uploaded successfully`;
      if (duplicateCount > 0) {
        message += `, ${duplicateCount} already existed`;
      }
      if (errorCount > 0) {
        message += `, ${errorCount} failed`;
        if (errorMessages.length > 0) {
          console.error('Upload errors:', errorMessages);
        }
      }
      
      showNotification(message, successCount > 0 ? 'success' : (duplicateCount > 0 ? 'warning' : 'error'));

      // Clear selection and refresh cloud queries list
      if (successCount > 0) {
        setSelectedUploadQueries(new Set());
      }
      await fetchCloudQueries();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFromCloud = async () => {
    if (selectedQueries.size === 0) {
      alert('Please select queries to download');
      return;
    }

    setLoading(true);
    setError(null);
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    const errorMessages = [];

    try {
      for (const queryId of selectedQueries) {
        try {
          // Check if query already exists locally
          const existingQuery = queries.find(q => q.id === queryId);
          if (existingQuery) {
            duplicateCount++;
            console.warn(`Query already exists locally: ${existingQuery.name}`);
            continue; // Skip this query
          }

          const response = await fetch(`http://localhost:8082/api/query/saved/${queryId}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch query ${queryId}`);
          }
          
          const data = await response.json();
          if (data.success) {
            const cloudQuery = data.data;
            
            // Convert cloud query to local format using Query.fromJSON to create proper Query instances
            const localQueryData = {
              id: cloudQuery._id, // Use the cloud query's _id as the local id
              name: cloudQuery.name,
              description: cloudQuery.query.description || '',
              conditions: Array.isArray(cloudQuery.query.conditions) ? 
                cloudQuery.query.conditions : 
                (cloudQuery.query.conditions?.conditions || []),
              color: cloudQuery.query.color || '#3B82F6',
              createdAt: cloudQuery.query.createdAt || new Date().toISOString(),
              updatedAt: cloudQuery.query.updatedAt || new Date().toISOString()
            };

            // Create a proper Query instance
            const localQuery = Query.fromJSON(localQueryData);

            addQuery(localQuery);
            successCount++;
          } else {
            errorCount++;
            errorMessages.push(`Query ${queryId}: ${data.error || 'Unknown error'}`);
          }
        } catch (err) {
          errorCount++;
          errorMessages.push(`Query ${queryId}: ${err.message}`);
          console.error(`Error downloading query ${queryId}:`, err);
        }
      }

      // Show detailed success message
      let message = `Download complete! ${successCount} queries imported`;
      if (duplicateCount > 0) {
        message += `, ${duplicateCount} already existed locally`;
      }
      if (errorCount > 0) {
        message += `, ${errorCount} failed`;
        if (errorMessages.length > 0) {
          console.error('Download errors:', errorMessages);
        }
      }

      showNotification(message, successCount > 0 ? 'success' : (duplicateCount > 0 ? 'warning' : 'error'));

      setSelectedQueries(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCloudQuery = async (queryId) => {
    if (!window.confirm('Are you sure you want to delete this query from the cloud?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8082/api/query/saved/${queryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchCloudQueries();
        setSelectedQueries(prev => {
          const newSet = new Set(prev);
          newSet.delete(queryId);
          return newSet;
        });
      } else {
        throw new Error('Failed to delete query');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUploadQuerySelection = (queryId) => {
    setSelectedUploadQueries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(queryId)) {
        newSet.delete(queryId);
      } else {
        newSet.add(queryId);
      }
      return newSet;
    });
  };

  const selectAllUploadQueries = () => {
    if (selectedUploadQueries.size === queries.length) {
      setSelectedUploadQueries(new Set());
    } else {
      setSelectedUploadQueries(new Set(queries.map(q => q.id)));
    }
  };

  const toggleQuerySelection = (queryId) => {
    setSelectedQueries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(queryId)) {
        newSet.delete(queryId);
      } else {
        newSet.add(queryId);
      }
      return newSet;
    });
  };

  const selectAllQueries = () => {
    // Filter out queries that are already imported
    const availableQueries = cloudQueries.filter(cloudQuery => 
      !queries.some(localQuery => localQuery.id === cloudQuery._id)
    );
    
    if (selectedQueries.size === availableQueries.length) {
      setSelectedQueries(new Set());
    } else {
      setSelectedQueries(new Set(availableQueries.map(q => q._id)));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-60 pointer-events-none">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden pointer-events-auto border border-gray-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Cloud Database Management</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              Upload to Cloud
            </button>
            <button
              onClick={() => setActiveTab('download')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'download'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              Download from Cloud
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Local Queries to Cloud</h3>
                <p className="text-gray-600 mb-4">
                  Select queries from your local workspace ({queries.length} available) to upload to the cloud database.
                </p>

                {queries.length > 0 && (
                  <div className="mb-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={selectAllUploadQueries}
                        className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {selectedUploadQueries.size === queries.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span className="text-sm text-gray-600">
                        {selectedUploadQueries.size} of {queries.length} selected
                      </span>
                    </div>
                    <button
                      onClick={handleUploadToCloud}
                      disabled={loading || selectedUploadQueries.size === 0}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                      Upload Selected
                    </button>
                  </div>
                )}
              </div>

              {/* Local Queries Selection List */}
              {queries.length > 0 ? (
                <div className="border border-gray-200 rounded-lg">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">Local Queries</h4>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {queries.map((query) => (
                      <div key={query.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedUploadQueries.has(query.id)}
                          onChange={() => toggleUploadQuerySelection(query.id)}
                          className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <div
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: query.color }}
                        ></div>
                        <div className="flex-grow">
                          <div className="font-medium text-gray-900">{query.name}</div>
                          {query.description && (
                            <div className="text-sm text-gray-600">{query.description}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            Created: {formatDate(query.createdAt)}
                            {query.updatedAt && query.updatedAt !== query.createdAt && (
                              <span> | Updated: {formatDate(query.updatedAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-lg font-medium">No local queries found</p>
                  <p className="text-sm">Create some queries first to upload them to the cloud</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'download' && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Download Queries from Cloud</h3>
                  <p className="text-gray-600">
                    Select queries from the cloud database to import into your local workspace.
                  </p>
                </div>
                <button
                  onClick={fetchCloudQueries}
                  disabled={loading}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                  title="Refresh"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {cloudQueries.length > 0 && (
                <div className="mb-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={selectAllQueries}
                      className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {(() => {
                        const availableQueries = cloudQueries.filter(cloudQuery => 
                          !queries.some(localQuery => localQuery.id === cloudQuery._id)
                        );
                        return selectedQueries.size === availableQueries.length ? 'Deselect All' : 'Select All Available';
                      })()}
                    </button>
                    <span className="text-sm text-gray-600">
                      {(() => {
                        const availableQueries = cloudQueries.filter(cloudQuery => 
                          !queries.some(localQuery => localQuery.id === cloudQuery._id)
                        );
                        const alreadyImported = cloudQueries.length - availableQueries.length;
                        return `${selectedQueries.size} of ${availableQueries.length} available selected${alreadyImported > 0 ? ` (${alreadyImported} already imported)` : ''}`;
                      })()}
                    </span>
                  </div>
                  <button
                    onClick={handleDownloadFromCloud}
                    disabled={loading || selectedQueries.size === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                    )}
                    Download Selected
                  </button>
                </div>
              )}

              {/* Cloud Queries List */}
              {loading && cloudQueries.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-600">Loading cloud queries...</p>
                </div>
              ) : cloudQueries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  <p className="text-lg font-medium">No queries found in cloud</p>
                  <p className="text-sm">Upload some queries first or check your connection</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">Cloud Queries</h4>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {cloudQueries.map((query) => {
                      const isAlreadyImported = queries.some(localQuery => localQuery.id === query._id);
                      
                      return (
                        <div key={query._id} className={`px-4 py-3 flex items-center gap-3 hover:bg-gray-50 ${isAlreadyImported ? 'opacity-60' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selectedQueries.has(query._id)}
                            onChange={() => toggleQuerySelection(query._id)}
                            disabled={isAlreadyImported}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                          />
                          <div
                            className="w-4 h-4 rounded-full border border-gray-300"
                            style={{ backgroundColor: query.query?.color || '#3B82F6' }}
                          ></div>
                          <div className="flex-grow">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-gray-900">{query.name}</div>
                              {isAlreadyImported && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                  Already Imported
                                </span>
                              )}
                            </div>
                            {query.query?.description && (
                              <div className="text-sm text-gray-600">{query.query.description}</div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              Created: {formatDate(query.createdAt)} | By: {query.createdBy}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteCloudQuery(query._id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete from cloud"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-500">
          <div>
            {activeTab === 'upload' 
              ? `${queries.length} local queries available, ${selectedUploadQueries.size} selected` 
              : (() => {
                  const availableQueries = cloudQueries.filter(cloudQuery => 
                    !queries.some(localQuery => localQuery.id === cloudQuery._id)
                  );
                  const alreadyImported = cloudQueries.length - availableQueries.length;
                  return `${cloudQueries.length} cloud queries found, ${availableQueries.length} available to import, ${selectedQueries.size} selected${alreadyImported > 0 ? ` (${alreadyImported} already imported)` : ''}`;
                })()
            }
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-[100] text-white ${
          notification.type === 'success' ? 'bg-green-500' : 
          notification.type === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
        }`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default DatabaseManagementModal;
