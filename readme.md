# APS Filter Plugin and Viewer

This project integrates **Autodesk Platform Services (APS, formerly Forge)** with a modular architecture consisting of a **React frontend**, a **viewer server backend**, and a **FilterPlugin service** backed by a local **MongoDB** instance.  

It provides an end-to-end workflow for uploading, translating, and visualizing models in APS Viewer while enabling powerful query management and visualization. It features a custom filter plugin supporting complex queries with nested groups and AND/OR logic, element colorization, query import/export, and concurrent query execution. The application uses a React-based frontend for enhanced state management, a backend server for APS operations, and a query engine connected to MongoDB for efficient filtering.


## 🚀 Features
### 1. React Frontend
- **Model Viewing**: Upload and preview 3D designs and 2D drawings using the APS Viewer SDK.
  - **Landing Page**: Entry point with project overview and model access.
  - **File Management Dashboard**: Upload models to APS buckets using signed URLs, manage available files, and initiate translation.
  - **Viewer**: Display models with interactive controls.
  - **Query Manager**: Import/export query definitions, add/edit/delete queries, colorize queries for visualization, and show/hide queries dynamically.

### 2. Viewer Server (Backend)
- **APS Integration**: Manages authentication (2-legged OAuth via `@aps_sdk/authentication`), model uploads with signed links, and translation to SVF2 format (`@aps_sdk/model-derivative`).
- **Bucket Operations**: Handles APS bucket interactions via `@aps_sdk/oss`.
- **API Endpoints**: Exposes helper endpoints for frontend integration, streamlining model and authentication workflows.

### 3. FilterPlugin Service
- **Complex Query Filtering**: Perform multi-level grouped queries on SVF2 models with nested AND/OR logic, leveraging the Model Properties API.
- **Query Management**: Save, retrieve, and apply queries for filtering, colorization, and grouping.
- **Concurrent Query Execution**: Run multiple queries simultaneously for efficient filtering.
- **Database Integration**: Persist queries and model data in a local MongoDB server (using `mongoose`) to reduce APS API calls.

### Additional Features
- **Element Colorization**: Apply custom colors to filtered model elements for visual distinction.
- **Query Import/Export**: Save queries to MongoDB and export/import them as JSON for reuse.
- **Dual-Server Architecture**: Separate servers for APS operations (`viewer-server`) and query processing (`filterPlugin`), communicating via API endpoints.

## Project Structure
```
APS-filter-plugin-and-viewer/
└── docs/                    # All documentation and diagrams
└── frontend-react/          # React frontend (landing page, dashboard, viewer, query manager)
└── viewer-server/           # Backend service for APS authentication, signed uploads, translation
└── filterPlugin/            # Query Service connected to local MongoDB
```



## 📖 Documentation

- **[Query Object Format](./docs/Query.md)** – details the structure exchanged between frontend and FilterPlugin.  
- **[Workflow](./docs/Workflow.md)** – step-by-step workflow explanation with diagrams.  
- **[API Specification](./docs/openapi.yaml)** – OpenAPI definition of the backend and FilterPlugin endpoints.



## ⚙️ Workflow Overview

1. **Upload & Translate**  
   - User uploads a file via the dashboard.  
   - Viewer server creates a signed URL and uploads the file to an APS bucket.  
   - The server requests translation to SVF2.  

2. **Model Viewing**  
   - The frontend fetches the translated model URN and loads it into the APS Viewer.  

3. **Query Management**  
   - Users create or import queries in the Query Manager.  
   - Queries are stored in local MongoDB via FilterPlugin.  
   - Queries can be applied to models for filtering, colorization, and grouping.  



## 🛠️ Tech Stack

### Frontend (`/frontend-react`)
- **React 19** + **Vite 7** for fast, modern builds  
- **TailwindCSS 4** for styling  
- **React Router DOM 7** for navigation  
- **React Icons** for UI icons  
- **Axios** for HTTP requests  
- **Classnames** utility for conditional styling  
- **ESLint + plugins** for linting and code quality  

### Backend Viewer Server (`/viewer-server`)
- **Express 5** as the HTTP framework  
- **@aps_sdk/authentication** for APS OAuth  
- **@aps_sdk/model-derivative** for translation tasks  
- **@aps_sdk/oss** for bucket and object operations  
- **Express Formidable** for handling file form data  
- **CORS** middleware for cross-origin access  

### FilterPlugin (`/filterPlugin`)
- **Express 5** server exposing query endpoints  
- **Mongoose 8** for MongoDB schema management and data persistence  
- **Axios** for internal service communication  
- **CORS** middleware for cross-origin integration  

### Development
- **Nodemon** for automatic server restarts  
- **Concurrent** (or `concurrently`) for running frontend and backend together  



## 🔐 Environment Variables

The project uses **environment variables** (instead of `dotenv`) to manage sensitive configuration.  

Typical variables include:
```bash
# APS credentials
APS_CLIENT_ID=<your client id>
APS_CLIENT_SECRET=<your client secret>
APS_BUCKET=<your bucket name>

# Local MongoDB
MONGO_URI=mongodb://localhost:27017/aps-filter-plugin

# Server configuration
PORT=3000
```

These should be set in your shell environment or in a .env.local file ignored by git.

## Getting Started
For detailed setup instructions, including prerequisites, environment configuration, and installation steps, refer to [docs/Workflow.md](docs/Workflow.md).

## Contributors
- Ali AbuElkheir (@AliAbuElkheir)