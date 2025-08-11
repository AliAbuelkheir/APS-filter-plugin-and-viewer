import { initViewer, loadModel } from './viewer.js';
import { QueryBuilder } from './queryBuilder.js';
import { SavedQueriesManager } from './savedQueriesManager.js';
import { ToastManager } from './toastManager.js';

let queryBuilder;
let savedQueriesManager;

initViewer(document.getElementById('preview'))
    .then(async viewer => {
        window.viewer = viewer; // Make viewer globally accessible
        
        const urn = window.location.hash?.substring(1);
        setupModelSelection(viewer, urn);
        setupModelUpload(viewer);
        
        // Initialize query builder and saved queries manager
        queryBuilder = new QueryBuilder();
        savedQueriesManager = new SavedQueriesManager(queryBuilder);
        
        // Make them globally accessible for onclick handlers
        window.queryBuilder = queryBuilder;
        window.savedQueriesManager = savedQueriesManager;
        
        console.log('Viewer and tools initialized successfully');
    })
    .catch(error => {
        console.error('Failed to initialize viewer:', error);
        showNotification(`Failed to initialize viewer: ${error}`);
    });

async function setupModelSelection(viewer, selectedUrn) {
    const dropdown = document.getElementById('models');
    dropdown.innerHTML = '';
    try {
        const resp = await fetch('/api/models');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const models = await resp.json();
        dropdown.innerHTML = models.map(model => `<option value=${model.urn} ${model.urn === selectedUrn ? 'selected' : ''}>${model.name}</option>`).join('\n');
        dropdown.onchange = () => onModelSelected(viewer, dropdown.value);
        if (dropdown.value) {
            onModelSelected(viewer, dropdown.value);
        }
    } catch (err) {
        console.error('Could not list models:', err);
        showNotification(`Could not list models: ${err.message}`);
    }
}

async function setupModelUpload(viewer) {
    const upload = document.getElementById('upload');
    const input = document.getElementById('input');
    const models = document.getElementById('models');
    upload.onclick = () => input.click();
    input.onchange = async () => {
        console.log('setupModelUpload');
        const file = input.files[0];
        let data = new FormData();
        data.append('model-file', file);
        upload.setAttribute('disabled', 'true');
        models.setAttribute('disabled', 'true');
        showNotification(`Uploading model <em>${file.name}</em>. Do not reload the page.`);
        try {
            const resp = await fetch('/api/models', { method: 'POST', body: data });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            const model = await resp.json();
            setupModelSelection(viewer, model.urn);
        } catch (err) {
            alert(`Could not upload model ${file.name}. See the console for more details.`);
            console.error(err);
        } finally {
            clearNotification();
            upload.removeAttribute('disabled');
            models.removeAttribute('disabled');
            input.value = '';
        }
    };
}

async function onModelSelected(viewer, urn) {
    console.log("onModelSelected called with URN:", urn);
    
    if (window.onModelSelectedTimeout) {
        clearTimeout(window.onModelSelectedTimeout);
        delete window.onModelSelectedTimeout;
    }
    
    window.location.hash = urn;
    showNotification('Loading model...');
    
    try {
        console.log("Fetching model status for:", urn);
        const resp = await fetch(`/api/models/${urn}/status`);
        
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        
        const status = await resp.json();
        console.log("Model status:", status.status);
        
        switch (status.status) {
            case 'n/a':
                showNotification(`Model has not been translated.`);
                break;
            case 'inprogress':
                showNotification(`Model is being translated (${status.progress})...`);
                window.onModelSelectedTimeout = setTimeout(onModelSelected, 5000, viewer, urn);
                break;
            case 'failed':
                showNotification(`Translation failed. <ul>${status.messages.map(msg => `<li>${JSON.stringify(msg)}</li>`).join('')}</ul>`);
                break;
            default:
                try {
                    console.log("Loading model into viewer...");
                    await loadModel(viewer, urn);
                    clearNotification();
                    console.log("Model loaded successfully");
                } catch (modelError) {
                    console.error("Error loading model:", modelError);
                    showNotification(`Error loading model: ${modelError.message || modelError}`);
                }
                break;
        }
    } catch (err) {
        console.error("Error in onModelSelected:", err);
        showNotification(`Could not load model: ${err.message || err}`);
    }
}

function showNotification(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `<div class="notification">${message}</div>`;
    overlay.style.display = 'flex';
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = '';
    overlay.style.display = 'none';
}


