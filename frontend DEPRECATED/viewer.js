

export function initViewer(container) {
    return new Promise(function (resolve, reject) {
        // Check if Autodesk Viewing is initialized
        if (!window.Autodesk || !window.Autodesk.Viewing) {
            reject('Autodesk Viewing not initialized');
            return;
        }

        Autodesk.Viewing.Initializer({
            env: 'AutodeskProduction',
            getAccessToken: async function(onTokenReady) {
                try {
                    const resp = await fetch('http://localhost:8081/api/auth/token');
                    const data = await resp.json();
                    onTokenReady(data.access_token, data.expires_in);
                } catch (error) {
                    console.error('Error fetching token:', error);
                    onTokenReady('', 0); // Empty token will cause viewer to fall back to anonymous access
                }
            }
        }, () => {
            // Create and initialize the viewer
            const config = {
                extensions: ['Autodesk.DocumentBrowser']
            };
            
            const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
            
            // Add this line to make the colorManager globally accessible
            window.colorManager = null;
            
            // Initialize the viewer
            const startedCode = viewer.start();
            if (startedCode > 0) {
                console.error('Failed to start the viewer');
                reject(`Failed to start the viewer (code: ${startedCode})`);
                return;
            }
            
            // Add event listeners after viewer starts
            viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                addCustomToolbarButton(viewer);
            });

            // Tracks when the viewable changes and calls setup method
            viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                const currentGuid =  viewer.model.getDocumentNode().guid();
                if(currentGuid){
                    console.log('Geometry loaded. GUID:', currentGuid);
                }
                else {
                    console.log('Geometry loaded but no GUID found');
                }
                    // Only call setup if GUID has changed
                    if (currentGuid) {
                        console.log('Viewable changed - setting up with new GUID:', currentGuid);
                        
                        // Get the current URN
                        const urn = window.currentModelUrn;
                        if (urn) {
                            // Call the setup method with the new GUID
                            initializeFilterPlugin(urn, currentGuid).then(result => {
                                if (result.success) {
                                    console.log('Setup completed for new viewable with GUID:', currentGuid);
                                    console.log(`Loaded ${result.data.itemCount} items with ${result.data.categories.length} categories`);
                                    
                                    // Refresh query builder if it's open
                                    if (window.queryBuilder && typeof window.queryBuilder.loadCategories === 'function') {
                                        window.queryBuilder.loadCategories();
                                    }
                                } else {
                                    console.warn('Setup failed for viewable with GUID:', currentGuid, result.error);
                                }
                            }).catch(error => {
                                console.error('Error setting up viewable with GUID:', currentGuid, error);
                            });
                        } else {
                            console.warn('No current URN available for setup');
                        }
                    } else {
                        console.log('GUID unchanged, skipping setup');
                    }
                });

            // Store viewer globally for easier access
            window.viewer = viewer;
            
            resolve(viewer);
        });
    });
}

export async function loadModel(viewer, urn) {
    if (!viewer) {
        console.error('Viewer is not initialized');
        return Promise.reject('Viewer is not initialized');
    }

    if (!urn) {
        console.error('Model URN not provided');
        return Promise.reject('Model URN not provided');
    }

    console.log('Loading model with URN:', urn);
    
    // Store URN globally for use in event handlers
    window.currentModelUrn = urn;
    
    return new Promise((resolve, reject) => {
        // Safe guard - make sure viewer exists and is ready
        if (!viewer || typeof viewer.loadDocumentNode !== 'function') {
            console.error('Viewer not properly initialized or missing loadDocumentNode method');
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
            // Continue anyway
        }

        function onDocumentLoadSuccess(doc) {
            // Store document globally for reference
            window.currentDocument = doc;
            
            // Get the available viewables
            const viewables = doc.getRoot().search({'type':'geometry'});
            if (viewables.length === 0) {
                console.error('Document contains no viewables.');
                reject('Document contains no viewables');
                return;
            }

            // Choose the first viewable
            const initialViewable = viewables[0];
            console.log('Loading viewable:', initialViewable);
            
            // Load the viewable
            viewer.loadDocumentNode(doc, initialViewable)
                .then(model => {
                    console.log('Model loaded successfully:', model);
                    
                    // Initialize filter plugin with the correct GUID
                    const guid = initialViewable.guid();
                    console.log('Initializing filter plugin with GUID:', guid);
            
                    
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

        // Load the document
        console.log('Loading document with URN:', urn);
        try {
            Autodesk.Viewing.Document.load(
                'urn:' + urn,
                onDocumentLoadSuccess,
                onDocumentLoadFailure
            );
        } catch (err) {
            console.error('Exception during document loading:', err);
            reject(err);
        }
    });
}

async function initializeFilterPlugin(urn, guid) {
    try {
        console.log(`Initializing filter plugin for model URN: ${urn} with GUID: ${guid}`);
        
        // Use the new setup endpoint
        const response = await fetch('http://localhost:8082/api/init/setup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ urn, guid })
        });
        
        if (!response.ok) {
            // Get detailed error information from the response
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                console.error('Server error response:', errorData);
            } catch (parseError) {
                console.error('Could not parse error response:', parseError);
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('Filter plugin initialized successfully:', data);
        
        // Log setup details
        if (data.success && data.data) {
            console.log(`Setup complete: ${data.data.itemCount} items loaded with ${data.data.categories.length} categories`);
            console.log('Available categories:', data.data.categories);
            
            if (data.data.usingFallback) {
                console.warn('Using fallback test data - real model data may not be available');
            }
        }
        
        // Refresh query builder categories if it exists and is loaded
        if (window.queryBuilder && typeof window.queryBuilder.loadCategories === 'function') {
            try {
                await window.queryBuilder.loadCategories();
                console.log('Query builder categories refreshed after setup');
            } catch (refreshError) {
                console.warn('Failed to refresh query builder categories:', refreshError);
            }
        }
        
        return data;
    } catch (error) {
        console.error('Failed to initialize filter plugin:', error.message);
        console.error('Error details:', error);
        
        // Return error but don't throw - allows model loading to succeed even if filter plugin fails
        return { 
            success: false, 
            error: error.message,
            fallback: 'Model loaded successfully but filter plugin initialization failed'
        };
    }
}


function addCustomToolbarButton(viewer) {
    // Wait a bit to ensure viewer is fully initialized
    setTimeout(() => {
        try {

            // Get the toolbar
            const toolbar = viewer.getToolbar(true);
            if (!toolbar) {
                console.error('Toolbar not found');
                return;
            }
            
            // Create a new control group for our button
            const customControlGroup = new Autodesk.Viewing.UI.ControlGroup('custom-tools');
            
            // Create a single button for filtering
            const filterButton = new Autodesk.Viewing.UI.Button('filter-tool-btn');
            filterButton.setToolTip('Filter');
            
            // Directly add the CSS class to the button's icon element for reliability
            filterButton.icon.classList.add('query-builder-btn');

            filterButton.onClick = function() {
                // This button will open the query builder
                if (window.queryBuilder) {
                    window.queryBuilder.showPopup();
                }
            };
            
            // Add the single button to the control group
            customControlGroup.addControl(filterButton);
            
            // Add the control group to the toolbar
            toolbar.addControl(customControlGroup);
            
            console.log('Custom filter toolbar button added successfully');
        } catch (error) {
            console.error('Error adding custom toolbar buttons:', error);
        }
    }, 1000); // Delay of 1 second to ensure viewer is ready
}

