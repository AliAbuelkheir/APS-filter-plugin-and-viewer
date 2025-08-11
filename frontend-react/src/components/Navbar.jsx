import React from 'react';
import { Link } from 'react-router-dom';
import { FiUpload, FiFileText, FiHome, FiInfo } from 'react-icons/fi';
import aiDigitsLogo from '../assets/Aidigits_logo.png';

/**
 * A versatile navigation bar component that adapts based on props.
 * Shows viewer version when currentFileName is provided, upload version otherwise.
 * @param {{ currentFileName?: string, isUploadPage?: boolean }} props - Component props.
 * @param {string} [props.currentFileName] - The name of the currently opened file.
 * @param {boolean} [props.isUploadPage] - Forces upload page layout even with currentFileName.
 */
const Navbar = ({ currentFileName, isUploadPage = false }) => {
  const isViewerMode = currentFileName && !isUploadPage;

  return (
    <header className="sticky top-0 z-50 h-16 bg-white border-b border-gray-200 shadow-sm">
      <nav className="flex items-center justify-between h-full max-w-7xl mx-auto px-6">
        {/* Left Section: Logo */}
        <div className="flex items-center">
          <Link 
            to="/" 
            className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-200"
          >
            <img 
              src={aiDigitsLogo} 
              alt="AIDigits Logo" 
              className="h-8 w-auto"
            />
          </Link>
        </div>

        {/* Center Section: Conditional Content */}
        <div className="flex items-center flex-1 justify-center px-8">
          {isViewerMode ? (
            // Viewer Mode: Show current file
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 max-w-md">
              <FiFileText className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0" />
              <span 
                className="text-sm font-medium text-gray-700 truncate"
                title={currentFileName}
              >
                {currentFileName}
              </span>
            </div>
          ) : (
            // Upload Mode: Show page title
            <h1 className="text-lg font-semibold text-gray-700">
              Upload Your 3D Model
            </h1>
          )}
        </div>

        {/* Right Section: Conditional Actions */}
        <div className="flex items-center gap-4">
          {isViewerMode ? (
            // Viewer Mode: Show upload new file button
            <Link 
              to="/upload" 
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <FiUpload className="w-4 h-4" />
              <span>File Management</span>
            </Link>
          ) : (
            // Upload Mode: Show navigation links
            <>
              <Link 
                to="/about" 
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 px-3 py-2 rounded-lg font-medium text-sm transition-colors duration-200"
              >
                <FiInfo className="w-4 h-4" />
                <span>About</span>
              </Link>
              
              <Link 
                to="/" 
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200"
              >
                <FiHome className="w-4 h-4" />
                <span>Home</span>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;