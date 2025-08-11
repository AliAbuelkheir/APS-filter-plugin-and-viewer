import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryProvider } from './contexts/QueryContext.jsx';
import ModelViewer from './pages/ModelViewer';
import UploadPage from './pages/UploadPage';
import Home from './pages/Home';

export default function App() {
  return (
    <QueryProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/viewer" element={<ModelViewer />} />
            <Route path="/upload" element={<UploadPage />} />
          </Routes>
        </div>
      </Router>
    </QueryProvider>
  );
}