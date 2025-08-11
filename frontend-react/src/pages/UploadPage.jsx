import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUpload, FiFile, FiTrash2, FiEye, FiCalendar, FiRefreshCw } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import OSSClient from '../services/OSSClient';

const UploadPage = () => {
  const navigate = useNavigate();
  const [uploadedModels, setUploadedModels] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [error, setError] = useState(null);
  const [newlyUploadedId, setNewlyUploadedId] = useState(null);
  const [bucketName, setBucketName] = useState(null);

  // Backend server URL
  const BACKEND_URL = 'http://localhost:8081';
  
  // Initialize OSS Client
  const ossClient = new OSSClient(BACKEND_URL);

  // Add this helper function before the fetchModels function
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return 'Unknown size';
    
    const kb = bytes / 1024;
    const mb = bytes / (1024 * 1024);
    
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    } else {
      return `${kb.toFixed(1)} KB`;
    }
  };

  // Fetch models from backend server
  const fetchModels = async () => {
    setIsLoadingModels(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/models`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }
      const models = await response.json();
      
      // Transform backend data to match our component structure
      const transformedModels = models.map((model, index) => ({
        id: model.urn || `model-${index}`,
        name: model.name || 'Unknown Model',
        urn: model.urn,
        uploadDate: model.uploadDate || new Date().toISOString().split('T')[0],
        size: formatFileSize(model.size),
        status: model.status || 'ready'
      }));
      
      setUploadedModels(transformedModels);
    } catch (err) {
      console.error('Could not list models:', err);
      setError(`Could not list models: ${err.message}`);
      
      // Fallback to mock data if backend is not available
      const mockModels = [
        {
          id: 'fallback-1',
          name: 'Sample Building Model (Fallback)',
          uploadDate: '2025-01-29',
          size: '45.2 MB',
          status: 'ready',
          urn: 'sample-urn-1'
        }
      ];
      setUploadedModels(mockModels);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load models and config on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      // Load bucket configuration
      try {
        const configResponse = await fetch(`${BACKEND_URL}/api/config`);
        if (configResponse.ok) {
          const config = await configResponse.json();
          setBucketName(config.bucket);
        }
      } catch (err) {
        console.warn('Could not load configuration:', err);
      }
      
      // Load models
      await fetchModels();
    };
    
    loadInitialData();
  }, []);

  // Clear highlight effect after 3 seconds
  useEffect(() => {
    if (newlyUploadedId) {
      const timer = setTimeout(() => {
        setNewlyUploadedId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [newlyUploadedId]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Use the new OSSClient for chunked upload
      const uploadResult = await ossClient.uploadFile(selectedFile, {
        uploadInParallel: false, // Set to true for parallel uploads
        onProgress: (progressInfo) => {
          const percentage = Math.min(progressInfo.percentage, 90);
          setUploadProgress(percentage);
          
          // Log progress states
          console.log(`Upload progress: ${progressInfo.state} - ${progressInfo.message} (${percentage}%)`);
        }
      });

      console.log('Upload completed:', uploadResult);
      
      // Complete progress and start translation
      setUploadProgress(95);
      
      // Now start the translation process
      const objectId = `urn:adsk.objects:os.object:${bucketName || 'unknown-bucket'}/${selectedFile.name}`;
      const urn = uploadResult.urn || btoa(objectId).replace(/=/g, '');
      
      // Start translation
      await translateModel(urn);
      setUploadProgress(100);
      
      // Add newly uploaded model to the list immediately
      const newModel = {
        id: urn,
        name: selectedFile.name,
        urn: urn,
        uploadDate: new Date().toISOString().split('T')[0],
        size: formatFileSize(selectedFile.size),
        status: 'processing' // Initially processing, will become ready after translation
      };
      
      setUploadedModels(prev => [newModel, ...prev]); // Add to beginning of list
      setNewlyUploadedId(urn); // Highlight the new model
      
      // Reset upload state
      setTimeout(() => {
        setSelectedFile(null);
        setIsUploading(false);
        setUploadProgress(0);
        
        // Refresh the list to get updated status
        setTimeout(() => {
          fetchModels();
        }, 2000);
      }, 1000);

    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
      setUploadProgress(0);
      alert(`Upload failed: ${error.message}`);
    }
  };

  // Helper function to translate the model
  const translateModel = async (urn) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/models/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          urn: urn
        })
      });

      if (!response.ok) {
        console.warn('Translation request failed, but upload succeeded');
      }
    } catch (error) {
      console.warn('Translation request failed:', error.message);
    }
  };

  // Upload API function - matching your vanilla JS implementation
  const uploadFileToAPI = async (file) => {
    const formData = new FormData();
    formData.append('model-file', file); // Use 'model-file' to match your backend
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/models`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Upload successful:', result);
      return result;
      
    } catch (err) {
      console.error('API Call failed:', err);
      throw err; // Re-throw to handle in calling function
    }
  };

  const handleModelSelect = (model) => {
    if (model.status === 'ready' && model.urn) {
      // Navigate to viewer with the selected model
      navigate(`/viewer?urn=${encodeURIComponent(model.urn)}&name=${encodeURIComponent(model.name)}`);
    } else if (!model.urn) {
      alert('Model URN is not available. Cannot load model.');
    } else {
      alert('Model is still processing. Please wait.');
    }
  };

  const handleDeleteModel = (modelId) => {
    if (window.confirm('Are you sure you want to delete this model?')) {
      // TODO: Add actual API call to delete model
      setUploadedModels(prev => prev.filter(model => model.id !== modelId));
    }
  };

  const handleRefreshModels = () => {
    fetchModels();
  };

  const getStatusInfo = (status) => {
    const statusConfig = {
      ready: { label: 'Ready', color: 'text-green-600 bg-green-50 border-green-200' },
      processing: { label: 'Processing', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
      failed: { label: 'Failed', color: 'text-red-600 bg-red-50 border-red-200' }
    };
    return statusConfig[status] || statusConfig.processing;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isUploadPage={true} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Left Section: Available Models */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-fit">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <FiFile className="w-5 h-5 text-blue-600" />
                    Available Models ({uploadedModels.length})
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Select a model to view or manage your uploaded files
                  </p>
                </div>
                <button
                  onClick={handleRefreshModels}
                  disabled={isLoadingModels}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh Models"
                >
                  <FiRefreshCw className={`w-4 h-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Backend Connection Status */}
              {error && (
                <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">Backend Connection</h4>
                      <p className="text-xs text-yellow-700 mt-1">
                        {error}. Using fallback data.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isLoadingModels ? (
                <div className="text-center py-12">
                  <FiRefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-500">Loading models...</p>
                </div>
              ) : uploadedModels.length === 0 ? (
                <div className="text-center py-12">
                  <FiFile className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No models uploaded yet</p>
                  <p className="text-sm text-gray-400">Upload your first 3D model to get started</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {uploadedModels.map((model) => {
                    const statusInfo = getStatusInfo(model.status);
                    const isNewlyUploaded = newlyUploadedId === model.id;
                    
                    return (
                      <div
                        key={model.id}
                        className={`border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer ${
                          isNewlyUploaded 
                            ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-200 animate-pulse' 
                            : 'border-gray-200'
                        }`}
                        onClick={() => handleModelSelect(model)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900 truncate text-sm">
                                {model.name}
                              </h3>
                              {isNewlyUploaded && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                  New
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <FiCalendar className="w-3 h-3" />
                                {model.uploadDate}
                              </span>
                              <span>{model.size}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {model.status === 'ready' && model.urn && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleModelSelect(model);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View Model"
                              >
                                <FiEye className="w-4 h-4" />
                              </button>
                            )}
                            {/* Uncomment when delete API is implemented
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteModel(model.id);
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Model"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                            */}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Section: Upload New Model */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-fit">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <FiUpload className="w-5 h-5 text-blue-600" />
                Upload New Model
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Upload a 3D model file to your bucket
              </p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* File Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".rvt,.dwg,.ifc,.f3d,.step,.stp,.iges,.igs,.obj,.3ds,.fbx,.dae,.ply,.stl"
                    disabled={isUploading}
                  />
                  <label htmlFor="file-upload" className={`cursor-pointer block ${isUploading ? 'pointer-events-none opacity-50' : ''}`}>
                    <FiUpload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">
                      {selectedFile ? selectedFile.name : 'Click to select a file or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Supported formats: RVT, DWG, IFC, F3D, STEP, IGES, OBJ, 3DS, FBX, DAE, PLY, STL
                    </p>
                  </label>
                </div>
                {selectedFile && (
                  <div className="mt-2 text-sm text-gray-600">
                    Size: {formatFileSize(selectedFile.size)}
                  </div>
                )}
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {uploadProgress < 90 ? 'Uploading file...' : 
                     uploadProgress === 100 ? 'Upload complete! Processing model...' : 
                     'Preparing for upload...'}
                  </p>
                </div>
              )}

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <FiUpload className="w-4 h-4" />
                {isUploading ? 'Uploading...' : 'Upload Model'}
              </button>

              {/* Backend Integration Status */}
              {/* <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">Backend Integration</h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Connecting to backend server at <code className="bg-blue-100 px-1 rounded">localhost:8081</code>. 
                      Models are processed and translated automatically after upload.
                    </p>
                  </div>
                </div>
              </div> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;