import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FiUpload, 
  FiEye, 
  FiRotateCw, 
  FiZoomIn, 
  FiLayers, 
  FiSettings,
  FiCloud,
  FiShield,
  FiCpu,
  FiArrowRight,
  FiPlay,
  FiFileText
} from 'react-icons/fi';
import Navbar from '../components/Navbar';

const Home = () => {
  const features = [
    {
      icon: FiUpload,
      title: "Easy Upload",
      description: "Upload 3D models in multiple formats including RVT, DWG, IFC, OBJ, and more with drag-and-drop simplicity."
    },
    {
      icon: FiEye,
      title: "Interactive 3D Viewing",
      description: "View and navigate your 3D models with smooth pan, zoom, and rotate controls powered by Autodesk Viewer."
    },
    {
      icon: FiLayers,
      title: "Model Analysis",
      description: "Analyze model properties, materials, and components with detailed information panels and filtering."
    },
    {
      icon: FiRotateCw,
      title: "Real-time Rendering",
      description: "Experience high-quality real-time rendering with support for complex geometries and materials."
    },
    {
      icon: FiZoomIn,
      title: "Precise Navigation",
      description: "Navigate through your models with precision using advanced camera controls and viewpoint management."
    },
    {
      icon: FiSettings,
      title: "Customizable Interface",
      description: "Adapt the viewer interface to your workflow with customizable tools and viewing options."
    }
  ];

  const benefits = [
    {
      icon: FiCloud,
      title: "Cloud-Powered",
      description: "Built on Autodesk Platform Services for reliable, scalable 3D model processing and viewing."
    },
    {
      icon: FiShield,
      title: "Secure Storage",
      description: "Your models are securely stored with configurable retention policies and access controls."
    },
    {
      icon: FiCpu,
      title: "High Performance",
      description: "Optimized for fast loading and smooth interaction, even with large and complex 3D models."
    }
  ];

  const supportedFormats = [
    { name: "Revit", ext: "RVT", color: "bg-orange-100 text-orange-800" },
    { name: "AutoCAD", ext: "DWG", color: "bg-blue-100 text-blue-800" },
    { name: "IFC", ext: "IFC", color: "bg-green-100 text-green-800" },
    { name: "Fusion 360", ext: "F3D", color: "bg-purple-100 text-purple-800" },
    { name: "STEP", ext: "STEP", color: "bg-gray-100 text-gray-800" },
    { name: "OBJ", ext: "OBJ", color: "bg-red-100 text-red-800" },
    { name: "STL", ext: "STL", color: "bg-indigo-100 text-indigo-800" },
    { name: "3DS", ext: "3DS", color: "bg-yellow-100 text-yellow-800" }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Powerful 3D Model
              <span className="block text-blue-200">Viewing & Analysis</span>
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Upload, view, and analyze your 3D models with our advanced viewer powered by Autodesk Platform Services
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/upload"
                className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg"
              >
                <FiUpload className="w-5 h-5 mr-2" />
                Start Viewing Models
                <FiArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <button className="inline-flex items-center px-8 py-4 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-600 transition-colors">
                <FiPlay className="w-5 h-5 mr-2" />
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to work with 3D models in a modern, intuitive interface
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Formats Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Supported File Formats
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Work with industry-standard 3D file formats from leading CAD and modeling software
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {supportedFormats.map((format, index) => (
              <div key={index} className={`px-4 py-2 rounded-full font-medium text-sm ${format.color}`}>
                {format.ext}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Built for Performance
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Enterprise-grade infrastructure and cutting-edge technology for the best viewing experience
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <benefit.icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get started with your 3D models in three simple steps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Upload Your Model</h3>
              <p className="text-gray-600">
                Drag and drop your 3D model files or browse to select them. We support all major CAD formats.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Processing</h3>
              <p className="text-gray-600">
                Our cloud-based system processes your model and prepares it for high-performance 3D viewing.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">View & Analyze</h3>
              <p className="text-gray-600">
                Interact with your 3D model using our advanced viewer with navigation, analysis, and filtering tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Start Viewing Your 3D Models?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Upload your first model and experience the power of cloud-based 3D viewing
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg text-lg"
          >
            <FiUpload className="w-6 h-6 mr-3" />
            Get Started Now
            <FiArrowRight className="w-6 h-6 ml-3" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-4">AIDigits APS Viewer</h3>
            <p className="text-gray-400 mb-6">
              Powered by Autodesk Platform Services
            </p>
            <div className="flex justify-center items-center gap-6 text-sm">
              <span className="flex items-center gap-2">
                <FiFileText className="w-4 h-4" />
                Documentation
              </span>
              <span className="flex items-center gap-2">
                <FiShield className="w-4 h-4" />
                Privacy Policy
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;