import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Viewer from '../components/Viewer';
import QueryManagerModal from '../components/QueryManagerModal';
import NewQueryModal from '../components/NewQueryModal';

const ModelViewerPage = () => {
  const [searchParams] = useSearchParams();
  const [viewerStatus, setViewerStatus] = useState('Initializing...');
  const [isQueryManagerOpen, setIsQueryManagerOpen] = useState(false);
  const [isNewQueryOpen, setIsNewQueryOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState(null);
  
  // Get model parameters from URL
  const modelUrn = searchParams.get('urn');
  const modelName = searchParams.get('name');

  const handleViewerReady = (viewer) => {
    console.log('Viewer ready:', viewer);
    setViewerStatus('Viewer initialized');
  };

  const handleModelLoaded = (model) => {
    console.log('Model loaded:', model);
    setViewerStatus('Model loaded successfully');
  };

  const handleViewerError = (error) => {
    console.error('Viewer error:', error);
    setViewerStatus(`Error: ${error.message || error}`);
  };

  const handleOpenQueryManager = () => {
    setIsQueryManagerOpen(true);
  };

  const handleCloseQueryManager = () => {
    setIsQueryManagerOpen(false);
  };

  const handleOpenNewQuery = () => {
    setIsNewQueryOpen(true);
  };

  const handleCloseNewQuery = () => {
    setIsNewQueryOpen(false);
    setEditingQuery(null);
  };

  const handleEditQuery = (query) => {
    setEditingQuery(query);
    setIsQueryManagerOpen(false);
    setIsNewQueryOpen(true);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col"> {/* Changed from min-h-screen to h-screen */}
      <Navbar 
        currentFileName={modelName}
      />
      
      <div className="flex-1"> {/* Removed 'relative' class */}
        {/* Check if we have a model URN to display */}
        {modelUrn ? (
          <Viewer
            modelUrn={modelUrn}
            onViewerReady={handleViewerReady}
            onModelLoaded={handleModelLoaded}
            onError={handleViewerError}
            className="w-full h-full" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white"> {/* Changed from absolute positioning */}
            <div className="text-center">
              <div className="text-4xl mb-4">🏗️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Model Selected</h2>
              <p className="text-gray-600">Please select a model from the upload page to view it here.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <QueryManagerModal
        isOpen={isQueryManagerOpen}
        onClose={handleCloseQueryManager}
        onOpenNewQuery={handleOpenNewQuery}
        onEditQuery={handleEditQuery}
      />
      
      <NewQueryModal
        isOpen={isNewQueryOpen}
        onClose={handleCloseNewQuery}
        editingQuery={editingQuery}
      />
    </div>
  );
};

export default ModelViewerPage;