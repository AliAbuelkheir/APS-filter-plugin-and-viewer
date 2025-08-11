import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FiAlertCircle, FiLoader, FiRefreshCw, FiFilter } from 'react-icons/fi';
import QueryManagerModal from './QueryManagerModal';
import NewQueryModal from './NewQueryModal';


const Viewer = ({ modelUrn, onViewerReady, onModelLoaded, onError, className = '' }) => {
  const viewerContainerRef = useRef(null);
  const viewerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Initializing viewer...');
  const [progress, setProgress] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [showNewQueryModal, setShowNewQueryModal] = useState(false);
  const [editingQuery, setEditingQuery] = useState(null);



const addCustomToolbarButton = useCallback((viewer) => {
  // Create a new toolbar group
  const toolbar = viewer.getToolbar(true);
  const queryGroup = new window.Autodesk.Viewing.UI.ControlGroup('query-manager-group');

  // Create the filter button
  const filterButton = new window.Autodesk.Viewing.UI.Button('query-manager-button');
  filterButton.setToolTip('Query Manager');

  // Create a container for the icon
  const iconContainer = document.createElement('div');
  iconContainer.className = 'flex items-center justify-center';
  iconContainer.style.width = '24px'; // Match typical Autodesk icon size
  iconContainer.style.height = '24px';
  iconContainer.style.lineHeight = '24px';

  // Use ReactDOM to render the FiFilter icon into the container
  import('react-dom/client').then(({ createRoot }) => {
    const root = createRoot(iconContainer);
    root.render(<FiFilter className="w-5 h-5" 
      style={{color: '#D9D9D9' }}/>
    ); // Match h3 styling
  });

  // Clear default icon and append custom icon
  filterButton.container.innerHTML = ''; // Remove default icon content
  filterButton.container.appendChild(iconContainer);
  filterButton.container.style.display = 'flex';
  filterButton.container.style.alignItems = 'center';
  filterButton.container.style.justifyContent = 'center';

  // Add click event handler
  filterButton.onClick = () => {
    console.log('Query Manager button clicked');
    setShowQueryModal(true);
  };

  // Add button to group and group to toolbar
  queryGroup.addControl(filterButton);
  toolbar.addControl(queryGroup);

  console.log('Custom Query Manager button added to toolbar');
}, []);

  // Handle editing a query
  const handleEditQuery = useCallback((query) => {
    setEditingQuery(query);
    setShowQueryModal(false);
    setShowNewQueryModal(true);
  }, []);

  // Handle closing the new query modal
  const handleCloseNewQuery = useCallback(() => {
    setShowNewQueryModal(false);
    setEditingQuery(null);
  }, []);

  // Load Autodesk Viewer SDK
  const loadAutodeskSDK = useCallback(() => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.Autodesk?.Viewing) {
        resolve();
        return;
      }

      // Load CSS first
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.css';
      document.head.appendChild(cssLink);

      // Load JavaScript
      const script = document.createElement('script');
      script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.js';
      script.onload = () => {
        // Wait a bit for the SDK to fully initialize
        setTimeout(() => {
          if (window.Autodesk?.Viewing) {
            resolve();
          } else {
            reject('Autodesk Viewer SDK failed to initialize');
          }
        }, 500);
      };
      script.onerror = () => reject('Failed to load Autodesk Viewer SDK');
      document.head.appendChild(script);
    });
  }, []);

  // Initialize viewer
  const initViewer = useCallback(async (container) => {
    return new Promise((resolve, reject) => {
      // Check if Autodesk Viewing is initialized
      if (!window.Autodesk || !window.Autodesk.Viewing) {
        reject('Autodesk Viewing SDK not loaded');
        return;
      }

      window.Autodesk.Viewing.Initializer({
        env: 'AutodeskProduction',
        getAccessToken: async function(onTokenReady) {
          try {
            const resp = await fetch('http://localhost:8081/api/auth/token');
            const data = await resp.json();
            onTokenReady(data.access_token, data.expires_in);
          } catch (error) {
            console.error('Error fetching token:', error);
            onTokenReady('', 0);
          }
        }
      }, () => {
        const config = {
          extensions: ['Autodesk.DocumentBrowser']
        };
        
        const viewer = new window.Autodesk.Viewing.GuiViewer3D(container, config);
        
        const startedCode = viewer.start();
        if (startedCode > 0) {
          console.error('Failed to start the viewer');
          reject(`Failed to start the viewer (code: ${startedCode})`);
          return;
        }
        
        // Add event listeners after viewer starts
        viewer.addEventListener(window.Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
          addCustomToolbarButton(viewer);
        });

        viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
          const currentGuid = viewer.model?.getDocumentNode().children[1].guid();
          if(currentGuid){
            console.log('Geometry loaded. GUID:', currentGuid);
            
            // Get the current URN
            const urn = window.currentModelUrn;
            if (urn) {
              // Call the setup method with the new GUID
              initializeFilterPlugin(urn, currentGuid).then(result => {
                if (result.success) {
                  console.log('Setup completed for new viewable with GUID:', currentGuid);
                  console.log(`Loaded ${result.data.itemCount} items with ${result.data.categories.length} categories`);
                } else {
                  console.warn('Setup failed for viewable with GUID:', currentGuid, result.error);
                }
              }).catch(error => {
                console.error('Error setting up viewable with GUID:', currentGuid, error);
              });
            }
          }
        });

        // Store viewer globally for easier access
        window.viewer = viewer;
        viewerRef.current = viewer;
        
        resolve(viewer);
      });
    });
  }, [addCustomToolbarButton]);

  // Initialize filter plugin
  const initializeFilterPlugin = useCallback(async (urn, guid) => {
    try {
      console.log(`Initializing filter plugin for model URN: ${urn} with GUID: ${guid}`);
      
      const response = await fetch('http://localhost:8082/api/init/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ urn, guid })
      });
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('Filter plugin initialized successfully:', data);
      
      return data;
    } catch (error) {
      console.error('Failed to initialize filter plugin:', error.message);
      return { 
        success: false, 
        error: error.message,
        fallback: 'Model loaded successfully but filter plugin initialization failed'
      };
    }
  }, []);

  // Load model function
  const loadModel = useCallback(async (viewer, urn) => {
    if (!viewer) {
      return Promise.reject('Viewer is not initialized');
    }

    if (!urn) {
      return Promise.reject('Model URN not provided');
    }

    console.log('Loading model with URN:', urn);
    window.currentModelUrn = urn;
    
    return new Promise((resolve, reject) => {
      if (!viewer || typeof viewer.loadDocumentNode !== 'function') {
        reject('Viewer not properly initialized');
        return;
      }

      // Try to unload existing models first
      try {
        const models = viewer.getVisibleModels();
        if (models && models.length > 0) {
          console.log('Unloading existing models...');
          for (const model of models) {
            viewer.unloadModel(model);
          }
        }
      } catch (err) {
        console.warn('Failed to unload existing models:', err);
      }

      function onDocumentLoadSuccess(doc) {
        window.currentDocument = doc;
        
        const viewables = doc.getRoot().search({'type':'geometry'});
        if (viewables.length === 0) {
          reject('Document contains no viewables');
          return;
        }
        // Printing all viewables and their GUIDs
        console.log('Available viewables:', viewables.map(v => ({ guid: v.guid(), name: v.name() })));

        // Use the first viewable for simplicity
        const initialViewable = viewables[0];
        console.log('Loading viewable:', initialViewable);

        // Log the initial GUID
        console.log('Initial viewable GUID:', initialViewable.guid());

        viewer.loadDocumentNode(doc, initialViewable)
          .then(model => {
            console.log('Model loaded successfully:', model);
            resolve(model);
          })
          .catch(err => {
            console.error('Failed to load document node:', err);
            reject(err);
          });
      }

      function onDocumentLoadFailure(error) {
        console.error('Failed to load document:', error);
        reject(error);
      }

      try {
        window.Autodesk.Viewing.Document.load(
          'urn:' + urn,
          onDocumentLoadSuccess,
          onDocumentLoadFailure
        );
      } catch (err) {
        console.error('Exception during document loading:', err);
        reject(err);
      }
    });
  }, []);

  // Check model status and load if ready
  const checkModelStatus = useCallback(async (urn) => {
    try {
      setStatus('Checking model status...');
      console.log("Fetching model status for:", urn);
      const resp = await fetch(`http://localhost:8081/api/models/${urn}/status`);
      
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      
      const statusData = await resp.json();
      console.log("Model status:", statusData.status);
      
      switch (statusData.status) {
        case 'n/a':
          setError('Model has not been translated');
          setIsLoading(false);
          break;
        case 'inprogress':
          setStatus(`Model is being translated (${statusData.progress || '0%'})...`);
          setProgress(parseInt(statusData.progress) || 0);
          setTimeout(() => checkModelStatus(urn), 5000);
          break;
        case 'failed':
          setError(`Translation failed: ${statusData.messages?.map(msg => JSON.stringify(msg)).join(', ') || 'Unknown error'}`);
          setIsLoading(false);
          break;
        default:
          try {
            setStatus('Loading model into viewer...');
            console.log("Loading model into viewer...");
            const model = await loadModel(viewerRef.current, urn);
            setIsLoading(false);
            setStatus('Model loaded successfully');
            console.log("Model loaded successfully");
            onModelLoaded?.(model);
          } catch (modelError) {
            console.error("Error loading model:", modelError);
            setError(`Error loading model: ${modelError.message || modelError}`);
            setIsLoading(false);
            onError?.(modelError);
          }
          break;
      }
    } catch (err) {
      console.error("Error checking model status:", err);
      setError(`Could not load model: ${err.message || err}`);
      setIsLoading(false);
      onError?.(err);
    }
  }, [loadModel, onModelLoaded, onError]);

  // Initialize viewer and load model - ONLY RUN ONCE
  useEffect(() => {
    if (!viewerContainerRef.current || isInitialized) return;

    const initializeViewer = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setStatus('Loading Autodesk Viewer SDK...');

        await loadAutodeskSDK();
        
        setStatus('Initializing 3D viewer...');
        const viewer = await initViewer(viewerContainerRef.current);
        console.log('Viewer initialized:', viewer);
        setIsInitialized(true);
        onViewerReady?.(viewer);

        if (modelUrn) {
          await checkModelStatus(modelUrn);
        } else {
          setIsLoading(false);
          setStatus('Ready - no model specified');
        }
      } catch (err) {
        console.error('Failed to initialize viewer:', err);
        setError(err.message || err);
        setIsLoading(false);
        onError?.(err);
      }
    };

    initializeViewer();

    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.tearDown();
          viewerRef.current = null;
          window.viewer = null;
          setIsInitialized(false);
        } catch (err) {
          console.warn('Error during viewer cleanup:', err);
        }
      }
    };
  }, []);

  // Handle model URN changes SEPARATELY
  useEffect(() => {
    if (viewerRef.current && modelUrn && isInitialized) {
      checkModelStatus(modelUrn);
    }
  }, [modelUrn, isInitialized, checkModelStatus]);

  const handleRetry = () => {
    if (modelUrn) {
      setError(null);
      setIsLoading(true);
      checkModelStatus(modelUrn);
    }
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Viewer Container */}
      <div 
        ref={viewerContainerRef} 
        className="w-full h-full bg-gray-100"
        style={{ minHeight: '400px' }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-10">
          <div className="text-center bg-white rounded-lg p-8 shadow-2xl max-w-md mx-4">
            <FiLoader className="w-12 h-12 text-blue-600 mx-auto mb-6 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading 3D Model</h3>
            <p className="text-gray-700 font-medium mb-6">{status}</p>
            
            {progress > 0 && (
              <div className="w-full">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span className="font-semibold">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {progress < 30 ? 'Initializing...' : 
                   progress < 70 ? 'Processing model...' : 
                   progress < 90 ? 'Almost ready...' : 
                   'Finalizing...'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-10">
          <div className="text-center max-w-md mx-4 bg-white rounded-lg p-8 shadow-2xl">
            <FiAlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Model</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
            >
              <FiRefreshCw className="w-5 h-5 mr-2" />
              Retry Loading
            </button>
          </div>
        </div>
      )}

      {/* Query Manager Modal - Placeholder for now */}
      <QueryManagerModal
        isOpen={showQueryModal}
        onClose={() => setShowQueryModal(false)}
        onOpenNewQuery={() => setShowNewQueryModal(true)}
        onEditQuery={handleEditQuery}
      />
      
      <NewQueryModal
        isOpen={showNewQueryModal}
        onClose={handleCloseNewQuery}
        editingQuery={editingQuery}
      />
    </div>
  );
};

export default Viewer;